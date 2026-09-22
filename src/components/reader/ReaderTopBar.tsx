import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'

interface ReaderTopBarProps {
  visible: boolean
  title: string
  chapterTitle: string
  /** 目录抽屉和设置面板打开时，工具栏要保持显示 */
  pinned: boolean
  onBack: () => void
  onToc: () => void
  onSettings: () => void
}

export function ReaderTopBar({
  visible,
  title,
  chapterTitle,
  pinned,
  onBack,
  onToc,
  onSettings,
}: ReaderTopBarProps) {
  const shown = visible || pinned

  return (
    <header
      className={cx(
        'absolute inset-x-0 top-0 z-30 border-b border-border bg-bg/92 backdrop-blur-md transition-transform duration-250 ease-[var(--mn-ease)]',
        shown ? 'translate-y-0' : '-translate-y-full',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-12 items-center gap-1 px-2">
        <Button variant="ghost" onClick={onBack} aria-label="回书架" className="px-2">
          ←
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[13.5px] font-medium text-fg">{title}</div>
          <div className="truncate text-[11.5px] text-fg-faint">{chapterTitle}</div>
        </div>
        <Button variant="ghost" onClick={onToc} aria-label="目录" className="px-2">
          目录
        </Button>
        <Button variant="ghost" onClick={onSettings} aria-label="设置" className="px-2">
          设置
        </Button>
      </div>
    </header>
  )
}
