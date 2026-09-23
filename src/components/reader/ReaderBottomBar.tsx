import type { CSSProperties } from 'react'
import { formatPercent } from '../../lib/format'
import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'

interface ReaderBottomBarProps {
  visible: boolean
  /** 全书百分比 0-1 */
  percent: number
  chapterIndex: number
  chapterCount: number
  onPrev: () => void
  onNext: () => void
  /** 拖动进度条跳到全书某个位置 */
  onSeek: (percent: number) => void
}

export function ReaderBottomBar({
  visible,
  percent,
  chapterIndex,
  chapterCount,
  onPrev,
  onNext,
  onSeek,
}: ReaderBottomBarProps) {
  return (
    <footer
      className={cx(
        'absolute inset-x-0 bottom-0 z-30 border-t border-border bg-bg/85 backdrop-blur-xl',
        'transition-[transform,opacity] duration-[var(--mn-dur-3)] ease-[var(--mn-ease)]',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="px-4 pt-3">
        <input
          type="range"
          className="mn-range w-full"
          min={0}
          max={1000}
          step={1}
          value={Math.round(percent * 1000)}
          // 已读那一段的宽度（见 styles/app.css 的 .mn-range）
          style={{ '--mn-fill': `${percent * 100}%` } as CSSProperties}
          onChange={(event) => onSeek(Number(event.target.value) / 1000)}
          aria-label="全书进度"
        />
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        <Button variant="ghost" size="sm" onClick={onPrev} disabled={chapterIndex <= 0}>
          上一章
        </Button>
        <div className="min-w-0 flex-1 text-center text-[12px] text-fg-muted">
          <span className="tabular-nums">
            第 {chapterIndex + 1}/{chapterCount} 章
          </span>
          <span className="mx-1.5 text-fg-faint" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">{formatPercent(percent)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={chapterIndex >= chapterCount - 1}
        >
          下一章
        </Button>
      </div>
    </footer>
  )
}
