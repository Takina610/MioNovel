import { useEffect, useRef } from 'react'
import type { BookRecord } from '../../db/db'
import { useToc } from '../../hooks/useToc'
import { bookFolderName, chapterFileName } from '../../lib/code'
import { decoyFileName, decoyFolderName, decoySeed } from '../../lib/decoy'
import { useDecoy } from '../../store/decoy'
import { formatPercent } from '../../lib/format'
import { bookPercent } from '../../lib/progress'
import { cx } from '../../lib/cx'
import {
  IconBack,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconImport,
  IconMore,
} from '../ui/icons'

interface CodeExplorerProps {
  books: BookRecord[]
  /** 展开的书。折叠状态归调用方管：书架默认展开在读的那本，阅读器展开当前这本 */
  expanded: ReadonlySet<string>
  onToggleBook: (bookId: string) => void
  /** 点书名时额外做的事。书架页用它把预览切过去；阅读器里不需要 */
  onSelectBook?: (book: BookRecord) => void
  /** 点章节：打开这一章 */
  onOpenChapter: (book: BookRecord, index: number) => void
  /** 书名右侧那个「⋯」：打开书详情面板（改名、重新解析、删除都还在那里）。
   *  不给就不显示——阅读器里没有这本书的详情面板，留一个按了没反应的按钮不如不画 */
  onBookMenu?: (book: BookRecord) => void
  /** 正在读/正在预览的章节，会高亮并滚到可见处 */
  current?: { bookId: string; index: number }
  onImport?: () => void
  /** 阅读器里用：树底下加一行「回书架」。书架本身就是根，那边不给这个 */
  onBackToShelf?: () => void
  /** 树底下那两行按钮的字。演示模式下由调用方换成代码味的说法 */
  importLabel?: string
  backLabel?: string
}

/**
 * 资源管理器：书架就是工作区，书是文件夹，章是文件。
 *
 * 不做「书架页一套列表 + 阅读器一套目录」：书的层级本来就两层（书 → 章），
 * 用树表达它是最短的映射。折叠状态由调用方持有，所以两边共用这棵树，
 * 只是展开哪一本、点书名做什么不同。
 *
 * 阅读器里这棵树列的是**整个书架**（见 ReaderPage），不只是当前这本——
 * 那样「换一本书」和「回书架」都在同一个地方，不用先退出阅读器。
 */
export function CodeExplorer({
  books,
  expanded,
  onToggleBook,
  onSelectBook,
  onOpenChapter,
  onBookMenu,
  current,
  onImport,
  onBackToShelf,
  importLabel = '导入文件…',
  backLabel = '回书架',
}: CodeExplorerProps) {
  return (
    <ul className="mn-code-tree">
      {books.map((book) => (
        <BookNode
          key={book.id}
          book={book}
          open={expanded.has(book.id)}
          onToggle={() => onToggleBook(book.id)}
          onSelectBook={onSelectBook}
          onOpenChapter={onOpenChapter}
          onBookMenu={onBookMenu}
          current={current?.bookId === book.id ? current.index : undefined}
        />
      ))}

      {onImport ? (
        <li>
          <button type="button" className="mn-code-side-btn" onClick={onImport}>
            <IconImport className="h-4 w-4" />
            {importLabel}
          </button>
        </li>
      ) : null}

      {onBackToShelf ? (
        <li>
          <button type="button" className="mn-code-side-btn" onClick={onBackToShelf}>
            <IconBack className="h-4 w-4" />
            {backLabel}
          </button>
        </li>
      ) : null}
    </ul>
  )
}

function BookNode({
  book,
  open,
  onToggle,
  onSelectBook,
  onOpenChapter,
  onBookMenu,
  current,
}: {
  book: BookRecord
  open: boolean
  onToggle: () => void
  onSelectBook?: (book: BookRecord) => void
  onOpenChapter: (book: BookRecord, index: number) => void
  onBookMenu?: (book: BookRecord) => void
  current?: number
}) {
  const decoy = useDecoy((state) => state.enabled)
  const preset = useDecoy((state) => state.preset)
  // 只有展开的那本书才去读目录：一本 3000 章的书，没必要在书架上就把它读出来
  const rows = useToc(book.id, open ? book.groups : undefined)
  const currentRef = useRef<HTMLButtonElement>(null)
  /** 树上显示的名字。演示模式下换成看着像代码仓库/文件名的一串 */
  const folderName = decoy ? decoyFolderName(preset, book.id) : bookFolderName(book.title)
  const fileOf = (label: string, index: number) =>
    decoy ? decoyFileName(preset, decoySeed(book.id, index)) : chapterFileName(label, index)

  // 打开的书里把当前章滚到中间：读到第 800 章的人不该每次都自己找位置
  useEffect(() => {
    if (!open || current === undefined) return
    const timer = window.setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: 'center' })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open, current])

  const percent = book.progress
    ? bookPercent(book, book.progress.chapterIndex, book.progress.ratio)
    : 0
  const meta =
    book.state === 'ready'
      ? book.progress
        ? formatPercent(percent)
        : `${book.chapterCount} 章`
      : book.state === 'importing'
        ? '导入中'
        : '解析失败'

  return (
    <li>
      <div className="mn-code-row-wrap">
        <button
          type="button"
          className="mn-code-row"
          aria-expanded={open}
          aria-current={current !== undefined ? 'true' : undefined}
          onClick={() => {
            onToggle()
            onSelectBook?.(book)
          }}
          title={book.title}
        >
          <IconChevronRight
            className={cx('mn-code-row__twist', open && 'mn-code-row__twist--open')}
          />
          <IconFolder className="mn-code-row__icon" />
          <span className="mn-code-row__label">{folderName}</span>
          <span className="mn-code-row__meta">{meta}</span>
        </button>
        {onBookMenu ? (
          <button
            type="button"
            className="mn-code-row__action"
            aria-label={`《${book.title}》的更多操作`}
            onClick={(event) => {
              event.stopPropagation()
              onBookMenu(book)
            }}
          >
            <IconMore className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        rows === undefined ? (
          <div className="mn-code-hint">正在读目录…</div>
        ) : rows.length === 0 ? (
          <div className="mn-code-hint">这本书没有目录</div>
        ) : (
          <ul className="mn-code-tree mn-code-tree--nested">
            {rows.map((row) =>
              row.type === 'group' ? (
                <li key={`g-${row.index}-${row.label}`}>
                  <div className="mn-code-row" style={{ paddingLeft: 20 + row.depth * 10 }}>
                    <IconFolder className="mn-code-row__icon" />
                    <span className="mn-code-row__label text-fg-faint">{row.label}</span>
                  </div>
                </li>
              ) : (
                <li key={`c-${row.index}`}>
                  <div className="mn-code-row-wrap">
                    <button
                      ref={row.index === current ? currentRef : undefined}
                      type="button"
                      className="mn-code-row"
                      aria-current={row.index === current ? 'true' : undefined}
                      style={{ paddingLeft: 20 + row.depth * 10 }}
                      onClick={() => onOpenChapter(book, row.index)}
                      title={row.label}
                    >
                      <IconFile className="mn-code-row__icon" />
                      <span className="mn-code-row__label">{fileOf(row.label, row.index)}</span>
                    </button>
                    {row.index === current && book.progress ? (
                      <span className="mn-code-row__meta">{formatPercent(book.progress.ratio)}</span>
                    ) : null}
                  </div>
                </li>
              ),
            )}
          </ul>
        )
      ) : null}
    </li>
  )
}

/** 展开集合里加/删一本书 */
export function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
