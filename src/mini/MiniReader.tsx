import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IconBack, IconChevronRight } from '../components/ui/icons'
import { saveProgress } from '../db/books'
import { useBook } from '../hooks/useBooks'
import { useChapter } from '../hooks/useChapter'
import { useChapterHtml } from '../hooks/useChapterHtml'
import { bookPercent, clamp01 } from '../lib/progress'
import { formatPercent } from '../lib/format'
import { resolveSettings, settingsToVars, useSettings } from '../store/settings'
import type { ReaderSettings } from '../store/settings'
import { MiniRestoreButton } from './MiniRestoreButton'

interface MiniReaderProps {
  bookId: string
  onBack: () => void
}

/**
 * 小窗的正文：上下滚动读，到章尾就停在章尾——换章用头部那对按钮，
 * 滚轮不做章与章的跳转（阅读设置里的诉求：一直往下滚不该被拽去下一章）。
 *
 * 进度与主阅读器是同一份（saveProgress 写同一张表）：小窗里读到的位置，
 * 回到主窗口接着读时还在；反过来主窗口读过的位置，小窗进书也接着。章内
 * 恢复位置、滚动限流、防「一屏装下整章误报读完」这些规矩都照 ReaderView
 * 的滚动模式来——同一个量（章序号 + 章内比例），只是放在一块更小的地上。
 */
export function MiniReader({ bookId, onBack }: MiniReaderProps) {
  const book = useBook(bookId)
  const global = useSettings((state) => state.global)
  const perBook = useSettings((state) => state.perBook)
  const settings = useMemo<ReaderSettings>(
    () => resolveSettings(global, perBook[bookId]),
    [global, perBook, bookId],
  )

  const [chapterIndex, setChapterIndex] = useState<number | null>(null)
  const [ratio, setRatio] = useState(0)
  const [entryRatio, setEntryRatio] = useState(0)

  const chapter = useChapter(bookId, chapterIndex)
  const { html, key: htmlKey } = useChapterHtml(bookId, chapter)
  // HTML 是这一章的，才允许报进度、判章尾——换章的空档里 DOM 里还是上一章
  const contentReady =
    chapterIndex !== null && htmlKey === `${bookId}:${chapterIndex}`

  // 首次进入接着上次读到的地方
  useEffect(() => {
    if (chapterIndex !== null || !book || book.state !== 'ready') return
    const start = book.progress?.chapterIndex ?? 0
    setChapterIndex(Math.max(0, Math.min(book.chapterCount - 1, start)))
    setEntryRatio(book.progress?.ratio ?? 0)
    setRatio(book.progress?.ratio ?? 0)
  }, [book, chapterIndex])

  const goToChapter = useCallback(
    (index: number, entry = 0) => {
      if (!book) return
      const clamped = Math.max(0, Math.min(book.chapterCount - 1, index))
      setChapterIndex(clamped)
      setEntryRatio(clamp01(entry))
      setRatio(clamp01(entry))
    },
    [book],
  )
  const goNext = useCallback(() => {
    if (chapterIndex === null) return
    goToChapter(chapterIndex + 1, 0)
  }, [chapterIndex, goToChapter])
  const goPrev = useCallback(() => {
    if (chapterIndex === null) return
    // 往回翻停在上一章末尾，和主阅读器一个直觉
    goToChapter(chapterIndex - 1, 1)
  }, [chapterIndex, goToChapter])

  // ---- 排版变量挂容器（与 ReaderPage 同一套机制）----
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!root) return
    for (const [name, value] of Object.entries(settingsToVars(settings))) {
      root.style.setProperty(name, value)
    }
    root.dataset.bilingual = settings.bilingual
  }, [root, settings])

  // ---- 进章恢复位置 ----
  const viewportRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !contentReady) return
    const entry = clamp01(entryRatio)
    let cancelled = false
    let applied = -1
    const timers: number[] = []
    const restore = () => {
      if (cancelled) return
      const max = viewport.scrollHeight - viewport.clientHeight
      if (max === applied) return
      applied = max
      viewport.scrollTop = max > 0 ? max * entry : 0
    }
    // 字体、图片都可能晚一步就位：反复恢复到内容高度稳定为止
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
  }, [contentReady, entryRatio])

  // ---- 进度持久化（与 ReaderPage 同一份表、同一个节流节奏）----
  const progressRef = useRef<{ chapterIndex: number | null; ratio: number }>({
    chapterIndex: null,
    ratio: 0,
  })
  progressRef.current = { chapterIndex, ratio }

  useEffect(() => {
    if (!bookId || chapterIndex === null) return
    const timer = window.setTimeout(() => {
      void saveProgress(bookId, { chapterIndex, ratio, updatedAt: Date.now() })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [bookId, chapterIndex, ratio])

  useEffect(() => {
    if (!bookId) return
    const flush = () => {
      const snapshot = progressRef.current
      if (snapshot.chapterIndex === null) return
      void saveProgress(bookId, {
        chapterIndex: snapshot.chapterIndex,
        ratio: snapshot.ratio,
        updatedAt: Date.now(),
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [bookId])

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || !contentReady) return
    const max = viewport.scrollHeight - viewport.clientHeight
    // max 为 0 不报：一屏装下整章（或版面没就位）时报 1 等于宣布读完
    if (max <= 0) return
    setRatio(clamp01(viewport.scrollTop / max))
  }, [contentReady])

  if (book === undefined) return null

  const gone = book === null
  const hasPrev = !gone && chapterIndex !== null && chapterIndex > 0
  const hasNext =
    !gone && chapterIndex !== null && chapterIndex < book.chapterCount - 1
  const percent = gone || chapterIndex === null ? 0 : bookPercent(book, chapterIndex, ratio)

  return (
    <div ref={setRoot} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
        <button
          type="button"
          aria-label="回书架"
          onClick={onBack}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2 hover:text-fg"
        >
          <IconBack className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">
          {chapter?.title ?? ''}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
          {formatPercent(percent)}
        </span>
        <button
          type="button"
          aria-label="上一章"
          title={hasPrev ? '上一章' : '已经是第一章'}
          disabled={!hasPrev}
          onClick={goPrev}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] enabled:hover:bg-surface-2 enabled:hover:text-fg disabled:opacity-40"
        >
          <IconChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          aria-label="下一章"
          title={hasNext ? '下一章' : '已是最后一章'}
          disabled={!hasNext}
          onClick={goNext}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] enabled:hover:bg-surface-2 enabled:hover:text-fg disabled:opacity-40"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
        <MiniRestoreButton />
      </div>

      <div ref={viewportRef} className="mn-mini__scroll" onScroll={handleScroll}>
        {gone ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-fg-faint">这本书找不到了</p>
        ) : book.state !== 'ready' ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-fg-faint">
            {book.state === 'importing' ? '这本书还在导入，等一会儿再打开' : '这本书没能解析成功'}
          </p>
        ) : (
          // 内容是解析时净化过的（DOMPurify 过了一遍），图片指向本地 ObjectURL，
          // 和主阅读器同一份来源，可以放心 innerHTML
          <article className="mn-content" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  )
}
