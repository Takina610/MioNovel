import { useEffect, useMemo, useRef, useState } from 'react'
import type { TocGroup } from '../../parsers/types'
import { formatChars } from '../../lib/format'
import { cx } from '../../lib/cx'
import { useToc, type TocRow } from '../../hooks/useToc'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { IconClose, IconSearch } from '../ui/icons'

interface TocPanelProps {
  open: boolean
  onClose: () => void
  bookId: string
  groups: TocGroup[]
  currentIndex: number
  onSelect: (chapterIndex: number) => void
}

export function TocPanel({
  open,
  onClose,
  bookId,
  groups,
  currentIndex,
  onSelect,
}: TocPanelProps) {
  const rows = useToc(bookId, groups)
  const [query, setQuery] = useState('')
  const currentRef = useRef<HTMLButtonElement>(null)

  const visible = useMemo(() => {
    const list = rows ?? []
    const needle = query.trim().toLowerCase()
    if (!needle) return list
    return list.filter((row) => row.label.toLowerCase().includes(needle))
  }, [rows, query])

  // 打开时把当前章滚到可见区域：读到 800 章的人不该每次都自己找位置
  useEffect(() => {
    if (!open) return
    setQuery('')
    const timer = window.setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: 'center' })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <Panel
      open={open}
      onClose={onClose}
      side="left"
      header={
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-fg">目录</h2>
            <Button size="sm" variant="ghost" className="px-2" onClick={onClose} aria-label="关闭">
              <IconClose className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜章节名"
              aria-label="搜章节名"
              className="h-9 w-full rounded-lg border border-border bg-bg pr-2.5 pl-8 text-[12.5px] transition-[border-color,box-shadow] duration-200 ease-[var(--mn-ease)] placeholder:text-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)] focus:outline-none"
            />
          </div>
        </div>
      }
    >
      {rows === undefined ? (
        // 目录可能上千行，读库要一点时间：给几条骨架条，不要只甩一行字
        <ul className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="mn-fade" style={{ animationDelay: `${index * 40}ms` }}>
              <span className="mn-skeleton block h-3.5 rounded-full" style={{ width: `${72 - index * 6}%` }} />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mn-fade p-4 text-[12.5px] text-fg-faint">
          {query ? '没有匹配的章节' : '这本书没有目录'}
        </p>
      ) : (
        <ul className="py-1">
          {visible.map((row) => (
            <TocItem
              key={row.type === 'group' ? `g-${row.index}-${row.label}` : `c-${row.index}`}
              row={row}
              current={row.type === 'chapter' && row.index === currentIndex}
              currentRef={currentRef}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function TocItem({
  row,
  current,
  currentRef,
  onSelect,
}: {
  row: TocRow
  current: boolean
  currentRef: React.RefObject<HTMLButtonElement | null>
  onSelect: (index: number) => void
}) {
  if (row.type === 'group') {
    return (
      <li
        className="mt-2 border-t border-border/60 px-3 pt-3 pb-1 text-[11.5px] font-medium tracking-wide text-fg-faint first:mt-0 first:border-t-0"
        style={{ paddingLeft: 12 + row.depth * 12 }}
      >
        {row.label}
      </li>
    )
  }

  return (
    <li className="relative">
      {/* 当前章左边那条：从中间撑开，比直接换背景色更清楚是「你在这」 */}
      <span
        aria-hidden
        className={cx(
          'absolute top-1.5 bottom-1.5 left-0 w-[3px] origin-center rounded-full bg-accent transition-transform duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
          current ? 'scale-y-100' : 'scale-y-0',
        )}
      />
      <button
        ref={current ? currentRef : undefined}
        type="button"
        onClick={() => onSelect(row.index)}
        className={cx(
          'flex w-full items-baseline gap-2 py-2 pr-3 text-left text-[13px] transition-colors duration-[var(--mn-dur-1)]',
          current ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-surface-2',
        )}
        style={{ paddingLeft: 12 + row.depth * 12 }}
      >
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {row.charCount ? (
          <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
            {formatChars(row.charCount)}
          </span>
        ) : null}
      </button>
    </li>
  )
}
