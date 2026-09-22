import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ReaderBottomBar } from '../components/reader/ReaderBottomBar'
import { ReaderTopBar } from '../components/reader/ReaderTopBar'
import { ReaderView } from '../components/reader/ReaderView'
import { SettingsPanel } from '../components/reader/SettingsPanel'
import { TocPanel } from '../components/reader/TocPanel'
import { Button } from '../components/ui/Button'
import { saveProgress } from '../db/books'
import { useBook } from '../hooks/useBooks'
import { useChapter, warmNeighbours } from '../hooks/useChapter'
import { useChapterHtml } from '../hooks/useChapterHtml'
import { useHotkeys } from '../hooks/useHotkeys'
import { useScopedTheme, useUserCss } from '../hooks/useTheme'
import { bookPercent, clamp01, locateByPercent } from '../lib/progress'
import { resolveSettings, settingsToVars, useSettings } from '../store/settings'

/** 工具栏自动隐藏的等待时间 */
const CHROME_TIMEOUT = 3200

export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const book = useBook(bookId)

  const globalSettings = useSettings((state) => state.global)
  const perBook = useSettings((state) => state.perBook)
  const updateGlobal = useSettings((state) => state.update)
  const updateForBook = useSettings((state) => state.updateForBook)
  const setPerBookEnabled = useSettings((state) => state.setPerBookEnabled)

  const [chapterIndex, setChapterIndex] = useState<number | null>(null)
  const [ratio, setRatio] = useState(0)
  const [entryRatio, setEntryRatio] = useState(0)
  const [pendingFragment, setPendingFragment] = useState('')
  const [chromeVisible, setChromeVisible] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const perBookStyle = bookId ? perBook[bookId] : undefined
  const perBookEnabled = perBookStyle?.enabled ?? false
  const settings = useMemo(
    () => resolveSettings(globalSettings, perBookStyle),
    [globalSettings, perBookStyle],
  )

  // 这本书可能开了独立主题；离开阅读器要还原成全局主题，否则书架会带着阅读主题
  useScopedTheme(settings.themeId, globalSettings.themeId)
  useUserCss(settings.userCss)

  // 设置写进阅读器容器的 CSS 变量。改字号只是写一个属性，
  // 正文 DOM 不动——这也是为什么变量挂在容器上而不是逐元素内联样式
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    for (const [name, value] of Object.entries(settingsToVars(settings))) {
      element.style.setProperty(name, value)
    }
  }, [settings])

  // 首次进入：接着上次读到的地方
  useEffect(() => {
    if (chapterIndex !== null || !book) return
    const start = book.progress?.chapterIndex ?? 0
    const clamped = Math.max(0, Math.min(book.chapterCount - 1, start))
    setChapterIndex(clamped)
    setEntryRatio(book.progress?.ratio ?? 0)
    setRatio(book.progress?.ratio ?? 0)
  }, [book, chapterIndex])

  const chapter = useChapter(bookId, chapterIndex)
  const html = useChapterHtml(bookId, chapter)

  // 邻章读进页缓存，让「下一章」快一点
  useEffect(() => {
    if (!bookId || chapterIndex === null || !book) return
    void warmNeighbours(bookId, chapterIndex, book.chapterCount)
  }, [bookId, chapterIndex, book])

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
    // 往回翻停在上一章末尾，和纸质书往回翻的直觉一致
    goToChapter(chapterIndex - 1, 1)
  }, [chapterIndex, goToChapter])

  /**
   * 跳转目标可能是别的章节（脚注、内部链接）。
   * 先切章，把锚点记下来交给新章去滚——同章锚点则只记锚点。
   */
  const handleJump = useCallback(
    (index: number, fragment: string) => {
      if (Number.isNaN(index)) return
      setPendingFragment(fragment)
      if (index !== chapterIndex) goToChapter(index, 0)
      setChromeVisible(false)
    },
    [chapterIndex, goToChapter],
  )

  const handleFragmentHandled = useCallback(() => setPendingFragment(''), [])

  // ---- 进度持久化 ----
  const progressRef = useRef({ chapterIndex: 0, ratio: 0 })
  progressRef.current = { chapterIndex: chapterIndex ?? 0, ratio }

  useEffect(() => {
    if (!bookId || chapterIndex === null) return
    // 滚动时 ratio 每 100ms 变一次，这个定时器会一直被推迟，
    // 于是真正的写库发生在「停下来 1 秒之后」
    const timer = window.setTimeout(() => {
      void saveProgress(bookId, { chapterIndex, ratio, updatedAt: Date.now() })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [bookId, chapterIndex, ratio])

  useEffect(() => {
    if (!bookId) return
    const flush = () => {
      const snapshot = progressRef.current
      void saveProgress(bookId, { ...snapshot, updatedAt: Date.now() })
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

  // ---- 工具栏自动隐藏 ----
  useEffect(() => {
    if (!chromeVisible || tocOpen || settingsOpen) return
    const timer = window.setTimeout(() => setChromeVisible(false), CHROME_TIMEOUT)
    return () => window.clearTimeout(timer)
  }, [chromeVisible, tocOpen, settingsOpen])

  // ---- 快捷键 ----
  useHotkeys(
    (event) => {
      switch (event.key) {
        case 't':
        case 'T':
          setTocOpen((open) => !open)
          return
        case 's':
        case 'S':
          setSettingsOpen((open) => !open)
          return
        case 'Escape':
          setTocOpen(false)
          setSettingsOpen(false)
          return
        case 'f':
        case 'F':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen()
          return
        default:
          return
      }
    },
    [],
  )

  const handleSeek = useCallback(
    (percent: number) => {
      if (!book) return
      const located = locateByPercent(book, percent)
      goToChapter(located.chapterIndex, located.ratio)
    },
    [book, goToChapter],
  )

  const handleSettingsChange = useCallback(
    (patch: Parameters<typeof updateGlobal>[0]) => {
      if (!bookId) return
      // 开着独立设置时改的是这本书；否则改全局，并且把它标成「已独立」不合适，
      // 所以只有真的开着独立设置才写到 perBook 里
      if (perBookEnabled) updateForBook(bookId, patch)
      else updateGlobal(patch)
    },
    [bookId, perBookEnabled, updateForBook, updateGlobal],
  )

  if (book === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center text-[13px] text-fg-faint">
        正在打开…
      </div>
    )
  }

  if (book === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-fg">
        <p className="text-[14px]">这本书找不到了</p>
        <Button variant="outline" onClick={() => void navigate('/')}>
          回书架
        </Button>
      </div>
    )
  }

  if (book.state !== 'ready') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-fg">
        <p className="text-[14px]">
          {book.state === 'importing' ? '这本书还在导入，等一会儿再打开' : '这本书没能解析成功'}
        </p>
        {book.error ? <p className="max-w-sm text-[12.5px] text-fg-muted">{book.error}</p> : null}
        <Button variant="outline" onClick={() => void navigate('/')}>
          回书架处理
        </Button>
      </div>
    )
  }

  const percent =
    chapterIndex === null ? 0 : bookPercent(book, chapterIndex, ratio)

  return (
    <div
      ref={containerRef}
      className="relative h-dvh overflow-hidden bg-reader-bg text-reader-fg"
    >
      {chapterIndex === null ? (
        <div className="flex h-full items-center justify-center text-[13px] text-reader-fg-muted">
          正在打开…
        </div>
      ) : (
        <ReaderView
          html={html}
          contentKey={`${bookId}:${chapterIndex}`}
          settings={settings}
          entryRatio={entryRatio}
          hasPrev={chapterIndex > 0}
          hasNext={chapterIndex < book.chapterCount - 1}
          onRatio={setRatio}
          onNext={goNext}
          onPrev={goPrev}
          onJump={handleJump}
          fragment={pendingFragment}
          onFragmentHandled={handleFragmentHandled}
          onTap={() => setChromeVisible((visible) => !visible)}
        />
      )}

      <ReaderTopBar
        visible={chromeVisible}
        pinned={tocOpen || settingsOpen}
        title={book.title}
        chapterTitle={chapter?.title ?? ''}
        onBack={() => void navigate('/')}
        onToc={() => setTocOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <ReaderBottomBar
        visible={chromeVisible || tocOpen || settingsOpen}
        percent={percent}
        chapterIndex={chapterIndex ?? 0}
        chapterCount={book.chapterCount}
        onPrev={goPrev}
        onNext={goNext}
        onSeek={handleSeek}
      />

      <TocPanel
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        bookId={book.id}
        groups={book.groups ?? []}
        currentIndex={chapterIndex ?? 0}
        onSelect={(index) => {
          goToChapter(index, 0)
          setTocOpen(false)
        }}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        perBookEnabled={perBookEnabled}
        onTogglePerBook={(enabled) => {
          if (bookId) setPerBookEnabled(bookId, enabled)
        }}
      />
    </div>
  )
}
