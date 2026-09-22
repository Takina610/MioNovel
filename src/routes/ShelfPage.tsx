import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookCard } from '../components/shelf/BookCard'
import { BookPanel } from '../components/shelf/BookPanel'
import { Button } from '../components/ui/Button'
import type { BookRecord } from '../db/db'
import { useBooks } from '../hooks/useBooks'
import { useFileDrop } from '../hooks/useFileDrop'
import { useImports } from '../store/imports'

type SortKey = 'recent' | 'added' | 'title' | 'size'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent', label: '最近阅读' },
  { key: 'added', label: '加入时间' },
  { key: 'title', label: '书名' },
  { key: 'size', label: '文件大小' },
]

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
  const [panelBook, setPanelBook] = useState<BookRecord | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const dragging = useFileDrop(addFiles)
  const visible = useMemo(() => filterAndSort(books ?? [], query, sort), [books, query, sort])

  const openReader = (book: BookRecord) => {
    setPanelBook(null)
    void navigate(`/read/${book.id}`)
  }

  const loading = books === undefined

  return (
    <div className={dragging ? 'mn-drop-active' : undefined}>
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-fg">MioNovel</h1>
            <p className="mt-0.5 text-[12.5px] text-fg-faint">
              {loading
                ? '正在打开书架'
                : books.length === 0
                  ? '书架是空的'
                  : `共 ${books.length} 本`}
            </p>
          </div>
          <Button variant="solid" onClick={() => fileInput.current?.click()}>
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
        </header>

        <div className="mt-5 flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜书名或作者"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-[13px] placeholder:text-fg-faint"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 shrink-0 rounded-md border border-border bg-surface px-2 text-[13px]"
            aria-label="排序方式"
          >
            {SORTS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="mt-24 text-center text-[13px] text-fg-faint">正在打开书架…</div>
        ) : visible.length > 0 ? (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {visible.map((book) => (
              <BookCard key={book.id} book={book} onOpen={openReader} onMenu={setPanelBook} />
            ))}
          </div>
        ) : books.length > 0 ? (
          <div className="mt-24 text-center text-[13px] text-fg-faint">
            没有匹配「{query}」的书
          </div>
        ) : (
          <EmptyShelf onPick={() => fileInput.current?.click()} />
        )}
      </div>

      <BookPanel
        book={panelBook}
        open={panelBook !== null}
        onClose={() => setPanelBook(null)}
        onRead={openReader}
        onDeleted={() => setPanelBook(null)}
      />

      {notice ? (
        <button
          type="button"
          onClick={dismissNotice}
          className="fixed bottom-6 left-1/2 z-60 -translate-x-1/2 rounded-full border border-border bg-surface px-4 py-2 text-[12.5px] text-fg shadow-lg"
        >
          {notice}
        </button>
      ) : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center">
          <div className="rounded-xl bg-surface px-6 py-4 text-[14px] font-medium text-fg shadow-xl">
            松手就导入 · txt 和 epub
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmptyShelf({ onPick }: { onPick: () => void }) {
  return (
    <div className="mt-16 rounded-2xl border-2 border-dashed border-border px-6 py-16 text-center">
      <div className="text-[15px] font-medium text-fg">把小说拖进来</div>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-fg-muted">
        支持 <span className="text-fg">txt</span> 和 <span className="text-fg">epub</span>。
        文件只存在这台设备的浏览器里，不上传，断网也能读。
        中文 txt 的 GBK / Big5 / UTF-16 编码会自动识别。
      </p>
      <Button variant="outline" className="mt-5" onClick={onPick}>
        选择文件
      </Button>
    </div>
  )
}
