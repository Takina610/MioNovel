import { useEffect, useState } from 'react'
import { bookInitial, coverGradient, formatChars, formatPercent, formatRelativeTime } from '../../lib/format'
import { bookPercent } from '../../lib/progress'
import { useImports, type ImportTask } from '../../store/imports'
import type { BookRecord } from '../../db/db'
import { cx } from '../../lib/cx'

/** Blob → ObjectURL，卸载时释放。封面是缩略图（≤400px），几十 KB 一张 */
function useCoverUrl(cover: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!cover) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(cover)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [cover])
  return url
}

function Cover({ book }: { book: BookRecord }) {
  const url = useCoverUrl(book.cover)
  if (url) {
    return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
  }

  // 没有封面就按书名生成一个确定性渐变卡：同一本书每次都是同一个颜色，
  // 而且不用为它存任何图片
  const [from, to] = coverGradient(book.title)
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      <span className="text-4xl font-medium text-white/85 select-none">
        {bookInitial(book.title)}
      </span>
    </div>
  )
}

function ImportOverlay({ task }: { task: ImportTask }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-overlay/70 p-3">
      <div className="text-[12px] text-white/90">{task.error ? '导入失败' : '正在导入'}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-200"
          style={{ width: `${Math.round(task.ratio * 100)}%` }}
        />
      </div>
      {task.note ? (
        <div className="mt-1.5 truncate text-[11px] text-white/70">{task.note}</div>
      ) : null}
    </div>
  )
}

interface BookCardProps {
  book: BookRecord
  onOpen: (book: BookRecord) => void
  onMenu: (book: BookRecord) => void
}

export function BookCard({ book, onOpen, onMenu }: BookCardProps) {
  const task = useImports((state) => state.tasks.find((item) => item.bookId === book.id))

  const importing = book.state === 'importing' && !task?.error
  const failed = book.state === 'error'
  const hasProgress = book.progress !== null && book.state === 'ready'
  const percent = hasProgress
    ? bookPercent(book, book.progress!.chapterIndex, book.progress!.ratio)
    : 0

  return (
    <div className="group relative flex flex-col">
      <button
        type="button"
        onClick={() => (importing ? undefined : onOpen(book))}
        disabled={importing}
        aria-label={importing ? `《${book.title}》正在导入` : `打开《${book.title}》`}
        className={cx(
          'relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-surface-2',
          'transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          !importing && 'hover:shadow-lg',
        )}
      >
        <Cover book={book} />

        {importing ? <ImportOverlay task={task ?? { bookId: book.id, fileName: book.fileName, ratio: 0, status: 'running' }} /> : null}

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay/70 p-3 text-center">
            <span className="text-[12px] text-white/90">{book.error ?? '导入失败'}</span>
            <span className="text-[11px] text-white/60">右键打开菜单可重新解析</span>
          </div>
        ) : null}

        {hasProgress ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
            <div className="h-full bg-accent" style={{ width: `${percent * 100}%` }} />
          </div>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => onMenu(book)}
        aria-label="更多操作"
        className="absolute top-1.5 right-1.5 rounded-md bg-black/45 px-1.5 py-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
      >
        ⋯
      </button>

      <div className="mt-2 min-w-0">
        <div className="truncate text-[13.5px] font-medium text-fg" title={book.title}>
          {book.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-faint">
          {book.state === 'ready' ? (
            <>
              <span className="shrink-0 uppercase">{book.format}</span>
              <span aria-hidden>·</span>
              <span className="truncate">
                {hasProgress ? formatPercent(percent) : formatChars(book.totalChars)}
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{formatRelativeTime(book.lastReadAt)}</span>
            </>
          ) : (
            <span>{book.state === 'error' ? '解析失败' : '导入中…'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
