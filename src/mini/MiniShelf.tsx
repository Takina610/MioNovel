import { useMemo } from 'react'
import { formatPercent } from '../lib/format'
import { bookPercent } from '../lib/progress'
import { useBooks } from '../hooks/useBooks'
import { MiniRestoreButton } from './MiniRestoreButton'
import { miniShelfBooks } from './shelf'

/**
 * 小窗的书架：一列文字，不是封面墙。只列导入成功的书（miniShelfBooks），
 * 一行 = 书名 + 读到哪了。点一行进这本书，接着上次的位置。
 */
export function MiniShelf({ onOpen }: { onOpen: (bookId: string) => void }) {
  const books = useBooks()
  // undefined = 还在加载（不写「正在读目录」，这一步通常只有一帧）；
  // 空数组 = 书架真的空着
  const list = useMemo(() => (books ? miniShelfBooks(books) : null), [books])

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface pl-3.5 pr-2 text-[12px] text-fg-muted">
        书架
        <MiniRestoreButton />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {list === null
          ? null
          : list.length === 0
            ? <p className="px-2.5 py-6 text-center text-[12.5px] text-fg-faint">还没有文档</p>
            : list.map((book) => {
                const percent = book.progress
                  ? bookPercent(book, book.progress.chapterIndex, book.progress.ratio)
                  : null
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => onOpen(book.id)}
                    className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-[background-color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{book.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
                      {percent === null ? '未读' : formatPercent(percent)}
                    </span>
                  </button>
                )
              })}
      </div>
    </>
  )
}
