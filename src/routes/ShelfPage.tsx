import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookCard } from '../components/shelf/BookCard'
import { BookPanel } from '../components/shelf/BookPanel'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { Select } from '../components/ui/Select'
import { Toast } from '../components/ui/Toast'
import { IconClose, IconImport, IconSearch, IconSort } from '../components/ui/icons'
import type { BookRecord } from '../db/db'
import { useBooks } from '../hooks/useBooks'
import { useFileDrop } from '../hooks/useFileDrop'
import { useImports } from '../store/imports'
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

export function ShelfPage() {
  const books = useBooks()
  const navigate = useNavigate()
  const addFiles = useImports((state) => state.addFiles)
  const notice = useImports((state) => state.notice)
  const dismissNotice = useImports((state) => state.dismissNotice)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  // 只记 id，记录从书架这份实时数据里取。存整条记录的话，面板里的章节数、字数、
  // 解析说明会停在打开面板那一刻——重新解析完还显示旧数字，用户没法确认
  // 刚才那一下到底成没成
  const [panelBookId, setPanelBookId] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
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
          scrolled
            ? 'border-border bg-bg/80 backdrop-blur-xl'
            : 'border-transparent bg-transparent',
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
          <Button variant="solid" className="gap-1.5" onClick={() => fileInput.current?.click()}>
            <IconImport className="h-4 w-4" />
            导入
          </Button>
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

      <Toast message={notice} onDismiss={dismissNotice} />

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-6">
          <div className="mn-fade absolute inset-0 bg-overlay/35 backdrop-blur-sm" />
          <div className="mn-pop relative flex flex-col items-center gap-1.5 rounded-3xl border border-border bg-surface/95 px-9 py-7 shadow-[var(--mn-shadow-float)]">
            <Logo size={54} className="mn-float mb-1" />
            <div className="text-[15px] font-medium text-fg">松手就导入</div>
            <div className="text-[12px] text-fg-faint">txt · epub</div>
          </div>
        </div>
      ) : null}
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
