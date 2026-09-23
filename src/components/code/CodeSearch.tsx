import { useMemo, useState } from 'react'
import type { BookRecord } from '../../db/db'
import { useToc } from '../../hooks/useToc'
import { bookFolderName, chapterFileName } from '../../lib/code'
import { cx } from '../../lib/cx'
import { IconFile, IconFolder } from '../ui/icons'

interface CodeSearchProps {
  /** 给了书就搜这本书的章节，否则搜书架上的书 */
  book?: BookRecord
  books?: BookRecord[]
  onOpenChapter?: (index: number) => void
  onSelectBook?: (book: BookRecord) => void
}

/**
 * 搜索视图。
 *
 * 书架上搜书（书名、作者、文件名），阅读器里搜章节名——同一个输入框，
 * 搜的是「当前这个工作区里能搜的东西」。没有做成全文搜索：那要另建索引，
 * 而这里要的只是「在侧栏里找一下」。
 */
export function CodeSearch({ book, books, onOpenChapter, onSelectBook }: CodeSearchProps) {
  const [query, setQuery] = useState('')
  const rows = useToc(book?.id, book?.groups)
  const needle = query.trim().toLowerCase()

  const matchedChapters = useMemo(() => {
    if (!book || !needle) return []
    return (rows ?? []).filter(
      (row) => row.type === 'chapter' && row.label.toLowerCase().includes(needle),
    )
  }, [book, rows, needle])

  const matchedBooks = useMemo(() => {
    if (book || !needle) return []
    return (books ?? []).filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.author.toLowerCase().includes(needle) ||
        item.fileName.toLowerCase().includes(needle),
    )
  }, [book, books, needle])

  const matched = book ? matchedChapters : matchedBooks

  return (
    <div>
      <div className="px-4 pt-2 pb-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={book ? '搜章节名' : '搜书名或作者'}
          aria-label={book ? '搜章节名' : '搜书名或作者'}
          className="mn-code-input"
        />
        {needle ? (
          <p className="mt-2 text-[11.5px] text-fg-faint">
            {matched.length > 0 ? `${matched.length} 条结果` : '没有匹配'}
          </p>
        ) : null}
      </div>

      <ul className="mn-code-tree">
        {book
          ? matchedChapters.map((row) => (
              <li key={`c-${row.index}`}>
                <div className="mn-code-row-wrap">
                  <button
                    type="button"
                    className={cx('mn-code-row')}
                    style={{ paddingLeft: 16 }}
                    onClick={() => onOpenChapter?.(row.index)}
                    title={row.label}
                  >
                    <IconFile className="mn-code-row__icon" />
                    <span className="mn-code-row__label">
                      {chapterFileName(row.label, row.index)}
                    </span>
                  </button>
                </div>
              </li>
            ))
          : matchedBooks.map((item) => (
              <li key={item.id}>
                <div className="mn-code-row-wrap">
                  <button
                    type="button"
                    className="mn-code-row"
                    style={{ paddingLeft: 16 }}
                    onClick={() => onSelectBook?.(item)}
                    title={item.title}
                  >
                    <IconFolder className="mn-code-row__icon" />
                    <span className="mn-code-row__label">{bookFolderName(item.title)}</span>
                  </button>
                </div>
              </li>
            ))}
      </ul>

      {needle && matched.length === 0 ? (
        <p className="mn-code-hint">
          {book ? '这本书里没有叫这个名字的章节。' : '书架上没有匹配的书。'}
        </p>
      ) : null}
    </div>
  )
}
