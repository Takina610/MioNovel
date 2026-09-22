import { useEffect, useMemo, useRef, useState } from 'react'
import type { TocGroup } from '../../parsers/types'
import { formatChars } from '../../lib/format'
import { cx } from '../../lib/cx'
import { useToc, type TocRow } from '../../hooks/useToc'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'

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
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="关闭">
              ✕
            </Button>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜章节名"
            className="mt-2 h-8 w-full rounded-md border border-border bg-bg px-2.5 text-[12.5px] placeholder:text-fg-faint"
          />
        </div>
      }
    >
      {rows === undefined ? (
        <p className="p-4 text-[12.5px] text-fg-faint">正在读目录…</p>
      ) : visible.length === 0 ? (
        <p className="p-4 text-[12.5px] text-fg-faint">
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
        className="px-3 pt-3 pb-1 text-[11.5px] font-medium tracking-wide text-fg-faint"
        style={{ paddingLeft: 12 + row.depth * 12 }}
      >
        {row.label}
      </li>
    )
  }

  return (
    <li>
      <button
        ref={current ? currentRef : undefined}
        type="button"
        onClick={() => onSelect(row.index)}
        className={cx(
          'flex w-full items-baseline gap-2 py-2 pr-3 text-left text-[13px] transition-colors',
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
