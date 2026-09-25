import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chapterBlocks, mediaModeFor } from '../lib/blocks'
import { clearFinds, markFinds, revealFind } from '../lib/find'
import { chapterSlides, slideBudget, type Slide } from '../lib/slide'
import { PPT_TABS, avatarOf, fileNameFor, sectionNameOf, slideStatusText } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { toggleFullscreen } from '../lib/fullscreen'
import { cx } from '../lib/cx'
import { IconChevron, IconClose, IconSearch } from '../components/ui/icons'
import {
  IconAddinGrid,
  IconAiHelper,
  IconAlignCenter,
  IconAlignDistribute,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconArrange,
  IconBrush,
  IconBullets,
  IconCharSpacing,
  IconClearFormat,
  IconComment,
  IconCopy,
  IconFontColor,
  IconFontGrow,
  IconFontShrink,
  IconFontTile,
  IconHighlight,
  IconIndentLeft,
  IconIndentRight,
  IconLayout,
  IconLineSpacing,
  IconMultilevelList,
  IconNewSlide,
  IconNotes,
  IconNumbering,
  IconPaste,
  IconPdfConvert,
  IconPptMark,
  IconPptNormal,
  IconQuickStyles,
  IconReadView,
  IconRedo,
  IconReplace,
  IconReset,
  IconRuler,
  IconSaveFloppy,
  IconScissors,
  IconSection,
  IconSelectCursor,
  IconShapeEffects,
  IconShapeFill,
  IconShapeOutline,
  IconShare,
  IconSinglePage,
  IconSlideSorter,
  IconSlideshow,
  IconTemplateDoc,
  IconTextEffects,
  IconUndo,
} from '../components/ui/app-icons'
import {
  AppMenu,
  OfficeFrame,
  StatusButton,
  StatusText,
  type RibbonGroup,
  type RibbonItem,
  type RibbonTab,
} from './OfficeFrame'
import { SlideCard } from './Content'
import type { AppFrameProps } from './types'

/**
 * PowerPoint 形态。
 *
 * 2026-09-24 按桌面版 PowerPoint 的编辑窗口截图一比一重做（1920×1034）：标题栏
 * （PowerPoint 记号 + 自动保存 + 那一串快速访问 + 「演示文稿1 - PowerPoint」+ 中间的
 * 搜索框 + 升级计划 + 批注 / 共享）、一排页签（文件 / 开始 / OfficePLUS / 插入 / 绘图 /
 * 设计 / 切换 / 动画 / 幻灯片放映 / 记录 / 审阅 / 视图 / PDF工具箱 / 帮助）、
 * 九组格子的功能区、左边 290 的幻灯片缩略图栏、中间的画布（一次一张，带版式的
 * 两个虚线占位框）、画布下面的备注带、底部状态栏。尺寸都在 styles/ppt.css 的注释里，
 * 全部从截图上量（1:1 量）。
 *
 * 三处真东西（沿用决定记录 27 划的那条线）：
 *
 * 1. **缩略图栏就是这一章的幻灯片**：一张一章里的第几张，点一张就翻到那一张，
 *    「节」那一格（幻灯片组）列出全部章 = 节，点它换章。当前那一张描一圈
 *    PowerPoint 的选中橙（#B7472A，和标题栏按钮上的品牌橙是两个色）。
 * 2. **画布一次一张**：每一张占满一屏（上下滚动就是翻张），按 16:9 塞进工作区
 *    （尺寸由 JS 量出来写进 CSS 变量——和 PowerPoint 的缩放是同一件事）。
 *    浏览视图（视图页签 / 状态栏那几个按钮）换成一次好几张。
 * 3. **标题栏那个搜索框真的能搜**：在本章里找，命中的字套一层标记
 *    （lib/find.ts，和 Word / Excel 那个搜索框同一份实现）。
 *
 * 功能区的规矩和 Word / Excel 一样：会响的按下去屏幕真的变（复制这一张的字、
 * 字号、行距、段间距、对齐、换节、视图切换、备注、全屏、摸鱼、查找），
 * 只读演示文稿里本来就该灰的（粘贴、加粗、形状、SmartArt、加载项……）一律
 * disabled + title 说清为什么。
 */
export function PptApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  /** 普通视图（一次一张，截图里就是这个）/ 幻灯片浏览（一次好几张） */
  const [view, setView] = useState<'normal' | 'sorter'>('normal')
  /** 阅读视图：整窗只剩幻灯片（Word 那一屏的 immersive 同一路） */
  const [reading, setReading] = useState(false)
  const [railOpen, setRailOpen] = useState(() => window.innerWidth >= 900)
  /** 用户自己动过缩略图栏没有。动过之后就不再替他开 */
  const railTouched = useRef(false)
  const toggleRail = () => {
    railTouched.current = true
    setRailOpen((open) => !open)
  }
  // 宽度还没就位时（重新加载那一拍浏览器会报一个很小的视口）先别下结论：
  // 视口一旦报出一个正常宽度就把栏开回来；用户自己收起过之后就不动了
  useEffect(() => {
    const sync = () => {
      if (railTouched.current) return
      if (window.innerWidth >= 900) setRailOpen(true)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  /** 备注带摊开没有。收起时是一行（截图里那条「单击此处添加备注」的位置，我们写真的备注） */
  const [notesOpen, setNotesOpen] = useState(false)

  const slides = useMemo(
    () =>
      chapterSlides(
        // 图片怎么处理由 mediaModeFor 一处说了算（见 lib/blocks.ts）：
        // 幻灯片也是写一行 `![](./路径)`，和正文那边同一份切法（缩略图才对得上）
        chapterBlocks(props.chapterHtml ?? '', {
          media: mediaModeFor(props.chrome),
          resolve: props.resolveMedia,
        }),
        {
          title: props.chapterTitle || `第 ${props.chapterIndex + 1} 章`,
          subtitle: book.author ? `${book.title} · ${book.author}` : book.title,
          // 一张装多少字跟着字号走（见 lib/slide.ts 的 slideBudget）：
          // 缩略图栏和正文必须是同一份切法，不然缩略图和大图对不上
          ...slideBudget(settings.fontSize),
        },
      ),
    [
      props.chapterHtml,
      props.chapterTitle,
      props.chapterIndex,
      book.title,
      book.author,
      settings.fontSize,
    ],
  )

  // 现在看的是第几张：和 Excel 的「当前行」一样，按视口比例换算
  const activeIndex = Math.max(
    1,
    Math.min(slides.length, Math.floor(props.chapterPercent * slides.length) + 1),
  )
  const active: Slide | undefined = slides[activeIndex - 1]

  const chapters = props.chapters
  const sections = useMemo(
    () => (chapters ?? []).filter((row) => row.type === 'chapter'),
    [chapters],
  )

  /* ---- 工作区：量一遍可用大小，把幻灯片按 16:9 塞进去 ----
     尺寸由 JS 算（CSS 里 aspect-ratio 管不了「宽和高同时受限」这件事），
     算出来写进 CSS 变量：
       --mn-ppt-slide  这一张渲染出来多宽（.mn-slide 的宽度）
       --mn-ppt-scale  缩放比（正文字号 = 用户设的字号 × 这个数，所以大图上
                       每一段的换行位置和真实版心一致，只是整体大了一号）
       --mn-ppt-page   一「页」多高（= 滚动容器的可视高，一张正好一屏）
     变量写在外层：缩略图栏在它外面，量出来的数不会漏到缩略图上（那边固定 1320 版心
     加 transform，见 ppt.css）。 */
  const bodyRef = useRef<HTMLDivElement>(null)
  /** 上一次写进去的数：一样就不写，省掉一次样式重算（下面那个 MutationObserver 叫得很勤） */
  const stageRef = useRef({ scale: '', slide: '', page: '' })
  /** 现在看的是第几张。页高变化时要按它把同一张对回屏幕顶端 */
  const activeRef = useRef(1)
  activeRef.current = activeIndex
  /**
   * 把某一张钉在屏幕顶端。
   *
   * 进 / 出阅读视图时外壳从「带功能区的一整窗」换成「只剩一屏」，正文那棵树是**重建**的
   * ——滚动位置归零，而且随后几拍里别的地方还会再写一次。所以这段时间里反复对一次
   * （和 ReaderView 进章恢复位置同一个做法：目标固定，写同一个位置只会收敛）。
   */
  const pinTimer = useRef(0)
  const pinSlide = (index: number) => {
    window.clearInterval(pinTimer.current)
    let tries = 0
    pinTimer.current = window.setInterval(() => {
      tries += 1
      const body = bodyRef.current
      const scroller = body?.querySelector<HTMLElement>('.mn-scroll')
      const page = Number.parseFloat(body?.style.getPropertyValue('--mn-ppt-page') || '0')
      if (scroller && page > 0 && index >= 1) scroller.scrollTop = (index - 1) * page
      if (tries >= 8) window.clearInterval(pinTimer.current)
    }, 110)
  }
  useEffect(() => () => window.clearInterval(pinTimer.current), [])

  /** 阅读视图：整窗只剩幻灯片（Word 那一屏的 immersive 同一路） */
  const toggleReading = () => {
    const scroller = bodyRef.current?.querySelector<HTMLElement>('.mn-scroll')
    const page = Number.parseFloat(stageRef.current.page || '0')
    const index =
      scroller && page > 0 ? Math.round(scroller.scrollTop / page) + 1 : activeRef.current
    setReading((on) => !on)
    pinSlide(index)
  }
  const measureStage = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    const scroller = body.querySelector<HTMLElement>('.mn-scroll')
    if (!scroller) return
    const width = scroller.clientWidth
    const height = scroller.clientHeight
    if (width < 120 || height < 120) return
    const apply = (scale: string, slide: string, page: string) => {
      const last = stageRef.current
      if (last.scale === scale && last.slide === slide && last.page === page) return
      // 一「页」的高度变了（进阅读视图、拉窗口、收起缩略图栏）：把**同一张**按新的
      // 页高对回屏幕顶端，不然读者会莫名其妙换一张（一页 = 一屏，滚动的单位就是页）
      const reflow = Boolean(last.page) && last.page !== page && page !== 'auto'
      stageRef.current = { scale, slide, page }
      body.style.setProperty('--mn-ppt-scale', scale)
      body.style.setProperty('--mn-ppt-slide', slide)
      body.style.setProperty('--mn-ppt-page', page)
      if (reflow) scroller.scrollTop = (activeRef.current - 1) * Number.parseFloat(page)
    }
    if (view === 'sorter') {
      // 浏览视图：一屏三张（窄屏两张、再窄一张），高度不参与——从上往下排
      const per = Math.max(0.14, Math.min(0.42, (width - SORTER_GAP * 4) / (3 * SLIDE_W)))
      apply(String(per), `${SLIDE_W * per}px`, 'auto')
      return
    }
    const scale = Math.min(
      (width - STAGE_PAD * 2) / SLIDE_W,
      (height - STAGE_PAD * 2) / SLIDE_H,
    )
    apply(String(scale), `${SLIDE_W * scale}px`, `${height}px`)
  }, [view])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    /** 滚动容器是 ReaderView 给的，比外壳晚一拍才挂上——它一出现就要开始量 */
    let scroller: HTMLElement | null = null
    let sizeObserver: ResizeObserver | null = null
    const ensure = () => {
      if (!scroller || !scroller.isConnected) {
        scroller = body.querySelector<HTMLElement>('.mn-scroll')
        if (!scroller) return
        // 容器尺寸一变（拉窗口、收起缩略图栏、换视图）就重量一遍
        sizeObserver?.disconnect()
        sizeObserver = new ResizeObserver(measureStage)
        sizeObserver.observe(scroller)
      }
      measureStage()
    }
    ensure()
    /*
     * 正文（ReaderView）比外壳晚一拍才挂上，而 chapterIndex 这类 prop 在这一拍里
     * 是不变的，effect 不会再跑一次——2026-09-24 就是这么漏掉的：直接刷新进书时
     * 幻灯片退回老尺寸的 900 宽、一页的高度也不是一屏。
     * 所以盯 DOM：滚动容器一出现在 body 里就量（MutationObserver 在 React 提交时
     * 同步触发，比定时器可靠——后台标签页的定时器会被节流）。再补一个定时兜底。
     */
    const domObserver = new MutationObserver(ensure)
    domObserver.observe(body, { childList: true, subtree: true })
    const sizeObserverBody = new ResizeObserver(ensure)
    sizeObserverBody.observe(body)
    let ticks = 0
    const timer = window.setInterval(() => {
      ensure()
      ticks += 1
      if (scroller || ticks > 24) window.clearInterval(timer)
    }, 150)
    return () => {
      window.clearInterval(timer)
      domObserver.disconnect()
      sizeObserverBody.disconnect()
      sizeObserver?.disconnect()
    }
  }, [measureStage, reading, props.chapterIndex, props.chapterHtml])

  /** 点缩略图翻到那一张（截图里也是这样：缩略图栏点一下就切） */
  const goToSlide = (index: number) => {
    const scroller = bodyRef.current?.querySelector<HTMLElement>('.mn-scroll')
    const target = document.getElementById(`mn-slide-${index}`)
    if (!scroller || !target) return
    scroller.scrollTop =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  }

  /* ---- 查找：标题栏那个搜索框与编辑组里的「查找」共用同一份状态 ---- */
  const searchRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLElement[]>([])
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState({ total: 0, at: 0 })
  const hitRef = useRef(0)

  useEffect(() => {
    const root = bodyRef.current?.querySelector<HTMLElement>('.mn-ppt__stage')
    if (!root) return
    let cancelled = false
    let timer = 0
    let attempts = 0
    const apply = () => {
      if (cancelled) return
      // 换节时幻灯片要晚一拍才换上来（ReaderView 在等图片资源）。还是空的就再等
      if (query.trim() && !root.textContent?.trim() && attempts < 10) {
        attempts++
        timer = window.setTimeout(apply, 120)
        return
      }
      const marks = markFinds(root, query)
      marksRef.current = marks
      hitRef.current = marks.length ? 1 : 0
      setHit({ total: marks.length, at: hitRef.current })
      marks.forEach((mark, index) => revealFind(mark, index === 0))
    }
    timer = window.setTimeout(apply, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, props.chapterIndex, props.chapterHtml, view])

  const stepHit = (delta: number) => {
    const marks = marksRef.current
    if (marks.length === 0) return
    const at = ((hitRef.current - 1 + delta + marks.length) % marks.length) + 1
    hitRef.current = at
    marks.forEach((mark, index) => revealFind(mark, index === at - 1))
    setHit({ total: marks.length, at })
  }

  // 离开这个外壳（换主题）时把标记清干净：正文那块 DOM 是 React 的，换外壳时
  // **可能被下一个外壳接着用**（html 字符串没变，React 不重写 innerHTML），
  // 那样搜索框没了、标记还留在幻灯片里。和 Word / Excel 同一处理（见决定记录 34）
  useEffect(() => {
    const body = bodyRef.current
    return () => {
      const stage = body?.querySelector<HTMLElement>('.mn-ppt__stage')
      if (stage) clearFinds(stage)
    }
  }, [])

  // 阅读视图里按 Esc 出来：那个按钮的 title 里是这么写的，就得真能（和 Word 一样）
  useEffect(() => {
    if (!reading) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleReading()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reading])

  const copySlide = () => {
    if (!active) return
    const text = [active.title, ...active.body.map((part) => part.text)].filter(Boolean).join('\n')
    if (text) void navigator.clipboard.writeText(text)
  }

  const nudgeFont = (delta: number) =>
    onSettingsChange({ fontSize: Math.max(12, Math.min(34, settings.fontSize + delta)) })

  /** 字号那一格：幻灯片上的字有多大（截图里那个空框，我们显示真的字号） */
  const FONT_LABELS: Record<string, string> = { sans: '等线', serif: '宋体', kai: '楷体', mono: 'Consolas' }
  const FONT_ORDER = ['sans', 'serif', 'kai', 'mono']
  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 34]
  const LINE_STEPS = [1.15, 1.3, 1.5, 1.8]
  const PARA_STEPS = [0, 0.4, 0.8, 1.2]

  /* ---- 「开始」页签上那九组格子。顺序照截图：剪贴板 / 幻灯片 / OfficePLUS /
     字体 / 段落 / 绘图 / 编辑 / 加载项 / PDF工具箱 ---- */
  const homeGroups = useMemo<RibbonGroup[]>(() => {
    /** 小格子：图标 + 可选的字 + 右边一个小三角 */
    const cell = (
      id: string,
      icon: ReactNode,
      title: string,
      extra: Partial<RibbonItem> = {},
    ): RibbonItem => ({ id, kind: 'small', icon, title, ...extra })
    /** 图标在上、字在下的大格子 */
    const tile = (
      id: string,
      icon: ReactNode,
      label: ReactNode,
      title: string,
      extra: Partial<RibbonItem> = {},
    ): RibbonItem => ({ id, kind: 'big', icon, label, title, ...extra })
    /** 只读演示文稿里本来就该灰着的一格 */
    const off = (
      id: string,
      icon: ReactNode,
      label: ReactNode,
      title: string,
      extra: Partial<RibbonItem> = {},
    ): RibbonItem => ({ id, kind: 'small', icon, label: label || undefined, title, disabled: true, ...extra })

    const fontLabel = FONT_LABELS[settings.fontFamily] ?? settings.fontFamily
    const lineLabel = settings.lineHeight.toFixed(2)
    const paraLabel = settings.paragraphGap.toFixed(1)

    return [
      {
        label: '剪贴板',
        launcher: true,
        rows: [
          [
            {
              id: 'paste',
              kind: 'big',
              icon: <IconPaste />,
              label: '粘贴',
              menu: true,
              disabled: true,
              title: '粘贴（只读演示文稿，没有可粘贴的位置）',
            },
            {
              id: 'clip',
              kind: 'column',
              items: [
                off('cut', <IconScissors />, '剪切', '剪切（只读）', { menu: true }),
                cell('copy', <IconCopy />, `复制这一张上的字（第 ${activeIndex} 张）`, {
                  label: '复制',
                  disabled: !active,
                  onClick: copySlide,
                }),
                off('brush', <IconBrush />, '格式刷', '格式刷（只读）', { menu: true }),
              ],
            },
          ],
        ],
      },
      {
        label: '幻灯片',
        rows: [
          [
            {
              id: 'new-slide',
              kind: 'big',
              icon: <IconNewSlide />,
              label: (
                <>
                  新建
                  <br />
                  幻灯片
                </>
              ),
              menu: true,
              disabled: true,
              title: '新建幻灯片（张数是按这一章的段落切出来的，见 lib/slide.ts）',
            },
            {
              id: 'slide-ops',
              kind: 'column',
              items: [
                cell('layout', <IconLayout />, '版式：标题 + 内容（按这一章的段落自动分页）', {
                  label: '版式',
                  menu: true,
                  disabled: true,
                }),
                off('reset', <IconReset />, '重置', '重置（版式不归读者调）', { menu: true }),
                {
                  id: 'section',
                  kind: 'node',
                  node: (
                    <AppMenu
                      label="节"
                      items={
                        sections.length === 0
                          ? [
                              {
                                label: chapters === undefined ? '正在读目录…' : '这本书只有一章',
                                onSelect: () => undefined,
                              },
                            ]
                          : sections.map((row) => ({
                              label: sectionNameOf(row.label, row.index),
                              checked: row.index === props.chapterIndex,
                              onSelect: () => props.onChapter(row.index),
                            }))
                      }
                      trigger={
                        <span className="mn-ppt__rbitem">
                          <IconSection />
                          <span>节</span>
                          <IconChevron className="mn-rb__caret-icon" />
                        </span>
                      }
                    />
                  ),
                },
              ],
            },
          ],
        ],
      },
      {
        label: 'OfficePLUS',
        rows: [
          [
            tile('ai', <IconAiHelper />, 'AI 助手', 'AI 助手（这个外壳里没有）', { disabled: true }),
            tile('tpl', <IconTemplateDoc />, '模板', '模板（这个外壳里没有）', { disabled: true }),
            tile('single', <IconSinglePage />, '单页', '单页（这个外壳里没有）', { disabled: true }),
            tile('fontlib', <IconFontTile />, '字体', '字体库（这个外壳里没有）', {
              menu: true,
              disabled: true,
            }),
          ],
        ],
      },
      {
        label: '字体',
        launcher: true,
        rows: [
          [
            {
              id: 'font',
              kind: 'node',
              node: (
                <AppMenu
                  label={`字体：${fontLabel}`}
                  trigger={
                    <span className="mn-ppt__cbo mn-ppt__cbo--font">
                      <span className="mn-ppt__cbo-value">{fontLabel}</span>
                      <IconChevron className="mn-ppt__cbo-caret" />
                    </span>
                  }
                  items={FONT_ORDER.map((id) => ({
                    label: FONT_LABELS[id],
                    checked: settings.fontFamily === id,
                    onSelect: () => onSettingsChange({ fontFamily: id }),
                  }))}
                />
              ),
            },
            {
              id: 'size',
              kind: 'node',
              node: (
                <AppMenu
                  label="字号"
                  trigger={
                    <span className="mn-ppt__cbo mn-ppt__cbo--size" title={`字号：${settings.fontSize}`}>
                      <span className="mn-ppt__cbo-value">{settings.fontSize}</span>
                      <IconChevron className="mn-ppt__cbo-caret" />
                    </span>
                  }
                  items={FONT_SIZES.map((size) => ({
                    label: String(size),
                    checked: settings.fontSize === size,
                    onSelect: () => onSettingsChange({ fontSize: size }),
                  }))}
                />
              ),
            },
            cell('grow', <IconFontGrow />, '增大字号', {
              kind: 'icon',
              disabled: settings.fontSize >= 34,
              onClick: () => nudgeFont(1),
            }),
            cell('shrink', <IconFontShrink />, '缩小字号', {
              kind: 'icon',
              disabled: settings.fontSize <= 12,
              onClick: () => nudgeFont(-1),
            }),
            { id: 'f0', kind: 'rule' },
            off('clear', <IconClearFormat />, '', '清除格式（只读）', { kind: 'icon' }),
          ],
          [
            { id: 'bold', kind: 'text', icon: 'B', title: '加粗（正文的粗细不归读者调）', disabled: true },
            { id: 'italic', kind: 'text', icon: 'I', title: '斜体（只读）', disabled: true },
            { id: 'underline', kind: 'text', icon: 'U', title: '下划线（只读）', disabled: true },
            { id: 'strike', kind: 'text', icon: 'S', title: '删除线（只读）', disabled: true },
            { id: 'spacing', kind: 'icon', icon: <IconCharSpacing />, disabled: true, title: '字符间距（只读）' },
            { id: 'effects', kind: 'icon', icon: <IconTextEffects />, disabled: true, title: '文本效果（只读）' },
            { id: 'case', kind: 'text', icon: 'Aa', menu: true, disabled: true, title: '更改大小写（只读）' },
            { id: 'f1', kind: 'rule' },
            { id: 'highlight', kind: 'icon', icon: <IconHighlight />, menu: true, disabled: true, title: '文本突出显示颜色（只读）' },
            { id: 'color', kind: 'icon', icon: <IconFontColor />, menu: true, disabled: true, title: '字体颜色（只读）' },
          ],
        ],
      },
      {
        label: '段落',
        launcher: true,
        rows: [
          [
            { id: 'bullets', kind: 'icon', icon: <IconBullets />, menu: true, disabled: true, title: '项目符号（幻灯片上的短横是版式画的）' },
            { id: 'numbering', kind: 'icon', icon: <IconNumbering />, menu: true, disabled: true, title: '编号（只读）' },
            { id: 'multi', kind: 'icon', icon: <IconMultilevelList />, menu: true, disabled: true, title: '多级列表（只读）' },
            { id: 'p1', kind: 'rule' },
            off('indent-cut', <IconIndentLeft />, '', '减少列表级别（只读）', { kind: 'icon' }),
            off('indent-add', <IconIndentRight />, '', '增加列表级别（只读）', { kind: 'icon' }),
            { id: 'p2', kind: 'rule' },
            {
              id: 'line-spacing',
              kind: 'node',
              node: (
                <AppMenu
                  label={`行距：${lineLabel}`}
                  trigger={
                    <span className="mn-ppt__rbitem" title={`行距：${lineLabel}`}>
                      <IconLineSpacing />
                      <IconChevron className="mn-rb__caret-icon" />
                    </span>
                  }
                  items={LINE_STEPS.map((step) => ({
                    label: step.toFixed(2),
                    checked: Math.abs(settings.lineHeight - step) < 0.01,
                    onSelect: () => onSettingsChange({ lineHeight: step }),
                  }))}
                />
              ),
            },
          ],
          [
            {
              id: 'align-left',
              kind: 'icon',
              icon: <IconAlignLeft />,
              active: settings.align === 'left',
              title: '左对齐',
              onClick: () => onSettingsChange({ align: 'left' }),
            },
            {
              id: 'align-center',
              kind: 'icon',
              icon: <IconAlignCenter />,
              disabled: true,
              title: '居中（幻灯片上的字只有左对齐与两端对齐两种）',
            },
            {
              id: 'align-right',
              kind: 'icon',
              icon: <IconAlignRight />,
              disabled: true,
              title: '右对齐（幻灯片上的字只有左对齐与两端对齐两种）',
            },
            {
              id: 'align-justify',
              kind: 'icon',
              icon: <IconAlignJustify />,
              active: settings.align === 'justify',
              title: '两端对齐',
              onClick: () => onSettingsChange({ align: 'justify' }),
            },
            { id: 'align-dist', kind: 'icon', icon: <IconAlignDistribute />, disabled: true, title: '分散对齐（只读）' },
            { id: 'p3', kind: 'rule' },
            {
              id: 'para-gap',
              kind: 'node',
              node: (
                <AppMenu
                  label={`段间距：${paraLabel}`}
                  trigger={
                    <span className="mn-ppt__rbitem" title={`段间距：${paraLabel}`}>
                      <span className="mn-ppt__rbitem-text">段</span>
                      <IconChevron className="mn-rb__caret-icon" />
                    </span>
                  }
                  items={PARA_STEPS.map((step) => ({
                    label: step === 0 ? '无' : step.toFixed(1),
                    checked: Math.abs(settings.paragraphGap - step) < 0.01,
                    onSelect: () => onSettingsChange({ paragraphGap: step }),
                  }))}
                />
              ),
            },
          ],
        ],
      },
      {
        label: '绘图',
        launcher: true,
        rows: [
          [
            {
              id: 'shapes',
              kind: 'node',
              node: (
                <button
                  type="button"
                  className="mn-ppt__gallery"
                  disabled
                  title="形状库（只读演示文稿里插不进形状）"
                >
                  <ShapeGallery />
                </button>
              ),
            },
            tile('arrange', <IconArrange />, '排列', '排列（只读）', { disabled: true, menu: true }),
            tile('quick-style', <IconQuickStyles />, '快速样式', '快速样式（只读）', { disabled: true, menu: true }),
            { id: 'd1', kind: 'rule' },
            {
              id: 'shape-ops',
              kind: 'column',
              items: [
                off('fill', <IconShapeFill />, '形状填充', '形状填充（只读）', { menu: true }),
                off('outline', <IconShapeOutline />, '形状轮廓', '形状轮廓（只读）', { menu: true }),
                off('effects', <IconShapeEffects />, '形状效果', '形状效果（只读）', { menu: true }),
              ],
            },
          ],
        ],
      },
      {
        label: '编辑',
        rows: [
          [
            {
              id: 'edit-ops',
              kind: 'column',
              items: [
                cell('find', <IconSearch />, '查找（在本章里找）', {
                  label: '查找',
                  onClick: () => searchRef.current?.focus(),
                }),
                off('replace', <IconReplace />, '替换', '替换（只读）', { menu: true }),
                off('select', <IconSelectCursor />, '选择', '选择（只读）', { menu: true }),
              ],
            },
          ],
        ],
      },
      {
        label: '加载项',
        rows: [
          [
            tile(
              'addin',
              <IconAddinGrid />,
              <>
                加
                <br />
                载项
              </>,
              '加载项（这个外壳里没有）',
              { disabled: true },
            ),
          ],
        ],
      },
      {
        label: 'PDF工具箱',
        rows: [
          [
            tile('pdf', <IconPdfConvert />, 'PDF转换', 'PDF转换（这个外壳里没有）', {
              menu: true,
              disabled: true,
            }),
          ],
        ],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    activeIndex,
    chapters,
    sections,
    settings.align,
    settings.fontFamily,
    settings.fontSize,
    settings.lineHeight,
    settings.paragraphGap,
    props.chapterIndex,
  ])

  /**
   * 视图页签。四组照 PowerPoint 的视图页签摆：演示文稿视图 / 显示 / 显示比例 / 窗口。
   *
   * 哪几格是真的：普通与幻灯片浏览（两种视图）、备注（画布下面那条备注带）、
   * 幻灯片放映（全屏）、缩略图栏、网格线（工作区上那层格线）、缩放下拉与
   * 「适应幻灯片」（把字号调回这套主题的预设）、全屏、摸鱼模式。
   * 灰的是阅读视图以外的三个（这一屏里用全屏看）、标尺、分页预览那几样。
   */
  const viewGroups = useMemo<RibbonGroup[]>(() => {
    const mode = (
      id: string,
      icon: ReactNode,
      label: string,
      on: boolean,
      run: () => void,
      title: string,
    ): RibbonItem => ({
      id,
      kind: 'stack',
      icon,
      label,
      active: on,
      title,
      onClick: run,
    })
    const pct = Math.round((settings.fontSize / 16) * 100)

    return [
      {
        label: '演示文稿视图',
        rows: [
          [
            mode('normal', <IconPptNormal />, '普通', view === 'normal', () => setView('normal'), '普通视图（一次一张，左边是缩略图栏）'),
            mode('sorter', <IconSlideSorter />, '幻灯片浏览', view === 'sorter', () => setView('sorter'), '幻灯片浏览（一屏好几张）'),
            mode('notes', <IconNotes />, '备注', notesOpen, () => setNotesOpen((on) => !on), notesOpen ? '收起备注层' : '展开备注层（这一张上的字）'),
            mode('reading', <IconReadView />, '阅读视图', reading, toggleReading, reading ? '退出阅读视图' : '阅读视图（整窗只剩幻灯片，Esc 退出）'),
            mode('show', <IconSlideshow />, '幻灯片放映', false, toggleFullscreen, '幻灯片放映（把窗口全屏，一张张贴着读）'),
          ],
        ],
      },
      {
        label: '显示',
        rows: [
          [
            mode('rail', <IconLayout />, '缩略图栏', railOpen, toggleRail, railOpen ? '收起左侧缩略图栏' : '展开左侧缩略图栏'),
            { id: 'ruler', kind: 'stack', icon: <IconRuler />, label: '标尺', disabled: true, title: '标尺（这个外壳里没有）' },
            { id: 'guides', kind: 'stack', icon: <IconShapeOutline />, label: '参考线', disabled: true, title: '参考线（这个外壳里没有）' },
          ],
        ],
      },
      {
        label: '显示比例',
        rows: [
          [
            {
              id: 'zoom-label',
              kind: 'node',
              node: (
                <span className="mn-rb__static" aria-hidden>
                  <span className="mn-rb__label">缩放:</span>
                </span>
              ),
            },
            {
              id: 'zoom',
              kind: 'node',
              node: (
                <AppMenu
                  label="缩放"
                  trigger={
                    <span className="mn-ppt__cbo mn-ppt__cbo--zoom" title={`缩放：${pct}%`}>
                      <span className="mn-ppt__cbo-value">{pct}%</span>
                      <IconChevron className="mn-ppt__cbo-caret" />
                    </span>
                  }
                  items={FONT_SIZES.map((size) => ({
                    label: `${Math.round((size / 16) * 100)}%`,
                    checked: settings.fontSize === size,
                    onSelect: () => onSettingsChange({ fontSize: size }),
                  }))}
                />
              ),
            },
            {
              id: 'fit',
              kind: 'stack',
              icon: <IconSlideSorter />,
              label: '适应幻灯片',
              disabled: settings.fontSize === 18,
              title: '适应幻灯片（字号调回这套主题的预设 18）',
              onClick: () => onSettingsChange({ fontSize: 18 }),
            },
          ],
        ],
      },
      {
        label: '窗口',
        rows: [
          [
            mode('fullscreen', <IconSlideshow />, '全屏', false, toggleFullscreen, '全屏'),
            // 摸鱼不露字（用户要求）：纯图标，点一下调暗幻灯片，悬停有说明
            {
              id: 'dim',
              kind: 'icon',
              icon: <IconNotes />,
              active: props.dimOn,
              title: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗幻灯片）',
              onClick: props.onToggleDim,
            },
          ],
        ],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, notesOpen, reading, railOpen, props.dimOn, props.onToggleDim, settings.fontSize])

  const tabs: RibbonTab[] = PPT_TABS.map((item) =>
    item.id === 'home'
      ? { id: item.id, label: item.label, groups: homeGroups }
      : item.id === 'view'
        ? { id: item.id, label: item.label, groups: viewGroups }
        : { id: item.id, label: item.label, disabled: item.disabled },
  )

  /* ---- 左边那一栏：这一章的幻灯片缩略图 ---- */
  const rail = (
    <div className="mn-office__side-inner">
      <div className="mn-office__side-list mn-ppt__rail">
        {slides.map((slide) => (
          <button
            key={slide.index}
            type="button"
            className={cx('mn-ppt__thumb', slide.index === activeIndex && 'is-active')}
            title={slide.title}
            aria-current={slide.index === activeIndex}
            onClick={() => goToSlide(slide.index)}
          >
            <span className="mn-ppt__thumb-num">{slide.index}</span>
            <span className="mn-ppt__thumb-canvas">
              <span className="mn-ppt__thumb-scale">
                <SlideCard slide={slide} thumb />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <OfficeFrame
      fileName={`${fileNameFor('slide', book.title)} - PowerPoint`}
      avatar={avatarOf(book.author)}
      brand={<IconPptMark className="mn-office__brand-icon" />}
      titleTools={
        <>
          {/* 本地文件的改动本来就落在这台设备上，没有要同步的云——所以这个开关
              是灰的，而且停在「关」：截图里的 PowerPoint 也是关着的 */}
          <span className="mn-office__autosave" title="自动保存（本地文件不上云，没有要同步的东西）">
            自动保存
            <span className="mn-office__switch" aria-hidden>
              <span className="mn-office__switch-knob" />
              关
            </span>
          </span>
          <button type="button" className="mn-office__title-btn" disabled title="保存（只读演示文稿，没有要保存的改动）">
            <IconSaveFloppy className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="撤销（没有可撤销的操作）">
            <IconUndo className="h-[18px] w-[18px]" />
            <span className="mn-office__title-caret" aria-hidden>
              <IconChevron className="h-2 w-2" />
            </span>
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="重做（没有可重做的操作）">
            <IconRedo className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            className="mn-office__title-btn"
            title="幻灯片放映（把窗口全屏，一张张贴着读）"
            onClick={toggleFullscreen}
          >
            <IconSlideshow className="h-[18px] w-[18px]" />
          </button>
        </>
      }
      titleCenter={
        <div className="mn-psearch">
          <IconSearch className="mn-psearch__icon" />
          <input
            ref={searchRef}
            value={query}
            placeholder="搜索"
            aria-label="在本章里查找"
            title="在本章里查找"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                stepHit(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') {
                setQuery('')
                searchRef.current?.blur()
              }
            }}
          />
          {query.trim() ? (
            <>
              <span className="mn-psearch__count">
                {hit.total ? `${hit.at}/${hit.total}` : '没有匹配'}
              </span>
              <button
                type="button"
                className="mn-psearch__btn"
                disabled={hit.total === 0}
                title="上一处"
                onClick={() => stepHit(-1)}
              >
                <IconChevron className="h-3.5 w-3.5 rotate-180" />
              </button>
              <button
                type="button"
                className="mn-psearch__btn"
                disabled={hit.total === 0}
                title="下一处"
                onClick={() => stepHit(1)}
              >
                <IconChevron className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="mn-psearch__btn" title="清空" onClick={() => setQuery('')}>
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      }
      titleAlert={
        <button type="button" className="mn-office__alert" disabled title="升级计划（本地文件用不上云服务）">
          <span aria-hidden>◇</span>
          升级计划
        </button>
      }
      tabActions={
        <>
          <button type="button" className="mn-office__tabbtn mn-office__tabbtn--icon" disabled title="批注（这个外壳里没有）">
            <IconComment className="h-4 w-4" />
          </button>
          <button type="button" className="mn-office__share" disabled title="本地文件没有分享这回事">
            <IconShare className="h-4 w-4" />
            共享
            <IconChevron className="h-3 w-3" />
          </button>
        </>
      }
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      onBack={props.onBack}
      side={rail}
      sideOpen={railOpen && !reading}
      statusLeft={
        <>
          <StatusText title="这一章切出来的幻灯片总数">
            {slideStatusText(activeIndex, slides.length)}
          </StatusText>
          <StatusText className="max-sm:hidden" title="一章就是一节">
            节 {props.chapterIndex + 1}/{props.chapterCount}
          </StatusText>
          <StatusText className="max-lg:hidden" title="这一章的字数">
            {formatChars(props.chapterChars ?? 0)}
          </StatusText>
          <StatusText className="max-sm:hidden">简体中文(中国大陆)</StatusText>
        </>
      }
      statusRight={
        <>
          <StatusText title="已读">{formatPercent(props.percent)}</StatusText>
          <span className="mn-ppt__views">
            <StatusButton
              title={notesOpen ? '收起备注' : '展开备注（这一张上的字）'}
              active={notesOpen}
              onClick={() => setNotesOpen((on) => !on)}
            >
              <IconNotes className="mn-office__status-icon" />
              备注
            </StatusButton>
            <StatusButton
              title="普通视图（一次一张）"
              active={view === 'normal'}
              onClick={() => setView('normal')}
            >
              <IconPptNormal className="mn-office__status-icon" />
            </StatusButton>
            <StatusButton
              title="幻灯片浏览（一屏好几张）"
              active={view === 'sorter'}
              onClick={() => setView('sorter')}
            >
              <IconSlideSorter className="mn-office__status-icon" />
            </StatusButton>
            <StatusButton
              title={reading ? '退出阅读视图（Esc）' : '阅读视图（整窗只剩幻灯片）'}
              active={reading}
              onClick={toggleReading}
            >
              <IconReadView className="mn-office__status-icon" />
            </StatusButton>
            <StatusButton title="幻灯片放映（全屏）" onClick={toggleFullscreen}>
              <IconSlideshow className="mn-office__status-icon" />
            </StatusButton>
          </span>
        </>
      }
      zoom={settings.fontSize}
      zoomRange={[12, 34]}
      onZoom={(value) => onSettingsChange({ fontSize: value })}
      onOpenSettings={props.onOpenSettings}
      dim={props.dim}
      dimOn={props.dimOn}
      onToggleDim={props.onToggleDim}
      immersive={reading}
      escLocal={reading}
    >
      {/* 幻灯片由 ReaderView 贴着排（它管着滚动与进度），外壳只画框。
          mn-veil：摸鱼模式的黑纱盖在幻灯片区上（缩略图栏、备注带与状态栏不动） */}
      <div
        ref={bodyRef}
        className="mn-ppt__body mn-veil"
        data-view={view}
      >
        {props.children}
        {reading ? (
          <>
            <button
              type="button"
              className="mn-ppt__exit"
              onClick={toggleReading}
              title="退出阅读视图（Esc）"
            >
              <IconClose className="h-4 w-4" />
              关闭
            </button>
            <button
              type="button"
              className="mn-ppt__nav mn-ppt__nav--prev"
              disabled={activeIndex <= 1}
              onClick={() => goToSlide(activeIndex - 1)}
              title="上一张"
            >
              <IconChevron className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              className="mn-ppt__nav mn-ppt__nav--next"
              disabled={activeIndex >= slides.length}
              onClick={() => goToSlide(activeIndex + 1)}
              title="下一张"
            >
              <IconChevron className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {/* 画布下面那条备注带：收起时一行（截图里那个位置），点一下摊开 */}
      <div className={cx('mn-ppt__notes', notesOpen && 'is-open')}>
        <button
          type="button"
          className="mn-ppt__notes-bar"
          aria-expanded={notesOpen}
          title={notesOpen ? '收起备注' : '展开备注（这一张上的字）'}
          onClick={() => setNotesOpen((on) => !on)}
        >
          <span className="mn-ppt__notes-text">
            {active?.notes ? active.notes.split('\n')[0] : '这一张没有备注'}
          </span>
          <span className={cx('mn-ppt__notes-fold', notesOpen && 'is-open')} aria-hidden>
            <IconChevron className="h-3 w-3" />
          </span>
        </button>
        {notesOpen ? (
          <div className="mn-ppt__notes-body">
            {active?.notes ? (
              active.notes.split('\n').map((line, index) => <p key={index}>{line}</p>)
            ) : (
              <p className="mn-ppt__notes-empty">这一张没有备注</p>
            )}
          </div>
        ) : null}
      </div>
    </OfficeFrame>
  )
}

/** 幻灯片的版心：编辑视图里那一张 16:9 的画布，2026-09-24 从截图上量的（1320×743） */
const SLIDE_W = 1320
const SLIDE_H = 743
/** 画布四周留的那一圈（幻灯片按 16:9 塞进剩下来的地方） */
const STAGE_PAD = 18
/** 浏览视图里两张之间那条缝 */
const SORTER_GAP = 22

/**
 * 形状库那一格。
 *
 * 真 PowerPoint 的绘图组里挂着一个小画廊：三行形状 + 右边一条滚动条。
 * 这个外壳里插不进形状，所以整格是灰的（外面那个 button 是 disabled），
 * 里面的形状只是**这一格的画**——不接事件，也不假装能点。
 */
const SHAPE_GLYPHS: Array<[string, ReactNode]> = [
  [
    'textbox',
    <>
      <rect x="3.4" y="5" width="17.2" height="14" rx="1" strokeDasharray="3 2.2" strokeWidth="1.4" />
      <path d="M6.6 15.6 10.4 8l3.8 7.6M7.9 13.2h5" strokeWidth="1.4" />
    </>,
  ],
  [
    'textbox2',
    <>
      <rect x="3.4" y="5" width="17.2" height="14" rx="1" strokeDasharray="3 2.2" strokeWidth="1.4" />
      <path d="M6.4 9.6h4.6M6.4 15.6l2.6-5.4M6.4 15.6h5.4" strokeWidth="1.4" />
    </>,
  ],
  ['line', <path d="M4.4 18.4 19.6 5.6" strokeWidth="1.6" />],
  ['arrow', <path d="M4.4 6.4 19.6 17.6M19.6 17.6l-2.2-3.2M19.6 17.6l-3.6.6" strokeWidth="1.6" />],
  ['rect', <rect x="4.4" y="7.4" width="15.2" height="9.6" rx="1" strokeWidth="1.6" />],
  ['ellipse', <ellipse cx="12" cy="12.4" rx="7.6" height="0" ry="5.2" strokeWidth="1.6" />],
  ['roundrect', <rect x="4" y="7.4" width="16" height="9.6" rx="4" strokeWidth="1.6" />],
  ['triangle', <path d="M12 5.6 19.4 19H4.6z" strokeWidth="1.6" />],
  ['bend', <path d="M5 17.4V9.6a4 4 0 0 1 4-4h5.6" strokeWidth="1.6" />],
  ['bendArrow', <path d="M5 17.4V9.6a4 4 0 0 1 4-4h5.6M14.6 3.6l2.6 2-2.6 2" strokeWidth="1.6" />],
  ['arrowRight', <path d="M4.4 7.4h10.4v-3l5.8 6-5.8 6v-3H4.4z" strokeWidth="1.5" />],
  ['arrowDown', <path d="M8.6 4.6h6.8v8h3l-6.4 6.8L5.6 12.6h3z" strokeWidth="1.5" />],
  ['arc', <path d="M5 18.4a9 9 0 0 1 14-7" strokeWidth="1.6" />],
  ['squiggle', <path d="M6 18.4c0-4 3-4.6 3-8.4 0-2.4-3-2.6-3-.2" strokeWidth="1.5" />],
  ['curve', <path d="M4.6 17.4c2.6-8.6 12.4-9.4 14.8.6" strokeWidth="1.5" />],
  ['wave', <path d="M5 15.4c2-3 5.4-3 7.4 0s5.4 3 7.4 0" strokeWidth="1.5" />],
  ['braceOpen', <path d="M13.4 4.6c-4 0-2 7.4-6.6 7.4 4.6 0 2.6 7.4 6.6 7.4" strokeWidth="1.5" />],
  ['braceClose', <path d="M10.6 4.6c4 0 2 7.4 6.6 7.4-4.6 0-2.6 7.4-6.6 7.4" strokeWidth="1.5" />],
]

function ShapeGallery() {
  return (
    <span className="mn-ppt__gallery-inner" aria-hidden>
      {SHAPE_GLYPHS.map(([id, glyph]) => (
        <span key={id} className="mn-ppt__gallery-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            {glyph}
          </svg>
        </span>
      ))}
      <span className="mn-ppt__gallery-strip">
        <IconChevron className="h-2.5 w-2.5" />
      </span>
    </span>
  )
}
