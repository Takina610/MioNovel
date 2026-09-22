import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clamp01 } from '../../lib/progress'
import type { ReaderSettings } from '../../store/settings'
import { cx } from '../../lib/cx'

interface ReaderViewProps {
  html: string
  /** 章节标识。变了就重建内容并恢复位置 */
  contentKey: string
  settings: ReaderSettings
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

/**
 * 正文视图。滚动和翻页两种模式共用同一份内容 DOM，只换外层容器的行为。
 *
 * 翻页用 CSS 多列实现：列宽 = 一页宽度，column-gap 为 0，于是「一列 = 一页」，
 * 总页数 = scrollWidth / 列宽，翻页就是给内容做一次 translateX。
 * 不用 epub.js 那套分页，因为它要一个 iframe，而 iframe 恰好是主题变量过不去的墙。
 */
function ReaderViewImpl({
  html,
  contentKey,
  settings,
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
  const contentRef = useRef<HTMLElement>(null)
  const ratioRef = useRef(entryRatio)
  const reportTimer = useRef<number | undefined>(undefined)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(0)

  const paged = settings.pageMode === 'paged'
  const [page, setPage] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [animate, setAnimate] = useState(true)

  // 高频的滚动报告限流到 100ms：进度条不需要更高频率，
  // 而每次 setState 都会重渲染一侧界面
  const reportRatio = useCallback(
    (ratio: number) => {
      ratioRef.current = ratio
      if (reportTimer.current !== undefined) return
      reportTimer.current = window.setTimeout(() => {
        reportTimer.current = undefined
        onRatio(ratioRef.current)
      }, 100)
    },
    [onRatio],
  )

  useEffect(
    () => () => {
      if (reportTimer.current !== undefined) window.clearTimeout(reportTimer.current)
    },
    [],
  )

  // ---- 滚动模式：恢复位置 ----
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || paged) return
    ratioRef.current = clamp01(entryRatio)
    let cancelled = false

    const restore = () => {
      if (cancelled) return
      const max = viewport.scrollHeight - viewport.clientHeight
      viewport.scrollTop = max > 0 ? max * ratioRef.current : 0
    }

    // 反复恢复直到内容真的有高度（字体、图片都可能晚一步就位）。
    // 每次都以 ratioRef 为准，所以重来只会收敛，不会漂移。
    const timers: number[] = []
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
    }
  }, [contentKey, paged, entryRatio])

  // ---- 翻页模式：量页宽、算页数 ----
  /** 返回是否真的量出了一个可用的页宽 */
  const measure = useCallback((): boolean => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content || !paged) return false

    const rawWidth = viewport.clientWidth
    // 容器宽度不可信时（布局还没就位、或者整个视口宽度是 0）直接放弃这一拍。
    // 硬算下去的后果很严重：会被 Math.max 的下限兜成一个极窄的页宽，
    // 正文被切成几十列，页数完全失真。宁可什么都不做，交给上层重试。
    if (rawWidth < 320) return false

    const styles = getComputedStyle(viewport)
    const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    const available = Math.max(160, rawWidth - padding)
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    // 页宽取「可用宽度」和「正文栏宽」的较小值：窄屏上不能让页面横向溢出
    const pageWidth = Math.max(160, Math.min(available, settings.contentWidth * rootFontSize))

    content.style.setProperty('--mn-page-width', `${pageWidth}px`)
    content.style.width = `${pageWidth}px`
    setPageWidth((current) => (current === pageWidth ? current : pageWidth))

    const total = Math.max(1, Math.round(content.scrollWidth / pageWidth))
    setTotalPages((current) => (current === total ? current : total))
    // 位置按比例还原：改字号或转屏之后，读者应该还在原文附近
    const target = Math.round(clamp01(ratioRef.current) * total)
    const next = Math.min(total - 1, Math.max(0, target))
    setPage((current) => (current === next ? current : next))
    return true
  }, [paged, settings.contentWidth])

  useLayoutEffect(() => {
    if (!paged) return
    ratioRef.current = clamp01(entryRatio)
    // 重新测量时别播翻页动画，否则改字号会看到页面在飞
    setAnimate(false)

    // 进入本章后反复测量，直到真的量出页宽为止。
    // 为什么要重试而不是量一次：图片解码、字体就位、乃至容器宽度本身稳定都可能
    // 发生在这之后——实测里重新加载时浏览器会有一段时间把视口宽度报成 0，
    // 那时候量出来的东西全是错的。失败就继续等，成功之后再多量几次让图片和字体
    // 就位后的列数变化收敛。
    // 每次测量都以 ratioRef 为准，所以重来只会收敛到正确位置，不会漂移。
    const timers: number[] = []
    let attempts = 0
    const step = () => {
      const applied = measure()
      attempts++
      if (applied) setAnimate(true)
      // 量不出来就慢一点接着试（视口为 0 可能要等好几秒），
      // 量出来了再多确认几次，然后就收工
      if (attempts < 40) timers.push(window.setTimeout(step, applied ? 200 : 250))
    }
    timers.push(window.setTimeout(step, 0))

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [paged, contentKey, entryRatio, measure])

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
      const next = page + delta
      if (next < 0) {
        onPrev()
        return
      }
      if (next >= totalPages) {
        onNext()
        return
      }
      setAnimate(true)
      setPage(next)
      // 章内进度 = 页序号 / 总页数。
      // 必须同时更新 ratioRef：它是「本章当前位置」的唯一记录，任何重新测量
      // （改字号、转屏、窗口大小变化）都从它还原页码。少了这一行，翻完页再转屏
      // 就会跳回进本章时的位置。
      const nextRatio = clamp01((next + 1) / totalPages)
      ratioRef.current = nextRatio
      onRatio(nextRatio)
    },
    [paged, page, totalPages, onNext, onPrev, onRatio],
  )

  const scrollBy = useCallback((delta: number) => {
    viewportRef.current?.scrollBy({ top: delta, behavior: 'smooth' })
  }, [])

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
        // state 里的值还是上一次渲染的
        const width = content.offsetWidth
        if (width <= 0) return
        const total = Math.max(1, Math.round(content.scrollWidth / width))
        const targetPage = Math.min(total - 1, Math.max(0, Math.round(target.offsetLeft / width)))
        setAnimate(true)
        setPage(targetPage)
        const nextRatio = clamp01((targetPage + 1) / total)
        ratioRef.current = nextRatio
        onRatio(nextRatio)
        return
      }

      const viewport = viewportRef.current
      if (!viewport) return
      const top = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top
      viewport.scrollTop += top - 16
    },
    [paged, onRatio],
  )

  // 跨章跳转（脚注、内部链接）落在新章之后要再走一步锚点。
  // 放在普通 effect 里：useLayoutEffect 已经完成测量和位置恢复，这时候
  // 元素的 offsetLeft / 位置才是算得准的
  useEffect(() => {
    if (!fragment) return
    const timer = window.setTimeout(() => {
      jumpToFragment(fragment)
      onFragmentHandled?.()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fragment, contentKey, jumpToFragment, onFragmentHandled])

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
    if (!viewport) return
    const max = viewport.scrollHeight - viewport.clientHeight
    reportRatio(max > 0 ? clamp01(viewport.scrollTop / max) : 1)
  }

  return (
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
      <article
        ref={contentRef}
        // 内容是解析时净化过的：DOMPurify 过了一遍，脚本/样式/外链样式表都剥掉了，
        // 图片指向本地 ObjectURL。所以这里可以放心用 innerHTML。
        dangerouslySetInnerHTML={{ __html: html + chapterNavHtml(hasPrev, hasNext) }}
        style={paged ? { transform: `translateX(${-page * pageWidth}px)` } : undefined}
        className={cx('mn-content', paged && animate && 'mn-turning')}
      />
    </div>
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
