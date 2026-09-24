import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clamp01 } from '../../lib/progress'
import { decorateChapterHtml, type CodeLine } from '../../lib/code'
import type { ReaderSettings } from '../../store/settings'
import type { ThemeChrome } from '../../themes/types'
import { ensureHighlighter, highlighterReady } from '../../lib/highlight'
import { useDecoy } from '../../store/decoy'
import { Minimap } from '../code/Minimap'
import { ChapterBody } from '../../apps/ChapterBody'
import { cx } from '../../lib/cx'

interface ReaderViewProps {
  html: string
  /** 当前这份 html 属于哪一章。和 contentKey 不一致时 html 还是上一章的 */
  htmlKey: string
  /** 章节标识。变了就重建内容并恢复位置 */
  contentKey: string
  /** 渲染时的图片地址 → 书里的原始路径。编辑器形态写占位引用要用它 */
  resources: Map<string, string>
  /** 这一章的标识（decoySeed）。目录树、标签页、正文三处要用同一个 */
  decoySeedValue?: string
  settings: ReaderSettings
  /** 主题声明的界面形态。code 时正文按代码排版并挂缩略图 */
  chrome: ThemeChrome
  /** 章名（聊天的分隔线、表格的 A1、幻灯片的标题页要用） */
  label?: string
  /** 书名与作者（幻灯片的副标题、聊天的发信人） */
  bookTitle?: string
  author?: string
  /** 进入本章要恢复到的章内比例（0-1） */
  entryRatio: number
  hasPrev: boolean
  hasNext: boolean
  onRatio: (ratio: number) => void
  onNext: () => void
  onPrev: () => void
  /** 点击内部链接（跨章） */
  onJump: (chapterIndex: number, fragment: string) => void
  /** 待跳转的同章锚点。跨章跳转时由上层在新章上设置 */
  fragment?: string
  onFragmentHandled?: () => void
  /** 点击正文（用来切换工具栏显隐） */
  onTap: () => void
}

/** 水平滑动的判定阈值：横向位移够大，且明显大于纵向，才当成翻页手势 */
const SWIPE_MIN_X = 45
const TAP_MAX_MOVE = 10

/** 一页窄过这个值就说明版面还没就位，量出来的页宽不能信 */
const MIN_PAGE_WIDTH = 200
/** 并排两页之间的中缝，随视口宽窄在 24-48px 之间取整数 */
const GAP_MIN = 24
const GAP_MAX = 48
const GAP_RATIO = 0.026

/** 滚轮翻页：累计滚这么远才翻，翻完锁一小会儿，免得一次拨动连翻好几页 */
const WHEEL_STEP = 48
const WHEEL_COOLDOWN = 280
/** 两次滚轮事件间隔超过它就算新手势，累计量清零 */
const WHEEL_IDLE = 200
/** 行模式滚轮（deltaMode = 1）按这么大一行折算成像素 */
const LINE_HEIGHT_FALLBACK = 16
const VIEWPORT_FALLBACK = 600

/** 一屏的版面：并排几列、每列多宽、总列数 */
interface PagedLayout {
  /** 单列宽度，也就是「一页」的宽度 */
  pageWidth: number
  /** 相邻两列左边缘的距离 = 列宽 + 中缝 */
  step: number
  /** 一屏并排几列：1 或 2 */
  cols: number
  /** 总列数 */
  total: number
}

const INITIAL_LAYOUT: PagedLayout = { pageWidth: 0, step: 0, cols: 1, total: 1 }

function sameLayout(a: PagedLayout, b: PagedLayout): boolean {
  return (
    a.pageWidth === b.pageWidth && a.step === b.step && a.cols === b.cols && a.total === b.total
  )
}

/** 中缝宽度。取整是必须的：它要和列宽一起参与「可见列数」的整数除法 */
function columnGapFor(available: number): number {
  return Math.round(Math.min(GAP_MAX, Math.max(GAP_MIN, available * GAP_RATIO)))
}

/**
 * 正文视图。滚动和翻页两种模式共用同一份内容 DOM，只换外层容器的行为。
 *
 * 翻页用 CSS 多列实现：列宽 = 一页宽度，column-gap = 中缝，于是「一列 = 一页」，
 * 总列数就是总页数，翻页就是给内容做一次 translateX。
 * 关键是外层 .mn-frame--paged：一个「恰好一屏宽、overflow hidden」的窗口，
 * 把多列内容裁到只剩当前这一屏。视口够宽时一屏并排两列（像摊开的书，两边都有字），
 * 不够宽就只放一列。没有这个窗口，宽视口下上一页和下一页会同时露出来。
 * 不用 epub.js 那套分页，因为它要一个 iframe，而 iframe 恰好是主题变量过不去的墙。
 */
function ReaderViewImpl({
  html,
  htmlKey,
  contentKey,
  resources,
  decoySeedValue,
  settings,
  chrome,
  label,
  bookTitle,
  author,
  entryRatio,
  hasPrev,
  hasNext,
  onRatio,
  onNext,
  onPrev,
  onJump,
  fragment,
  onFragmentHandled,
  onTap,
}: ReaderViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  const ratioRef = useRef(entryRatio)
  const reportTimer = useRef<number | undefined>(undefined)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(0)
  // 有锚点等着跳的时候不要恢复进章位置：恢复循环每 100ms 重试一次 scrollTop，
  // 会把刚跳过去的锚点位置顶掉（症状：点脚注只切章、不滚到位置）。
  // 用 ref 而不是把它塞进依赖：跳完以后 fragment 会被清掉，那时再重跑一次
  // 恢复循环，等于把锚点位置又抹一遍。
  const fragmentRef = useRef('')
  fragmentRef.current = fragment ?? ''

  /**
   * 翻页模式只属于普通形态和编辑器形态。
   *
   * 办公外壳里的正文不是整页排版的：飞书文档和 Word 是「一张纸」、
   * Excel 是网格、PPT 是一张张贴着的幻灯片、企业微信是聊天流。
   * 分栏翻页在那儿没有意义（而且「一张纸」比滚动容器窄，量出来的页宽会失真），
   * 所以这些形态下一律按上下滚动走。设置里那两项仍然留着，回到普通主题就生效。
   */
  const paged = settings.pageMode === 'paged' && (chrome === 'plain' || chrome === 'code')
  const code = chrome === 'code'
  /** 块状形态：正文由 ChapterBody 渲染（表格 / 幻灯片 / 聊天） */
  const blockChrome =
    chrome === 'chat' || chrome === 'sheet' || chrome === 'slide' ? chrome : null
  // 缩略图上「现在读到哪」的位置。滚动报告本来就限流到 100ms，跟着它一起更新，
  // 免得为了一个装饰性的框每秒重渲染十次仍不够快
  const [mapRatio, setMapRatio] = useState(() => clamp01(entryRatio))
  // 代码形态下正文要过一遍「这段像什么」（对话/标题/注释/图片），标签贴在元素上，
  // 颜色仍由主题变量决定（见 lib/code.ts）。演示模式下每一行换成假代码
  const decoyFlag = useDecoy((state) => state.enabled)
  const decoyPresetId = useDecoy((state) => state.preset)
  // highlight.js 是按需加载的（不读小说的人不用为它付首屏）。加载完重画一次，
  // 这期间正文已经显示出来了，只是还没上色
  const [painted, setPainted] = useState(highlighterReady)
  useEffect(() => {
    if (!decoyFlag) return
    let alive = true
    void ensureHighlighter().then(() => {
      if (alive) setPainted(true)
    })
    return () => {
      alive = false
    }
  }, [decoyFlag])
  // 演示模式只属于代码形态：普通形态下它什么也不该改（之前把这一条漏了，
  // 结果在普通形态里按过 Alt+Q 之后，章末的上下章按钮被一并吞掉）
  const decoy = code && decoyFlag ? decoyPresetId : null
  const decorated = useMemo(
    () =>
      code
        ? decorateChapterHtml(html, {
            resolve: (src) => resources.get(src),
            decoy,
            seed: decoySeedValue,
          })
        : { html, lines: [] as CodeLine[] },
    // painted 进依赖：高亮器加载完之后重画一遍，代码才是有颜色的
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, html, resources, decoy, decoySeedValue, painted],
  )
  // 换章时新 HTML 要等图片资源就位才到得了，期间 DOM 里还是上一章的内容。
  // 这时候量出来的页数、算出来的位置都是旧内容的——必须先确认拿到的是这一章，
  // 再开始恢复位置，否则会先闪一下上一章/本章末尾的位置再跳回来。
  const contentReady = htmlKey === contentKey
  const [page, setPage] = useState(0)
  const [layout, setLayout] = useState<PagedLayout>(INITIAL_LAYOUT)
  const [animate, setAnimate] = useState(true)
  // 换章时给正文一个淡入（样式见 content.css 的 .mn-chapter-in）。
  // 翻页模式下这条动画只动 opacity：transform 是翻页的地盘，两条动画抢同一个属性
  // 会让翻页一顿一顿的。
  const [entering, setEntering] = useState(true)
  // 版面同时留一份 ref：翻页、跳锚点这些「事件回调里读的当前值」不能等渲染，
  // 跨章跳转时回调跑在测量之后的另一拍，state 里还是上一次渲染的旧值。
  const layoutRef = useRef<PagedLayout>(INITIAL_LAYOUT)
  const pageRef = useRef(0)

  /** 页码是「屏幕左边缘落在第几列」。并排两页时它一定是 cols 的整数倍 */
  const setPageState = useCallback((next: number) => {
    pageRef.current = next
    setPage((current) => (current === next ? current : next))
  }, [])

  // 高频的滚动报告限流到 100ms：进度条不需要更高频率，
  // 而每次 setState 都会重渲染一侧界面
  const reportRatio = useCallback(
    (ratio: number) => {
      ratioRef.current = ratio
      if (reportTimer.current !== undefined) return
      reportTimer.current = window.setTimeout(() => {
        reportTimer.current = undefined
        setMapRatio(clamp01(ratioRef.current))
        onRatio(ratioRef.current)
      }, 100)
    },
    [onRatio],
  )

  // 换章时缩略图的视窗框跟着回到章首：上一章的位置对不上新的正文
  useEffect(() => {
    setMapRatio(clamp01(entryRatio))
  }, [contentKey, entryRatio])

  useEffect(
    () => () => {
      if (reportTimer.current !== undefined) window.clearTimeout(reportTimer.current)
    },
    [],
  )

  // 进新章：把淡入类挂上，动画播完摘掉（留着它的话，下一次因为别的原因重挂会再闪一次）
  useEffect(() => {
    setEntering(true)
    const timer = window.setTimeout(() => setEntering(false), 360)
    return () => window.clearTimeout(timer)
  }, [contentKey])

  // ---- 滚动模式：恢复位置 ----
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || paged || !contentReady) return
    // 这一章是被脚注/内部链接跳进来的：位置由锚点说了算，别抢
    if (fragmentRef.current) return
    // 这一轮要恢复到的位置固定下来。用固定的目标而不是随时变的 ratioRef：
    // 否则重试期间用户自己滚一下、或者滚动事件在版面还没就位时报回一个 1，
    // 重试就会把读者拽到别处（最坏是拽到章末）。
    const entry = clamp01(entryRatio)
    ratioRef.current = entry
    let cancelled = false
    // 上一次真正写进去的滚动范围。版面没变就不再写——重写同一个位置，
    // 唯一的后果就是把读者刚滚走的位置拽回来（症状：往下滚一下弹回章首）。
    let applied = -1

    const timers: number[] = []

    const restore = () => {
      if (cancelled) return
      const max = viewport.scrollHeight - viewport.clientHeight
      if (max === applied) return
      applied = max
      viewport.scrollTop = max > 0 ? max * entry : 0
    }

    // 读者一动手就交还控制权。恢复位置只在「进章那一小会儿」有意义，
    // 之后每一次写 scrollTop 都是在跟读者抢滚动条。
    const giveUp = () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
    viewport.addEventListener('wheel', giveUp, { passive: true })
    viewport.addEventListener('touchstart', giveUp, { passive: true })
    viewport.addEventListener('pointerdown', giveUp, { passive: true })
    viewport.addEventListener('keydown', giveUp)

    // 反复恢复直到内容真的有高度（字体、图片都可能晚一步就位）。
    // 目标是固定的，而且版面没变就不重写，所以重来只会收敛，不会漂移。
    let attempts = 0
    const step = () => {
      restore()
      attempts++
      if (attempts < 12) timers.push(window.setTimeout(step, 100))
    }
    timers.push(window.setTimeout(step, 0))

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      viewport.removeEventListener('wheel', giveUp)
      viewport.removeEventListener('touchstart', giveUp)
      viewport.removeEventListener('pointerdown', giveUp)
      viewport.removeEventListener('keydown', giveUp)
    }
  }, [contentKey, contentReady, paged, entryRatio])

  // ---- 翻页模式：量页宽、算列数 ----
  /** 量一屏版面并写进 CSS 变量。返回量出来的版面；量不出可用页宽时返回 null */
  const measure = useCallback((): PagedLayout | null => {
    const viewport = viewportRef.current
    const frame = frameRef.current
    const content = contentRef.current
    if (!viewport || !frame || !content || !paged || !contentReady) return null

    // 可用宽度取滚动容器的内容宽（翻页模式下它的 padding 是 0）。
    // 容器宽度不可信时（布局还没就位、整个视口宽度是 0）直接放弃这一拍，
    // 硬算下去页数完全失真。宁可什么都不做，交给上层重试。
    const available = viewport.clientWidth
    if (available < MIN_PAGE_WIDTH) return null

    // 栏宽是用户定的上限，换算成 px 才能判断放不放得下两栏。
    // 不读 CSS 变量：自定义属性读回来是没有解析的 token（"42rem"），
    // 而 rem 的基准就在 documentElement 上，自己乘一下更直接。
    const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const columnWidth = Math.max(MIN_PAGE_WIDTH, Math.round(settings.contentWidth * rootFont))
    const gap = columnGapFor(available)
    // 两栏加中缝放得下就并排两页：桌面宽窗口下正文只占中间一条、两边全空着，
    // 那不叫左右翻页，叫「中间一条」。
    const cols = available >= 2 * columnWidth + gap ? 2 : 1
    const pageWidth =
      cols === 2
        ? Math.min(columnWidth, Math.floor((available - gap) / 2))
        : Math.min(columnWidth, available)
    const step = pageWidth + gap

    // 裁剪窗口的宽度按列算准，而且必须是整数：多列布局的可见列数是
    // floor((容器宽 + 中缝) ÷ (列宽 + 中缝))，差一个像素就会少算一列——两页变一页。
    // 这就是中缝在 JS 里取整算、而不是交给 CSS clamp 的原因。
    frame.style.setProperty('--mn-frame-width', `${cols * pageWidth + (cols - 1) * gap}px`)
    frame.style.setProperty('--mn-col-gap', `${gap}px`)
    content.style.setProperty('--mn-page-width', `${pageWidth}px`)
    // 页高给 CSS 用来限制图片高度：整页插图在多列里没法被切断，
    // 不限高的话它会纵向溢出，把后面几页的版面全顶乱
    const pageHeight = content.clientHeight
    if (pageHeight > 0) content.style.setProperty('--mn-page-height', `${pageHeight}px`)

    const next: PagedLayout = {
      pageWidth,
      step,
      cols,
      total: Math.max(1, Math.round((content.scrollWidth + gap) / step)),
    }

    // 位置按比例还原：改字号或转屏之后，读者应该还在原文附近。
    // ratio 的约定是「已读列数 ÷ 总列数」（turn 和跳锚点都这么写），
    // 所以反解列序号要减一：round(ratio * total) 得到的是已读列数。
    // 少了这个减一，每次重新测量都会把位置往后顶一屏——连翻两屏、往回翻没反应，
    // 都是它。
    const read = Math.round(clamp01(ratioRef.current) * next.total) - 1
    const column = Math.min(next.total - 1, Math.max(0, read))
    // 一屏的左边缘只能落在整屏的第一列上：并排两页时不能停在两页中间
    const page = Math.floor(column / cols) * cols

    layoutRef.current = next
    setLayout((prev) => (sameLayout(prev, next) ? prev : next))
    setPageState(page)
    // 量出来的页序号要回报出去：改字号、拉窗口、转屏之后这一屏才是用户看到的
    // 位置，不回报的话存进库的还是旧比例——重新打开会差一页。
    // 回报的是量化后的位置，所以「回报 → 再量」是稳定的，不会来回漂。
    reportRatio(clamp01((page + cols) / next.total))
    return next
    // contentWidth 不在函数体里直接用，但它决定 columnWidth 和裁剪窗口宽度——
    // 把它列进依赖，改栏宽时依赖 measure 的那批 effect 才会重新量页。
    // contentReady 要进依赖：它是「这一段 HTML 属于本章」的信号，
    // 变了才说明该重新量了
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paged, contentReady, reportRatio, settings.contentWidth, setPageState])

  useLayoutEffect(() => {
    if (!paged || !contentReady) return
    ratioRef.current = clamp01(entryRatio)
    // 重新测量时别播翻页动画，否则改字号会看到页面在飞
    setAnimate(false)

    // 进入本章后反复测量，直到真的量出页宽为止。
    // 为什么要重试而不是量一次：图片解码、字体就位、乃至容器宽度本身稳定都可能
    // 发生在这之后——实测里重新加载时浏览器会有一段时间把视口宽度报成 0，
    // 那时候量出来的东西全是错的。失败就继续等，成功之后再确认几拍让图片和字体
    // 就位后的列数变化收敛。
    // 每次测量都以 ratioRef 为准，所以重来只会收敛到正确位置，不会漂移。
    const timers: number[] = []
    let attempts = 0
    let settled = 0
    let last: PagedLayout | null = null
    const step = () => {
      const applied = measure()
      attempts++
      if (applied) setAnimate(true)
      settled = applied && last && sameLayout(applied, last) ? settled + 1 : 0
      last = applied
      // 版面连着几拍没变就收工：每量一次都要重排一遍多列正文，空转 8 秒不值当。
      // 图片晚到导致的列数变化由下面那个 img 监听补量。
      // 量不出来就慢一点接着试（视口为 0 可能要等好几秒）
      if (attempts >= 40 || settled >= 4) return
      timers.push(window.setTimeout(step, applied ? 200 : 250))
    }
    timers.push(window.setTimeout(step, 0))

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [paged, contentKey, contentReady, entryRatio, measure])

  // 视口尺寸变化（转屏、拉窗口、浏览器面板收放）都要重量。
  // ResizeObserver 盯的是容器，这里再补一层窗口级的事件：容器宽度没变但
  // 布局上下文变了的情况它也能兜住。
  useEffect(() => {
    if (!paged) return
    const onResize = () => {
      setAnimate(false)
      measure()
      requestAnimationFrame(() => setAnimate(true))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [paged, measure])

  useEffect(() => {
    if (!paged) return
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => {
      setAnimate(false)
      measure()
      requestAnimationFrame(() => setAnimate(true))
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [paged, measure])

  // 图片很晚才加载完（慢磁盘、大图）时补一次测量：它会改变列数
  useEffect(() => {
    if (!paged) return
    const content = contentRef.current
    if (!content) return
    const pending = Array.from(content.querySelectorAll('img')).filter((img) => !img.complete)
    if (pending.length === 0) return
    let timer: number | undefined
    const remeasure = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => measure(), 60)
    }
    const offs = pending.map((img) => {
      img.addEventListener('load', remeasure)
      img.addEventListener('error', remeasure)
      return () => {
        img.removeEventListener('load', remeasure)
        img.removeEventListener('error', remeasure)
      }
    })
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      offs.forEach((off) => off())
    }
  }, [paged, contentKey, html, measure])

  // ---- 翻页 ----
  const turn = useCallback(
    (delta: 1 | -1) => {
      if (!paged) {
        if (delta === 1) onNext()
        else onPrev()
        return
      }
      const { cols, total } = layoutRef.current
      // 并排两页时一「页」是一屏两列，所以步长是 cols
      const next = pageRef.current + delta * cols
      if (next < 0) {
        onPrev()
        return
      }
      if (next >= total) {
        onNext()
        return
      }
      setAnimate(true)
      setPageState(next)
      // 章内进度 = 已读列数 ÷ 总列数。
      // 必须同时更新 ratioRef：它是「本章当前位置」的唯一记录，任何重新测量
      // （改字号、转屏、窗口大小变化）都从它还原页码。少了这一行，翻完页再转屏
      // 就会跳回进本章时的位置。
      const ratio = clamp01((next + cols) / total)
      ratioRef.current = ratio
      setMapRatio(ratio)
      onRatio(ratio)
    },
    [paged, onNext, onPrev, onRatio, setPageState],
  )

  const scrollBy = useCallback((delta: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    // 系统里关了动效就别慢慢滚：连按翻页键时平滑滚动还会排队，越按越追不上
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    viewport.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  /**
   * 跳到本章的某个比例。缩略图上点一下、拖一下走的就是这里。
   *
   * 两种模式各有一半：滚动模式是把 scrollTop 写过去（这里的恢复位置只管进章那一刻，
   * 用户主动跳转不算「跟读者抢滚动条」）；翻页模式是按列数反解出页码，和 measure()
   * 一样要减一——ratio 的约定是「已读列数 ÷ 总列数」。
   */
  const seekToRatio = useCallback(
    (ratio: number) => {
      const next = clamp01(ratio)
      if (!paged) {
        const viewport = viewportRef.current
        if (!viewport) return
        const max = viewport.scrollHeight - viewport.clientHeight
        viewport.scrollTop = Math.max(0, max) * next
        reportRatio(next)
        return
      }
      const { cols, total } = layoutRef.current
      if (total <= 1) return
      const read = Math.round(next * total) - 1
      const column = Math.min(total - 1, Math.max(0, read))
      const page = Math.floor(column / cols) * cols
      // 拖缩略图时不要每跳一次都播翻页动画：连续跳会让页面一直在飞
      setAnimate(false)
      setPageState(page)
      window.requestAnimationFrame(() => setAnimate(true))
      const applied = clamp01((page + cols) / total)
      ratioRef.current = applied
      setMapRatio(applied)
      onRatio(applied)
    },
    [paged, onRatio, reportRatio, setPageState],
  )

  // 翻页模式下滚轮/触控板也翻页。
  // 滚动容器在翻页模式里是 overflow: hidden，不接管的话滚轮一点反应都没有；
  // 触控板的横向滑动还会被浏览器当成「前进/后退」。所以要用非 passive 的监听器
  // 才能 preventDefault——React 的 onWheel 是 passive 的，做不了这件事。
  useEffect(() => {
    if (!paged) return
    const viewport = viewportRef.current
    if (!viewport) return

    let accumulated = 0
    let previous = 0
    let lockedUntil = 0

    const onWheel = (event: WheelEvent) => {
      // Ctrl + 滚轮是缩放，别抢
      if (event.ctrlKey) return
      event.preventDefault()
      const now = performance.now()
      if (now < lockedUntil) return
      // 停顿够久就当是新手势：一次拨动的余量不该累加到下一次上
      if (now - previous > WHEEL_IDLE) accumulated = 0
      previous = now
      const scale =
        event.deltaMode === 1
          ? LINE_HEIGHT_FALLBACK
          : event.deltaMode === 2
            ? viewport.clientHeight || VIEWPORT_FALLBACK
            : 1
      // 横向滑动优先看横向位移，纵向滚轮看纵向。两者都是「正数 = 往后翻」
      const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      accumulated += raw * scale
      if (Math.abs(accumulated) < WHEEL_STEP) return
      const direction = accumulated > 0 ? 1 : -1
      accumulated = 0
      lockedUntil = now + WHEEL_COOLDOWN
      turn(direction)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [paged, turn])

  // ---- 键盘 ----
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const viewport = viewportRef.current
      const step = viewport ? viewport.clientHeight * 0.85 : 600

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          if (paged) turn(1)
          else onNext()
          return
        case 'ArrowLeft':
          event.preventDefault()
          if (paged) turn(-1)
          else onPrev()
          return
        case 'PageDown':
        case ' ':
          event.preventDefault()
          if (paged) turn(1)
          else scrollBy(step)
          return
        case 'PageUp':
          event.preventDefault()
          if (paged) turn(-1)
          else scrollBy(-step)
          return
        case 'ArrowDown':
          event.preventDefault()
          if (paged) turn(1)
          else scrollBy(120)
          return
        case 'ArrowUp':
          event.preventDefault()
          if (paged) turn(-1)
          else scrollBy(-120)
          return
        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paged, turn, scrollBy, onNext, onPrev])

  // 进入时给滚动容器焦点，滚轮/触控板之外的场景也能用
  useEffect(() => {
    viewportRef.current?.focus({ preventScroll: true })
  }, [])

  // ---- 点击与手势 ----
  const jumpToFragment = useCallback(
    (id: string) => {
      const content = contentRef.current
      if (!content || !id) return
      const target = content.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
      if (!target) return

      if (paged) {
        // 多列布局里 offsetLeft 就是这个元素落在第几列。
        // 现场量而不是读 state：跨章跳转时调用发生在测量之后的另一拍，
        // state 里的值还是上一次渲染的。
        // 还没量过（刚挂载就被要求跳）就补量一次，否则这次跳转会静悄悄失败——
        // 症状是「点脚注只切章、不滚到位置」。
        if (layoutRef.current.step <= 0) measure()
        const { step, cols, total } = layoutRef.current
        if (step <= 0) return
        const column = Math.min(total - 1, Math.max(0, Math.round(target.offsetLeft / step)))
        const page = Math.floor(column / cols) * cols
        setAnimate(true)
        setPageState(page)
        const ratio = clamp01((page + cols) / total)
        ratioRef.current = ratio
        setMapRatio(ratio)
        onRatio(ratio)
        return
      }

      const viewport = viewportRef.current
      if (!viewport) return
      const top = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top
      viewport.scrollTop += top - 16
    },
    [paged, onRatio, setPageState, measure],
  )

  // 跨章跳转（脚注、内部链接）落在新章之后要再走一步锚点。
  // 放在普通 effect 里：useLayoutEffect 已经完成测量和位置恢复，这时候
  // 元素的 offsetLeft / 位置才是算得准的。
  //
  // 必须等 contentReady：新章的 HTML 到得比「切章」晚，抢跑的话锚点在 DOM 里
  // 还不存在，跳转静默失败、pendingFragment 又被清掉——脚注就永远跳不过去了。
  useEffect(() => {
    if (!fragment || !contentReady) return
    const timer = window.setTimeout(() => {
      jumpToFragment(fragment)
      onFragmentHandled?.()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fragment, contentKey, contentReady, jumpToFragment, onFragmentHandled])

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement

    // 章末的上一章/下一章按钮
    const navButton = target.closest('[data-mn-nav]')
    if (navButton) {
      event.preventDefault()
      if (navButton.getAttribute('data-mn-nav') === 'next') onNext()
      else onPrev()
      return
    }

    // 其他交互元素（原生控件）不参与翻页判定
    if (target.closest('button, input, select, textarea, [role="button"]')) return

    // 内部链接：跨章跳转或同章锚点
    const anchor = target.closest('a')
    if (anchor) {
      const href = anchor.getAttribute('href')
      if (href?.startsWith('#mnref-')) {
        event.preventDefault()
        const rest = href.slice('#mnref-'.length)
        const [indexPart, fragment = ''] = rest.split(':')
        onJump(Number(indexPart), fragment)
        return
      }
      if (href?.startsWith('#')) {
        event.preventDefault()
        jumpToFragment(href.slice(1))
        return
      }
      // 外部链接交给浏览器
    }

    // 刚划过屏的手指不当作点击
    if (movedRef.current > TAP_MAX_MOVE) return
    // 选了文字说明用户在划词，别把工具栏弹出来
    if (window.getSelection()?.toString()) return

    if (!paged) {
      onTap()
      return
    }

    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const x = event.clientX - rect.left
    // 左右各 1/3 是翻页区，中间那条留给「显示工具栏」
    if (x < rect.width / 3) turn(-1)
    else if (x > (rect.width * 2) / 3) turn(1)
    else onTap()
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY }
    movedRef.current = 0
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    const start = touchRef.current
    if (!start) return
    const touch = event.touches[0]
    movedRef.current = Math.max(
      movedRef.current,
      Math.abs(touch.clientX - start.x) + Math.abs(touch.clientY - start.y),
    )
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) turn(1)
    else turn(-1)
  }

  const handleScroll = () => {
    if (paged) return
    const viewport = viewportRef.current
    // 内容还是上一章的时候不报进度：那个比例属于别的一章
    if (!viewport || !contentReady) return
    const max = viewport.scrollHeight - viewport.clientHeight
    // max 为 0 不报。它多半意味着一屏装下了整章，但切换阅读模式、版面还没
    // 就位的瞬间也会读到 0——那种时候报 1 等于宣布「这章读完了」，会写进库、
    // 还会把恢复位置顶到章末。少报一次的代价只是短章在读完前百分比略低。
    if (max <= 0) return
    reportRatio(clamp01(viewport.scrollTop / max))
  }

  const view = (
    <div
      ref={viewportRef}
      tabIndex={0}
      onScroll={handleScroll}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cx('mn-scroll', paged && 'mn-paged', 'outline-none')}
    >
      <div ref={frameRef} className={cx('mn-frame', paged && 'mn-frame--paged')}>
        {blockChrome ? (
          // 块状形态（表格 / 幻灯片 / 聊天）：正文不是一片字，而是一格一格的东西，
          // 由 ChapterBody 渲染。滚动、进度、锚点跳转仍然走这一层——所以这三种形态
          // 不用各自长出一套「怎么算读到哪了」。
          <article ref={contentRef} className="mn-content mn-content--blocks">
            <ChapterBody
              chrome={blockChrome}
              html={html}
              resources={resources}
              label={label ?? ''}
              bookTitle={bookTitle ?? ''}
              author={author ?? ''}
              percent={mapRatio}
            />
          </article>
        ) : (
          <article
            ref={contentRef}
            // 内容是解析时净化过的：DOMPurify 过了一遍，脚本/样式/外链样式表都剥掉了，
            // 图片指向本地 ObjectURL。所以这里可以放心用 innerHTML。
            // 代码形态下 decorated.html 是在它之上再过一遍标签（见 lib/code.ts），
            // 不删不改原文。章末那对「上一章/下一章」在演示模式下不拼进去：
            // 它的字面意思会露馅，而且状态栏上本来就有翻章按钮
            dangerouslySetInnerHTML={{
              __html: decorated.html + (decoy ? '' : chapterNavHtml(hasPrev, hasNext)),
            }}
            style={paged ? { transform: `translateX(${-page * layout.step}px)` } : undefined}
            className={cx(
              'mn-content',
              // 演示模式下正文是代码：这一条给 CSS 用来保留缩进（见 code.css）
              decoy && 'mn-content--code',
              paged && animate && 'mn-turning',
              entering && 'mn-chapter-in',
            )}
          />
        )}
      </div>
    </div>
  )

  // 代码形态下缩略图是滚动容器的兄弟节点（编辑区里正文和缩略图并排），
  // 所以这里返回一个 fragment；阅读器外壳把它放进 .mn-code__pane
  if (!code) return view
  return (
    <>
      {view}
      <Minimap lines={decorated.lines} ratio={mapRatio} onSeek={seekToRatio} />
    </>
  )
}

/**
 * 章末的上下章按钮直接拼进正文 HTML 里，而不是作为 React 兄弟节点：
 * 翻页模式下正文是多列布局，只有成为正文的一部分，按钮才会落在最后一列，
 * 而不是飘在多列容器之外。
 */
function chapterNavHtml(hasPrev: boolean, hasNext: boolean): string {
  if (!hasPrev && !hasNext) return ''
  const prev = hasPrev ? '<button type="button" data-mn-nav="prev">上一章</button>' : '<span></span>'
  const next = hasNext
    ? '<button type="button" data-mn-nav="next">下一章</button>'
    : '<span class="mn-chapter-nav__end">已是最后一章</span>'
  return `<nav class="mn-chapter-nav">${prev}${next}</nav>`
}

export const ReaderView = memo(ReaderViewImpl)
