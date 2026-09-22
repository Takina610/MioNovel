import { useEffect, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface PanelProps {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  /** 顶部标题区。传进来是为了让每个面板自己决定放什么 */
  header?: ReactNode
  children: ReactNode
}

/**
 * 侧边面板：目录从左出，设置从右出。
 * 手机上自动变成底部抽屉——顶着一个 380px 的侧栏在小屏上没法用。
 */
export function Panel({ open, onClose, side = 'right', header, children }: PanelProps) {
  // 打开时锁住背后的滚动，否则滑面板会带着正文一起动
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  return (
    <div
      className={cx(
        'fixed inset-0 z-50',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cx(
          'absolute inset-0 bg-overlay transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-modal={open}
        className={cx(
          'absolute flex flex-col bg-surface text-fg shadow-xl transition-transform duration-250 ease-[var(--mn-ease)]',
          side === 'left' ? 'inset-y-0 left-0' : 'inset-y-0 right-0',
          // 小屏：贴底，限高，圆角只圆上面两个
          'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:max-h-[78dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-t',
          open
            ? 'translate-x-0 translate-y-0'
            : side === 'left'
              ? 'max-md:translate-x-0 -translate-x-full max-md:translate-y-full'
              : 'max-md:translate-x-0 translate-x-full max-md:translate-y-full',
          'md:w-[min(88vw,380px)] md:border-l md:border-border',
          side === 'left' ? 'md:border-l-0 md:border-r' : '',
        )}
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
