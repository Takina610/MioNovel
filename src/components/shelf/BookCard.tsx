import type { CSSProperties } from 'react'
import { bookInitial, coverGradient, formatChars, formatPercent, formatRelativeTime } from '../../lib/format'
import { bookPercent } from '../../lib/progress'
import { useCoverUrl } from '../../hooks/useCoverUrl'
import { useImports, type ImportTask } from '../../store/imports'
import type { BookRecord } from '../../db/db'
import { cx } from '../../lib/cx'
import { IconMore } from '../ui/icons'

function Cover({ book }: { book: BookRecord }) {
  const url = useCoverUrl(book.cover)

  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        // 悬停时封面在卡片里慢慢放大一点：卡片不抬（用户要求去掉上移），就这一层动效
        className="h-full w-full object-cover transition-transform duration-[600ms] ease-[var(--mn-ease)] group-hover:scale-[1.05]"
      />
    )
  }

  // 没有封面就按书名生成一个确定性渐变卡：同一本书每次都是同一个颜色，
  // 而且不用为它存任何图片
  const [from, to] = coverGradient(book.title)
  return (
    <div
      className="flex h-full w-full items-center justify-center transition-transform duration-[600ms] ease-[var(--mn-ease)] group-hover:scale-[1.05]"
      style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      <span className="text-4xl font-medium text-white/85 select-none">
        {bookInitial(book.title)}
      </span>
    </div>
  )
}

function ImportOverlay({ task }: { task: ImportTask }) {
  const percent = Math.round(task.ratio * 100)

  return (
    <div className="absolute inset-0 flex flex-col justify-end bg-overlay/75 p-3 backdrop-blur-[2px]">
      <div className="flex items-baseline justify-between gap-2 text-[12px] text-white/90">
        <span>{task.error ? '导入失败' : '正在导入'}</span>
        {task.error ? null : <span className="tabular-nums text-white/70">{percent}%</span>}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300 ease-[var(--mn-ease)]"
          style={{ width: `${percent}%` }}
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
  /** 在列表里的位置，用来把出现动画错开 */
  index?: number
  onOpen: (book: BookRecord) => void
  onMenu: (book: BookRecord) => void
}

export function BookCard({ book, index = 0, onOpen, onMenu }: BookCardProps) {
  const task = useImports((state) => state.tasks.find((item) => item.bookId === book.id))

  const importing = book.state === 'importing' && !task?.error
  const failed = book.state === 'error'
  const hasProgress = book.progress !== null && book.state === 'ready'
  const percent = hasProgress
    ? bookPercent(book, book.progress!.chapterIndex, book.progress!.ratio)
    : 0

  return (
    <div
      className="group mn-rise mn-stagger relative flex flex-col"
      // 逐项出现的延迟。封顶到第 11 项：再往后的卡片没必要为了「排队感」多等半秒
      style={{ '--mn-i': Math.min(index, 10) } as CSSProperties}
    >
      <button
        type="button"
        onClick={() => (importing ? undefined : onOpen(book))}
        disabled={importing}
        aria-label={importing ? `《${book.title}》正在导入` : `打开《${book.title}》`}
        className={cx(
          'relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-surface-2',
          'transition-[transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          !importing &&
            'hover:shadow-[var(--mn-shadow-card)] active:scale-[0.985]',
        )}
      >
        <Cover book={book} />

        {/* 悬停时从底部压深一点，让白色的书名和菜单按钮都站得住 */}
        {!importing && !failed ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-[var(--mn-dur-2)] group-hover:opacity-100"
          />
        ) : null}

        {importing ? (
          <ImportOverlay
            task={
              task ?? { bookId: book.id, fileName: book.fileName, ratio: 0, status: 'running' }
            }
          />
        ) : null}

        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay/75 p-3 text-center backdrop-blur-[2px]">
            <span className="text-[12px] text-white/90">{book.error ?? '导入失败'}</span>
            <span className="text-[11px] text-white/60">点右上角 ⋯ 打开菜单可以重新解析</span>
          </div>
        ) : null}

        {hasProgress ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
            <div
              className="h-full rounded-r-full bg-accent transition-[width] duration-500 ease-[var(--mn-ease)]"
              style={{ width: `${percent * 100}%` }}
            />
          </div>
        ) : null}
      </button>

      {/* 菜单按钮：桌面端悬停/聚焦时滑下来，触屏上一直可见（那里没有悬停这回事） */}
      <button
        type="button"
        onClick={() => onMenu(book)}
        aria-label="更多操作"
        className={cx(
          'absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-sm',
          'transition-[opacity,transform] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
          '-translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100',
          'focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          'active:scale-90 max-md:translate-y-0 max-md:opacity-100',
        )}
      >
        <IconMore className="h-4 w-4" />
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
              <span className="truncate tabular-nums">
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
