import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'
import { IconBack, IconList, IconSliders } from '../ui/icons'

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
        'absolute inset-x-0 top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-xl',
        'transition-[transform,opacity] duration-[var(--mn-dur-3)] ease-[var(--mn-ease)]',
        // 收起时除了滑出去，也淡一点：只滑不淡在浅色主题下会看得见一圈影子
        shown ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-12 items-center gap-0.5 px-2">
        <Button variant="ghost" className="px-2" onClick={onBack} aria-label="回书架">
          <IconBack className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <div className="truncate text-[13.5px] font-medium text-fg">{title}</div>
          <div className="truncate text-[11.5px] text-fg-faint">{chapterTitle}</div>
        </div>
        <Button variant="ghost" className="gap-1.5 px-2.5" onClick={onToc}>
          <IconList className="h-4 w-4" />
          目录
        </Button>
        <Button variant="ghost" className="gap-1.5 px-2.5" onClick={onSettings}>
          <IconSliders className="h-4 w-4" />
          设置
        </Button>
      </div>
    </header>
  )
}
