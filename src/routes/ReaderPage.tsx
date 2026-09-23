import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CodeExplorer, toggleInSet } from '../components/code/CodeExplorer'
import { CodeSearch } from '../components/code/CodeSearch'
import { CodeFrame, CodeShell, CodeStatusItem, type CodeView } from '../components/code/CodeShell'
import { ReaderBottomBar } from '../components/reader/ReaderBottomBar'
import { ReaderTopBar } from '../components/reader/ReaderTopBar'
import { ReaderView } from '../components/reader/ReaderView'
import { SettingsPanel } from '../components/reader/SettingsPanel'
import { TocPanel } from '../components/reader/TocPanel'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { saveProgress } from '../db/books'
import type { BookRecord } from '../db/db'
import { useBook, useBooks } from '../hooks/useBooks'
import { useChapter, warmNeighbours } from '../hooks/useChapter'
import { useChapterHtml } from '../hooks/useChapterHtml'
import { useHotkeys } from '../hooks/useHotkeys'
import { useToc } from '../hooks/useToc'
import { useScopedTheme, useUserCss } from '../hooks/useTheme'
import { bookFolderName, chapterFileName } from '../lib/code'
import {
  decoyCursor,
  decoyFileName,
  decoyFolderName,
  decoySeed,
  decoyStatus,
} from '../lib/decoy'
import { bookPercent, clamp01, locateByPercent } from '../lib/progress'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { useDecoy } from '../store/decoy'
import { resolveSettings, settingsToVars, useSettings } from '../store/settings'
import { chromeOf, getTheme } from '../themes/apply'

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
  // 编辑器形态：侧栏视图、收起状态，以及这次会话里开过的章（标签页）
  const [view, setView] = useState<CodeView>('explorer')
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth >= 768)
  const [openChapters, setOpenChapters] = useState<number[]>([])
  /**
   * 树上展开了哪几本书。就是字面意思的展开状态——不要掺「正在读的那本永远展开」：
   * 那样在阅读器里就永远收不起来当前这本（用户报的就是这个）。
   * 「换书时自动展开新打开的这本」在下面用一次性的 effect 做，见 currentBookId 那段。
   */
  const [pinnedBooks, setPinnedBooks] = useState<ReadonlySet<string>>(() => new Set())

  // 阅读器容器用 state 记而不是 useRef：首次渲染时书还没读出来，容器根本没挂载，
  // 用 ref 的话那一轮写变量的机会就白费了，而且 settings 不变也不会再来第二次——
  // 症状是刷新之后字号、栏宽、双语模式全部退回 CSS 默认值。
  const [readerRoot, setReaderRoot] = useState<HTMLDivElement | null>(null)

  /** 全局「演示模式」开关。Alt+Q 或菜单里切（见 store/decoy） */
  const decoy = useDecoy((state) => state.enabled)
  const decoyId = useDecoy((state) => state.preset)
  const toggleDecoy = useDecoy((state) => state.toggle)

  const perBookStyle = bookId ? perBook[bookId] : undefined
  const perBookEnabled = perBookStyle?.enabled ?? false
  const settings = useMemo(
    () => resolveSettings(globalSettings, perBookStyle),
    [globalSettings, perBookStyle],
  )
  // 形态跟着**这本书生效的**主题走：某本书开了独立主题时，进它的阅读器就换成它的形态
  const chrome = chromeOf(getTheme(settings.themeId))

  // 这本书可能开了独立主题；离开阅读器要还原成全局主题，否则书架会带着阅读主题
  useScopedTheme(settings.themeId, globalSettings.themeId)
  useUserCss(settings.userCss)

  // 进度归我们自己管（章序号 + 章内比例，存在 IndexedDB 里）。
  // 浏览器的滚动位置恢复会拿它记下的偏移量再盖一次，而它记的可能是切模式、
  // 换章之前的陈旧值——两边打架时输的总是读者。让出这条规则：正文位置只由
  // ReaderView 恢复。离开阅读器时还原，免得不必要地影响别的页面。
  useLayoutEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previous
    }
  }, [])

  // 设置写进阅读器容器的 CSS 变量。改字号只是写一个属性，
  // 正文 DOM 不动——这也是为什么变量挂在容器上而不是逐元素内联样式。
  // 用 layout effect：否则首帧会先按 CSS 默认值排一遍，再跳到用户的字号
  useLayoutEffect(() => {
    if (!readerRoot) return
    for (const [name, value] of Object.entries(settingsToVars(settings))) {
      readerRoot.style.setProperty(name, value)
    }
  }, [readerRoot, settings])

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
  const { html, key: htmlKey, resources } = useChapterHtml(bookId, chapter)
  // 书架整份数据：编辑器形态的左侧资源管理器列的是整个书架，不只是当前这本
  const allBooks = useBooks()

  // 标签页和面包屑上写的是章节标题（也当文件名用）。只有编辑器形态用得上，
  // 所以别的形态下给 undefined——那次查询不碰库
  const tocRows = useToc(
    chrome === 'code' ? book?.id : undefined,
    chrome === 'code' ? book?.groups : undefined,
  )
  const titleOfChapter = useCallback(
    (index: number) =>
      tocRows?.find((row) => row.type === 'chapter' && row.index === index)?.label ?? '',
    [tocRows],
  )

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
   * 从资源管理器打开一章。可以是**另一本书**——左侧列的是整个书架，
   * 点别的书的章节就直接换书，不必先退出阅读器。
   * 换书前把目标章写进它的进度：进去就是这一章。
   */
  const openChapterIn = useCallback(
    (target: BookRecord, index: number) => {
      if (target.id === bookId) {
        goToChapter(index, 0)
        return
      }
      void (async () => {
        await saveProgress(target.id, { chapterIndex: index, ratio: 0, updatedAt: Date.now() })
        void navigate(`/read/${target.id}`, { viewTransition: true })
      })()
    },
    [bookId, goToChapter, navigate],
  )

  // 换书时：标签页从头开始（那些章属于上一本），并把这本展开。
  // 展开是**一次性**的：只在这一章的 id 变了（换书、或从别的书点进来）时做，
  // 之后用户自己收起来就不再替他打开——他收起当前这本，多半就是想看别的书。
  const currentBookId = book?.id
  useEffect(() => {
    setOpenChapters([])
    if (!currentBookId) return
    setPinnedBooks((current) =>
      current.has(currentBookId) ? current : new Set([...current, currentBookId]),
    )
  }, [currentBookId])

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

  // 滚动时 ratio 每 100ms 变一次，这里再跟着换一次函数身份，ReaderView 的 memo
  // 就白包了——整棵正文树会跟着进度报告重渲染。所以回调一律做稳定。
  const handleTap = useCallback(() => setChromeVisible((visible) => !visible), [])

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
  // 编辑器形态下没有会收起来的工具栏：标题栏、标签页、状态栏一直在，
  // 那正是这副外壳存在的意义。侧栏的显隐由 t 和活动栏按钮控制。
  useEffect(() => {
    if (chrome === 'code' || !chromeVisible || tocOpen || settingsOpen) return
    const timer = window.setTimeout(() => setChromeVisible(false), CHROME_TIMEOUT)
    return () => window.clearTimeout(timer)
  }, [chrome, chromeVisible, tocOpen, settingsOpen])

  // 这次会话里开过哪些章：标签页就是它们。换个阅读器（换书）就重新开始
  useEffect(() => {
    if (chrome !== 'code' || chapterIndex === null) return
    setOpenChapters((current) =>
      current.includes(chapterIndex) ? current : [...current, chapterIndex].slice(-6),
    )
  }, [chrome, chapterIndex])

  // ---- 快捷键 ----
  useHotkeys(
    (event) => {
      switch (event.key) {
        case 't':
        case 'T':
          // 编辑器形态下 T 是「收起/展开侧栏」，和编辑器里一样
          if (chrome === 'code') setSideOpen((open) => !open)
          else setTocOpen((open) => !open)
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
    [chrome],
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

  // 回书架。和从书架进书一样走一次换页过渡（见 styles/app.css 的 View Transitions）
  const backToShelf = useCallback(() => {
    void navigate('/', { viewTransition: true })
  }, [navigate])

  // 书还没读出来 / 读不出来 / 没能解析：这三种状态在编辑器形态下都长成编辑器，
  // 不摆标识也不写「正在打开」——骨架和真窗口一样，从书架点进来就不会先闪一下
  // 另一个形状的页面（原来是普通形态那套加载页，看着就是「加载了一下」）
  const shellFallback = (message: ReactNode, action?: { label: string; run: () => void }) =>
    chrome === 'code' ? (
      <CodeFrame title={decoy ? 'workspace' : 'MioNovel'}>
        <div className="mn-code-watermark">
          <p className="text-[13px] text-fg-muted">{message}</p>
          {action ? (
            <button
              type="button"
              className="mn-code-side-btn w-auto px-3"
              onClick={action.run}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      </CodeFrame>
    ) : (
      <Screen>
        <p className="text-[13px] text-fg-faint">{message}</p>
        {action ? (
          <Button variant="outline" onClick={action.run}>
            {action.label}
          </Button>
        ) : null}
      </Screen>
    )

  if (book === undefined) {
    // 什么都不写：编辑器打开文件时也不弹提示。书就在本机的库里，这一步通常只有一帧
    return shellFallback('')
  }

  if (book === null) {
    return shellFallback(decoy ? '文件不存在。' : '这本书找不到了', {
      label: decoy ? 'Workspace' : '回书架',
      run: backToShelf,
    })
  }

  if (book.state !== 'ready') {
    return shellFallback(
      decoy
        ? '这个文件暂时打不开。'
        : book.state === 'importing'
          ? '这本书还在导入，等一会儿再打开'
          : '这本书没能解析成功',
      { label: decoy ? 'Workspace' : '回书架处理', run: backToShelf },
    )
  }

  const percent =
    chapterIndex === null ? 0 : bookPercent(book, chapterIndex, ratio)

  const readerView =
    chapterIndex === null ? null : (
      <ReaderView
        html={html}
        htmlKey={htmlKey}
        contentKey={`${bookId}:${chapterIndex}`}
        resources={resources}
        decoySeedValue={decoySeed(book.id, chapterIndex)}
        settings={settings}
        chrome={chrome}
        entryRatio={entryRatio}
        hasPrev={chapterIndex > 0}
        hasNext={chapterIndex < book.chapterCount - 1}
        onRatio={setRatio}
        onNext={goNext}
        onPrev={goPrev}
        onJump={handleJump}
        fragment={pendingFragment}
        onFragmentHandled={handleFragmentHandled}
        onTap={handleTap}
      />
    )

  // ---- 编辑器形态 ----
  if (chrome === 'code') {
    const chapterFile = chapterFileName(chapter?.title ?? '', chapterIndex ?? 0)
    const folder = bookFolderName(book.title)
    const decoySeedValue = decoySeed(book.id, chapterIndex ?? 0)
    const fakeFile = decoy ? decoyFileName(decoyId, decoySeedValue) : chapterFile
    const fakeFolder = decoy ? decoyFolderName(decoyId, book.id) : folder
    const decoyChromeLabel = decoy ? decoyStatus(decoyId) : null
    const cursor = decoyCursor(decoySeedValue)
    return (
      // 阅读设置的变量仍然挂在容器上（和默认形态同一套机制），
      // display: contents 让它只做变量用的载体，不进入排版
      <div ref={setReaderRoot} className="contents">
        <CodeShell
          title={`${decoy ? fakeFile : chapterFile} — ${fakeFolder} — ${decoy ? 'workspace' : 'MioNovel'}`}
          view={view}
          onView={setView}
          sideOpen={sideOpen}
          onToggleSide={() => setSideOpen((open) => !open)}
          sideTitle={view === 'search' ? (decoy ? 'Search' : '搜索') : '资源管理器'}
          side={
            view === 'search' ? (
              <CodeSearch book={book} onOpenChapter={(index) => goToChapter(index, 0)} />
            ) : (
              // 左侧列的是**整个书架**，不只是当前这本：换书、回书架都在同一个地方，
              // 不用先退出阅读器再找
              <CodeExplorer
                books={allBooks ?? []}
                expanded={pinnedBooks}
                // 每本书都可以收起来，包括正在读的这本：展开状态只归用户，
                // 换书时新打开的那本自动展开一次，之后收不收是读者的事
                onToggleBook={(id) => setPinnedBooks((current) => toggleInSet(current, id))}
                onOpenChapter={(target, index) => openChapterIn(target, index)}
                current={{ bookId: book.id, index: chapterIndex ?? 0 }}
                onBackToShelf={backToShelf}
                backLabel={decoy ? 'Workspace Root' : '回书架'}
              />
            )
          }
          menu={[
            { label: decoy ? 'Go to Workspace Root' : '回书架', onSelect: backToShelf },
            {
              label: decoy
                ? sideOpen
                  ? 'View: Hide Side Bar'
                  : 'View: Show Side Bar'
                : sideOpen
                  ? '收起侧栏'
                  : '展开侧栏',
              hint: 'T',
              onSelect: () => setSideOpen((open) => !open),
            },
            {
              // 演示模式的入口。写在菜单里是为了让人知道有这回事——
              // 快捷键记不住，但菜单里看得见（见 SPEC 决定记录 22）
              label: decoy ? 'View: Exit Presentation' : '演示模式（老板来了）',
              hint: 'Alt+Q',
              onSelect: () => toggleDecoy(),
            },
            {
              label: decoy ? 'Preferences: Open Settings' : '阅读设置',
              hint: 'S',
              separatorBefore: true,
              onSelect: () => setSettingsOpen(true),
            },
            {
              label: decoy ? 'View: Toggle Full Screen' : '全屏',
              hint: 'F',
              onSelect: () => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void document.documentElement.requestFullscreen()
              },
            },
          ]}
          tabs={openChapters.map((index) => ({
            key: `c-${index}`,
            label: decoy
              ? decoyFileName(decoyId, decoySeed(book.id, index))
              : chapterFileName(titleOfChapter(index), index),
            active: index === chapterIndex,
            onSelect: () => goToChapter(index, 0),
          }))}
          crumbs={[
            {
              label: decoy ? decoyFolderName(decoyId, 'workspace') : '我的书架',
              onSelect: backToShelf,
            },
            { label: fakeFolder },
            { label: fakeFile },
          ]}
          statusLeft={
            decoy ? (
              <>
                <CodeStatusItem>main</CodeStatusItem>
                <CodeStatusItem>{`Ln ${cursor.line}, Col ${cursor.col}`}</CodeStatusItem>
                <CodeStatusItem className="max-sm:hidden">
                  <input
                    type="range"
                    className="mn-range mn-code__status-range"
                    min={0}
                    max={1000}
                    step={1}
                    value={Math.round(percent * 1000)}
                    style={{ '--mn-fill': `${percent * 100}%` } as CSSProperties}
                    onChange={(event) => handleSeek(Number(event.target.value) / 1000)}
                    aria-label="进度"
                  />
                </CodeStatusItem>
              </>
            ) : (
              <>
                <CodeStatusItem>
                  {`第 ${(chapterIndex ?? 0) + 1}/${book.chapterCount} 章`}
                </CodeStatusItem>
                <CodeStatusItem className="max-sm:hidden">
                  <input
                    type="range"
                    className="mn-range mn-code__status-range"
                    min={0}
                    max={1000}
                    step={1}
                    value={Math.round(percent * 1000)}
                    style={{ '--mn-fill': `${percent * 100}%` } as CSSProperties}
                    onChange={(event) => handleSeek(Number(event.target.value) / 1000)}
                    aria-label="全书进度"
                  />
                </CodeStatusItem>
              </>
            )
          }
          statusRight={
            decoy ? (
              <>
                <CodeStatusItem className="max-lg:hidden">
                  {decoyChromeLabel?.indent}
                </CodeStatusItem>
                <CodeStatusItem className="max-lg:hidden">UTF-8</CodeStatusItem>
                <CodeStatusItem>{decoyChromeLabel?.language}</CodeStatusItem>
                <CodeStatusItem
                  onClick={goPrev}
                  disabled={(chapterIndex ?? 0) <= 0}
                  title="上一页"
                >
                  ←
                </CodeStatusItem>
                <CodeStatusItem
                  onClick={goNext}
                  disabled={(chapterIndex ?? 0) >= book.chapterCount - 1}
                  title="下一页"
                >
                  →
                </CodeStatusItem>
              </>
            ) : (
              <>
                {/* 本章字数 / 全书字数：读的过程中最常想知道的两个数 */}
                <CodeStatusItem
                  className="max-lg:hidden"
                  title={`本章 ${chapter?.charCount ?? 0} 字 · 全书 ${book.totalChars} 字`}
                >
                  {formatChars(chapter?.charCount ?? 0)} / {formatChars(book.totalChars)}
                </CodeStatusItem>
                {book.charset ? (
                  <CodeStatusItem className="max-lg:hidden">{book.charset}</CodeStatusItem>
                ) : null}
                <CodeStatusItem>{formatPercent(percent)}</CodeStatusItem>
                <CodeStatusItem
                  onClick={goPrev}
                  disabled={(chapterIndex ?? 0) <= 0}
                  title={`上一章（←）`}
                >
                  上一章
                </CodeStatusItem>
                <CodeStatusItem
                  onClick={goNext}
                  disabled={(chapterIndex ?? 0) >= book.chapterCount - 1}
                  title={`下一章（→）`}
                >
                  下一章
                </CodeStatusItem>
              </>
            )
          }
          statusRatio={percent}
          onSettings={() => setSettingsOpen(true)}
        >
          {/* 正文还没就位时什么都不写：编辑器打开文件时是空白的，
              弹一行「正在打开…」反而看着像另一个应用 */}
          {readerView ?? null}
        </CodeShell>

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

  return (
    <div
      ref={setReaderRoot}
      className="relative h-dvh overflow-hidden bg-reader-bg text-reader-fg"
    >
      {/* 顶部那条发丝进度：工具栏收起来之后，它是唯一还看得见的「读到哪了」 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[3px]">
        <div
          className={cx(
            'h-full rounded-r-full bg-accent transition-[width,opacity] duration-[var(--mn-dur-3)] ease-[var(--mn-ease)]',
            chromeVisible || tocOpen || settingsOpen ? 'opacity-95' : 'opacity-45',
          )}
          style={{ width: `${percent * 100}%` }}
        />
      </div>

      {readerView ?? (
        <div className="flex h-full items-center justify-center text-[13px] text-reader-fg-muted">
          正在打开…
        </div>
      )}

      <ReaderTopBar
        visible={chromeVisible}
        pinned={tocOpen || settingsOpen}
        title={book.title}
        chapterTitle={chapter?.title ?? ''}
        onBack={backToShelf}
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

/** 打开中 / 出错时的整屏状态：一张标识 + 一句话 + 一个出口 */
function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={56} className="mn-float" />
      <div className="flex flex-col items-center gap-3">{children}</div>
    </div>
  )
}
