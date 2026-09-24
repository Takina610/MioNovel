import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AppShelf } from '../apps/registry'
import { BookCard } from '../components/shelf/BookCard'
import { BookPanel } from '../components/shelf/BookPanel'
import { CodeExplorer, toggleInSet } from '../components/code/CodeExplorer'
import { CodePreview } from '../components/code/CodePreview'
import { CodeSearch } from '../components/code/CodeSearch'
import { CodeShell, CodeStatusItem, type CodeView } from '../components/code/CodeShell'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { Select } from '../components/ui/Select'
import { Toast } from '../components/ui/Toast'
import { IconClose, IconImport, IconSearch, IconSliders, IconSort } from '../components/ui/icons'
import { saveProgress } from '../db/books'
import type { BookRecord } from '../db/db'
import { useBooks } from '../hooks/useBooks'
import { useFileDrop } from '../hooks/useFileDrop'
import { useToc } from '../hooks/useToc'
import { useChrome } from '../hooks/useTheme'
import { bookFolderName, chapterFileName } from '../lib/code'
import {
  decoyCursor,
  decoyEmptyState,
  decoyFileName,
  decoyFolderName,
  decoySeed,
  decoyStatus,
} from '../lib/decoy'
import { formatBytes, formatChars, formatPercent } from '../lib/format'
import { bookPercent } from '../lib/progress'
import { SettingsPanel } from '../components/reader/SettingsPanel'
import { useDecoy } from '../store/decoy'
import { useDim } from '../store/dim'
import { useHotkeyCombo } from '../store/hotkeys'
import { useImports } from '../store/imports'
import { useSettings } from '../store/settings'
import { cx } from '../lib/cx'

type SortKey = 'recent' | 'added' | 'title' | 'size'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent', label: '最近阅读' },
  { key: 'added', label: '加入时间' },
  { key: 'title', label: '书名' },
  { key: 'size', label: '文件大小' },
]

const SORT_OPTIONS = SORTS.map((item) => ({ value: item.key, label: item.label }))

function filterAndSort(books: BookRecord[], query: string, sort: SortKey): BookRecord[] {
  const needle = query.trim().toLowerCase()
  const matched = needle
    ? books.filter(
        (book) =>
          book.title.toLowerCase().includes(needle) ||
          book.author.toLowerCase().includes(needle) ||
          book.fileName.toLowerCase().includes(needle),
      )
    : [...books]

  return matched.sort((a, b) => {
    switch (sort) {
      case 'recent':
        // 没读过的排在读过的后面，按加入时间参与排序
        return (b.progress?.updatedAt ?? b.addedAt) - (a.progress?.updatedAt ?? a.addedAt)
      case 'title':
        return a.title.localeCompare(b.title, 'zh-Hans-CN')
      case 'size':
        return b.fileSize - a.fileSize
      default:
        return b.addedAt - a.addedAt
    }
  })
}

/**
 * 书架。
 *
 * 几套外壳共用一个入口：主题声明 chrome 时走对应的形态——code 是编辑器
 * （资源管理器 + 正文预览），doc / chat / page / sheet / slide 是五套办公外壳
 * （云文档首页、会话列表、Office 开始屏幕），其余是封面墙。
 * 形态写在主题里（见 themes/types.ts），所以这里只是「同一页数据的几种排法」，
 * 不是几套书架。
 */
export function ShelfPage() {
  const chrome = useChrome()
  const navigate = useNavigate()
  const openBook = useCallback(
    (book: BookRecord) => {
      void navigate(`/read/${book.id}`, { viewTransition: true })
    },
    [navigate],
  )

  if (chrome === 'code') return <CodeShelfPage />
  if (chrome === 'plain') return <GridShelfPage />
  return <AppShelf chrome={chrome} navigateToBook={openBook} />
}

// ==========================================================================
// 格子书架：默认形态
// ==========================================================================

function GridShelfPage() {
  const books = useBooks()
  const navigate = useNavigate()
  const addFiles = useImports((state) => state.addFiles)
  const notice = useImports((state) => state.notice)
  const dismissNotice = useImports((state) => state.dismissNotice)
  const globalSettings = useSettings((state) => state.global)
  const updateSettings = useSettings((state) => state.update)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  // 只记 id，记录从书架这份实时数据里取。存整条记录的话，面板里的章节数、字数、
  // 解析说明会停在打开面板那一刻——重新解析完还显示旧数字，用户没法确认
  // 刚才那一下到底成没成
  const [panelBookId, setPanelBookId] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const dragging = useFileDrop(addFiles)
  const visible = useMemo(() => filterAndSort(books ?? [], query, sort), [books, query, sort])
  const panelBook = useMemo(
    () => (panelBookId && books ? (books.find((book) => book.id === panelBookId) ?? null) : null),
    [books, panelBookId],
  )

  // 头部滚动到一定距离才浮起来（加边框和毛玻璃）。用 rAF 节流：
  // 滚动事件每次 setState 会让整页重渲染，而书架可能有几百张卡
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setScrolled(window.scrollY > 6)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const openReader = (book: BookRecord) => {
    setPanelBookId(null)
    // viewTransition：书架 → 阅读器之间做一次镜头推近式的换页（见 styles/app.css）
    void navigate(`/read/${book.id}`, { viewTransition: true })
  }

  const loading = books === undefined

  return (
    <div className={cx('relative', dragging && 'mn-drop-active')}>
      {/* 顶部一层极淡的强调色：给白底的书架一点纵深，颜色跟着主题走 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(110%_100%_at_50%_0%,color-mix(in_srgb,var(--mn-accent)_11%,transparent),transparent)]"
      />

      <header
        className={cx(
          'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ease-[var(--mn-ease)]',
          scrolled ? 'border-border bg-bg/80 backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={40} className="mn-rise" />
            <div className="min-w-0">
              <h1 className="text-[17px] leading-tight font-semibold tracking-tight text-fg">
                MioNovel
              </h1>
              {loading ? (
                <span className="mn-skeleton mt-1 block h-3 w-16 rounded-full" />
              ) : (
                <p className="mt-0.5 truncate text-[12.5px] text-fg-faint">
                  {books.length === 0 ? '书架是空的' : `共 ${books.length} 本`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="px-2.5"
              aria-label="阅读设置"
              onClick={() => setSettingsOpen(true)}
            >
              <IconSliders className="h-4.5 w-4.5" />
            </Button>
            <Button variant="solid" className="gap-1.5" onClick={() => fileInput.current?.click()}>
              <IconImport className="h-4 w-4" />
              导入
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".txt,.epub,text/plain,application/epub+zip"
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              addFiles(files)
              // 清空 value，否则同一个文件选第二次不触发 change
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 pb-24 sm:px-6">
        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜书名或作者"
              aria-label="搜书名或作者"
              className={cx(
                'h-10 w-full rounded-xl border border-border bg-surface/70 pr-9 pl-9 text-[13px] text-fg',
                'transition-[border-color,box-shadow,background-color] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
                'placeholder:text-fg-faint focus:border-accent focus:bg-bg',
                'focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--mn-accent)_14%,transparent)] focus:outline-none',
              )}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="清空搜索"
                className="mn-pop absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-fg-faint hover:bg-surface-2 hover:text-fg"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Select
            variant="ghost"
            align="end"
            ariaLabel="排序方式"
            value={sort}
            options={SORT_OPTIONS}
            leadingIcon={<IconSort className="h-4 w-4" />}
            onChange={(value) => setSort(value as SortKey)}
          />
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : visible.length > 0 ? (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {visible.map((book, index) => (
              <BookCard
                key={book.id}
                book={book}
                index={index}
                onOpen={openReader}
                onMenu={(book) => setPanelBookId(book.id)}
              />
            ))}
          </div>
        ) : books.length > 0 ? (
          <div className="mn-rise mt-24 flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] text-fg-faint">没有匹配「{query}」的书</p>
            <Button size="sm" variant="outline" onClick={() => setQuery('')}>
              清空搜索
            </Button>
          </div>
        ) : (
          <EmptyShelf onPick={() => fileInput.current?.click()} />
        )}
      </div>

      <BookPanel
        book={panelBook}
        open={panelBook !== null}
        onClose={() => setPanelBookId(null)}
        onRead={openReader}
        onDeleted={() => setPanelBookId(null)}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={globalSettings}
        onChange={updateSettings}
      />

      <Toast message={notice} onDismiss={dismissNotice} />

      {dragging ? <DropHint /> : null}
    </div>
  )
}

// ==========================================================================
// 编辑器书架：chrome: 'code' 的主题
// ==========================================================================

function CodeShelfPage() {
  const books = useBooks()
  const navigate = useNavigate()
  const addFiles = useImports((state) => state.addFiles)
  const notice = useImports((state) => state.notice)
  const dismissNotice = useImports((state) => state.dismissNotice)
  const globalSettings = useSettings((state) => state.global)
  const updateSettings = useSettings((state) => state.update)

  const [view, setView] = useState<CodeView>('explorer')
  // 窄屏上侧栏是浮层，默认收着——不然一进来就是它盖着正文
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth >= 768)
  /**
   * 树上展开了哪几本书。就是字面意思的展开状态——不要在这里掺「选中哪本」：
   * 上一版让「选中」顺手把书加回展开集合，于是点一下永远收不起来（见 SPEC 决定记录 22）。
   * 「选中的自动展开」只在真的需要它的时候做一次：导入完成、搜索结果点进来。
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * 选中哪本书。**默认是空的**：一进来是工作区首页，不是某一本小说。
   *
   * 之前的写法是「没有选中就自动挑一本有进度的」，于是切到编辑器形态的那一刻
   * 屏幕上直接就是某本小说的正文——看着像被塞进了阅读器，而且没有明显的地方
   * 能退回来。工作区该等用户点。
   */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** 预览到第几章。选书时定在它上次读到的地方 */
  const [previewChapter, setPreviewChapter] = useState(0)
  /** 预览的章内位置，用来算全书百分比（正文那边滚动时限流上报） */
  const [previewRatio, setPreviewRatio] = useState(0)
  const [sort, setSort] = useState<SortKey>('recent')
  const [panelBookId, setPanelBookId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const dragging = useFileDrop(addFiles)
  const tasks = useImports((state) => state.tasks)
  const decoy = useDecoy((state) => state.enabled)
  const decoyId = useDecoy((state) => state.preset)
  const toggleDecoy = useDecoy((state) => state.toggle)
  const dim = useDim((state) => state.enabled)
  const toggleDim = useDim((state) => state.toggle)
  const decoyHotkey = useHotkeyCombo('decoy')
  const dimHotkey = useHotkeyCombo('dim')
  const list = useMemo(() => filterAndSort(books ?? [], '', sort), [books, sort])
  const selected = useMemo(
    () => (selectedId ? (list.find((book) => book.id === selectedId) ?? null) : null),
    [list, selectedId],
  )
  const panelBook = useMemo(
    () => (panelBookId ? (list.find((book) => book.id === panelBookId) ?? null) : null),
    [list, panelBookId],
  )

  const expandBook = useCallback((id: string) => {
    setExpanded((current) => (current.has(id) ? current : new Set([...current, id])))
  }, [])

  /** 选中一本书。**不碰展开状态**：那是树自己的事 */
  const pickBook = useCallback((book: BookRecord, chapter = book.progress?.chapterIndex ?? 0) => {
    setSelectedId(book.id)
    setPreviewChapter(Math.max(0, Math.min(book.chapterCount - 1, chapter)))
  }, [])

  // 拖进来一本书之后，编辑区应该显示的就是它——不然文件进了书架，
  // 屏幕上还是上一次那本，看着像没导进去。开场时已有任务不算「刚导入」，
  // 所以第一轮只记下现状。
  const seenTask = useRef<string | null>(null)
  const tasksSeen = useRef(false)
  useEffect(() => {
    const newest = tasks[tasks.length - 1]
    if (!tasksSeen.current) {
      tasksSeen.current = true
      seenTask.current = newest?.bookId ?? null
      return
    }
    if (!newest || seenTask.current === newest.bookId) return
    seenTask.current = newest.bookId
    setSelectedId(newest.bookId)
    setPreviewChapter(0)
    expandBook(newest.bookId)
  }, [tasks, expandBook])

  const chapterIndex = selected
    ? Math.max(0, Math.min(selected.chapterCount - 1, previewChapter))
    : 0
  const toc = useToc(selected?.id, selected?.groups)
  // 预览那一章的标题和字数：标签页、面包屑、状态栏都要用
  const chapterRow = toc?.find((row) => row.type === 'chapter' && row.index === chapterIndex)
  const chapterTitle = chapterRow?.label ?? ''
  const chapterFile = chapterFileName(chapterTitle, chapterIndex)
  const folderName = selected
    ? decoy
      ? decoyFolderName(decoyId, selected.id)
      : bookFolderName(selected.title)
    : ''
  const chapterSeed = selected ? decoySeed(selected.id, chapterIndex) : ''
  const cursor = decoyCursor(chapterSeed || 'workspace')
  const fakeFile = decoy ? decoyFileName(decoyId, chapterSeed) : chapterFile
  const decoyChromeLabel = decoy ? decoyStatus(decoyId) : null

  /** 打开某一章：先把进度写过去，再进阅读器——那样进去就是这一章 */
  const openChapter = useCallback(
    (book: BookRecord, index: number) => {
      void (async () => {
        await saveProgress(book.id, { chapterIndex: index, ratio: 0, updatedAt: Date.now() })
        void navigate(`/read/${book.id}`, { viewTransition: true })
      })()
    },
    [navigate],
  )

  const importFiles = () => fileInput.current?.click()
  const hasPrev = selected !== null && chapterIndex > 0
  const hasNext = selected !== null && chapterIndex < selected.chapterCount - 1
  const percent = selected ? bookPercent(selected, chapterIndex, previewRatio) : 0
  const changeChapter = (index: number) => {
    setPreviewChapter(index)
    setPreviewRatio(0)
  }

  return (
    <>
      <CodeShell
        title={`${selected ? folderName : decoy ? decoyFolderName(decoyId, 'workspace') : '我的书架'} — ${decoy ? 'workspace' : 'MioNovel'}`}
        view={view}
        onView={setView}
        sideOpen={sideOpen}
        onToggleSide={() => setSideOpen((open) => !open)}
        sideTitle={view === 'search' ? (decoy ? 'Search' : '搜索') : '资源管理器'}
        dropping={dragging}
        side={
          view === 'search' ? (
            <div>
              <div className="flex items-center gap-1 pr-3 pl-4">
                <div className="min-w-0 flex-1">
                  <span className="text-[11.5px] text-fg-faint">排序</span>
                </div>
                <Select
                  variant="ghost"
                  align="end"
                  ariaLabel="排序方式"
                  value={sort}
                  options={SORT_OPTIONS}
                  leadingIcon={<IconSort className="h-3.5 w-3.5" />}
                  onChange={(value) => setSort(value as SortKey)}
                />
              </div>
              <CodeSearch
                books={list}
                onSelectBook={(book) => {
                  pickBook(book)
                  expandBook(book.id)
                  setSideOpen(false)
                }}
              />
            </div>
          ) : books === undefined ? (
            <div className="mn-code-hint">正在打开书架…</div>
          ) : list.length === 0 ? (
            <div className="mn-code-hint">书架是空的。拖文件进来，或者点下面的「导入文件…」。</div>
          ) : (
            <CodeExplorer
              books={list}
              expanded={expanded}
              // 点书名只做两件事：切预览、展开/收起。展开状态是用户的东西，
              // 选中逻辑不许顺手把它改回去
              onToggleBook={(id) => setExpanded((current) => toggleInSet(current, id))}
              onSelectBook={(book) => pickBook(book)}
              onOpenChapter={openChapter}
              onBookMenu={(book) => setPanelBookId(book.id)}
              current={selected ? { bookId: selected.id, index: chapterIndex } : undefined}
              onImport={importFiles}
              importLabel={decoy ? 'Open File…' : '导入文件…'}
            />
          )
        }
        menu={[
          { label: decoy ? 'File: Open…' : '导入文件…', onSelect: importFiles },
          ...(selected
            ? [
                {
                  label: decoy ? 'Go to Workspace Root' : '回到工作区首页',
                  onSelect: () => setSelectedId(null),
                  separatorBefore: true,
                },
              ]
            : []),
          {
            // 演示模式的入口。写在菜单里是为了让人知道有这回事——
            // 快捷键记不住，但菜单里看得见（见 SPEC 决定记录 22）。
            // 提示里写的是**当前生效的**组合，用户改过键之后菜单跟着变
            label: decoy ? 'View: Exit Presentation' : '演示模式（老板来了）',
            hint: decoyHotkey,
            onSelect: () => toggleDecoy(),
          },
          {
            label: dim ? 'View: Exit Dim Mode' : '摸鱼模式（调暗编辑区）',
            hint: dimHotkey,
            onSelect: () => toggleDim(),
          },
          {
            label: decoy ? 'Preferences: Open Settings' : '阅读设置',
            onSelect: () => setSettingsOpen(true),
            separatorBefore: true,
          },
          {
            label: decoy ? 'View: Full Screen' : '全屏',
            onSelect: () => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void document.documentElement.requestFullscreen()
            },
          },
        ]}
        tabs={
          selected && selected.state === 'ready'
            ? [
                {
                  key: `${selected.id}:${chapterIndex}`,
                  label: fakeFile,
                  active: true,
                  onSelect: () => openChapter(selected, chapterIndex),
                },
              ]
            : []
        }
        crumbs={
          selected
            ? [
                // 面包屑的第一节就是工作区根：点它回到首页（和编辑器里点路径回上层一个意思）
                {
                  label: decoy ? decoyFolderName(decoyId, 'workspace') : '我的书架',
                  onSelect: () => setSelectedId(null),
                },
                { label: folderName },
                { label: fakeFile },
              ]
            : [{ label: decoy ? decoyFolderName(decoyId, 'workspace') : '我的书架' }]
        }
        statusLeft={
          decoy ? (
            <>
              <CodeStatusItem>main</CodeStatusItem>
              <CodeStatusItem>{`Ln ${cursor.line}, Col ${cursor.col}`}</CodeStatusItem>
            </>
          ) : (
            <>
              <CodeStatusItem>{`共 ${list.length} 本`}</CodeStatusItem>
              {selected ? (
                <CodeStatusItem title={selected.title}>
                  {`第 ${chapterIndex + 1}/${selected.chapterCount} 章`}
                </CodeStatusItem>
              ) : null}
              {selected ? <CodeStatusItem>{formatPercent(percent)}</CodeStatusItem> : null}
            </>
          )
        }
        statusRight={
          selected ? (
            decoy ? (
              <>
                <CodeStatusItem className="max-lg:hidden">
                  {decoyChromeLabel?.indent}
                </CodeStatusItem>
                <CodeStatusItem className="max-lg:hidden">UTF-8</CodeStatusItem>
                <CodeStatusItem>{decoyChromeLabel?.language}</CodeStatusItem>
                <CodeStatusItem
                  onClick={() => hasPrev && changeChapter(chapterIndex - 1)}
                  disabled={!hasPrev}
                  title="上一页"
                >
                  ←
                </CodeStatusItem>
                <CodeStatusItem
                  onClick={() => hasNext && changeChapter(chapterIndex + 1)}
                  disabled={!hasNext}
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
                  title={
                    chapterRow?.charCount
                      ? `本章 ${chapterRow.charCount} 字 · 全书 ${selected.totalChars} 字`
                      : `全书 ${selected.totalChars} 字`
                  }
                >
                  {chapterRow?.charCount ? `${formatChars(chapterRow.charCount)} / ` : ''}
                  {formatChars(selected.totalChars)}
                </CodeStatusItem>
                {selected.charset ? (
                  <CodeStatusItem className="max-lg:hidden">{selected.charset}</CodeStatusItem>
                ) : null}
                <CodeStatusItem title={`文件大小 ${formatBytes(selected.fileSize)}`}>
                  {selected.format.toUpperCase()}
                </CodeStatusItem>
                {/* 上下章常驻在状态栏：预览也是「在读」，翻章不该只靠资源管理器 */}
                <CodeStatusItem
                  onClick={() => hasPrev && changeChapter(chapterIndex - 1)}
                  disabled={!hasPrev}
                  title="上一章"
                >
                  上一章
                </CodeStatusItem>
                <CodeStatusItem
                  onClick={() => hasNext && changeChapter(chapterIndex + 1)}
                  disabled={!hasNext}
                  title="下一章"
                >
                  下一章
                </CodeStatusItem>
              </>
            )
          ) : null
        }
        statusRatio={selected ? percent : undefined}
        onSettings={() => setSettingsOpen(true)}
      >
        {selected && selected.state === 'ready' ? (
          <CodePreview
            book={selected}
            chapterIndex={chapterIndex}
            decoySeedValue={chapterSeed}
            onRatio={setPreviewRatio}
          />
        ) : (
          <Watermark
            title={
              list.length === 0
                ? decoy
                  ? decoyEmptyState(decoyId, 'workspace').title
                  : '把小说拖进来'
                : selected
                  ? folderName
                  : decoy
                    ? decoyEmptyState(decoyId, 'workspace').title
                    : '我的书架'
            }
            hint={
              list.length === 0
                ? decoy
                  ? '把文件拖进窗口即可打开。'
                  : 'txt 和 epub 都行，文件不上传'
                : selected?.state === 'importing'
                  ? decoy
                    ? '正在索引…'
                    : '这本书还在导入'
                  : selected
                    ? decoy
                      ? '这个文件暂时打不开。'
                      : '这本书没能解析成功，用资源管理器里它那一行的 ⋯ 重新解析'
                    : decoy
                      ? decoyEmptyState(decoyId, 'workspace').hint
                      : '点左侧资源管理器里的书名开始读；把文件拖进窗口也能导入。'
            }
          />
        )}
      </CodeShell>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".txt,.epub,text/plain,application/epub+zip"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          addFiles(files)
          event.target.value = ''
        }}
      />

      <BookPanel
        book={panelBook}
        open={panelBook !== null}
        onClose={() => setPanelBookId(null)}
        onRead={(book) => openChapter(book, book.progress?.chapterIndex ?? 0)}
        onDeleted={() => setPanelBookId(null)}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={globalSettings}
        onChange={updateSettings}
      />

      <Toast message={notice} onDismiss={dismissNotice} />

      {dragging ? <DropHint /> : null}
    </>
  )
}

/** 拖拽悬停时的那张提示卡。两套外壳共用 */
function DropHint() {
  return (
    <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-6">
      <div className="mn-fade absolute inset-0 bg-overlay/35 backdrop-blur-sm" />
      <div className="mn-pop relative flex flex-col items-center gap-1.5 rounded-3xl border border-border bg-surface/95 px-9 py-7 shadow-[var(--mn-shadow-float)]">
        <Logo size={54} className="mn-float mb-1" />
        <div className="text-[15px] font-medium text-fg">松手就导入</div>
        <div className="text-[12px] text-fg-faint">txt · epub</div>
      </div>
    </div>
  )
}

/**
 * 编辑区里没有正文可显示时的那一屏。
 * 编辑器形态下连标识都不摆：这个形态的约定是「只有文字」，一个图标就破了它。
 */
function Watermark({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mn-code-watermark">
      <p className="text-[15px] text-fg-muted">{title}</p>
      <p className="text-[12px]">{hint}</p>
    </div>
  )
}
/** 书架还在读库时的占位。比一行「正在打开书架…」更像「马上就好」 */
function SkeletonGrid() {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="mn-fade" style={{ animationDelay: `${index * 40}ms` }}>
          <div className="mn-skeleton aspect-[3/4] w-full rounded-xl" />
          <div className="mn-skeleton mt-2 h-3.5 w-3/4 rounded-full" />
          <div className="mn-skeleton mt-1.5 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function EmptyShelf({ onPick }: { onPick: () => void }) {
  return (
    <div className="mn-rise mt-10 rounded-3xl border-2 border-dashed border-border px-6 py-16 text-center">
      <div className="relative mx-auto grid h-24 w-24 place-items-center">
        <span aria-hidden className="mn-breathe absolute inset-2 rounded-full bg-accent-soft" />
        <Logo size={58} className="mn-float relative" />
      </div>
      <div className="mt-3 text-[15px] font-medium text-fg">把小说拖进来</div>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-fg-muted">
        txt 和 epub 都行。文件只存在这台设备上，不上传，断网也能读。
      </p>
      <Button variant="outline" className="mt-5 gap-1.5" onClick={onPick}>
        <IconImport className="h-4 w-4" />
        选择文件
      </Button>
    </div>
  )
}
