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
 *
 * 面板一直挂在 DOM 里，只切 transform/opacity：这样进出都有动画（卸载就没有离场可言），
 * 也不用为了退场再去维护一份「正在关闭」的状态。关闭时靠 pointer-events-none 挡住交互。
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
      if (event.key !== 'Escape') return
      // 面板里的下拉框开着的时候，Esc 先归它（Select 会在自己的触发按钮上打这个标记），
      // 不然按一下 Esc 连面板一起关掉——用户只是想收起下拉。
      // 用 instanceof 而不是 target?.closest()：事件的 target 不保证是元素
      // （合成事件可以派发到 window/document 上，那上面没有 closest）。
      const target = event.target
      if (target instanceof Element && target.closest('[data-mn-esc-local]')) return
      event.stopPropagation()
      onClose()
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
          'absolute inset-0 bg-overlay backdrop-blur-[3px] transition-opacity duration-[var(--mn-dur-3)] ease-[var(--mn-ease)]',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-modal={open}
        className={cx(
          'absolute flex flex-col bg-surface text-fg will-change-transform',
          'shadow-[var(--mn-shadow-panel)]',
          'transition-transform duration-[var(--mn-dur-3)] ease-[var(--mn-ease)]',
          side === 'left' ? 'inset-y-0 left-0' : 'inset-y-0 right-0',
          // 小屏：贴底，限高，圆角只圆上面两个
          'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:max-h-[82dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-t',
          open
            ? 'translate-x-0 translate-y-0'
            : side === 'left'
              ? 'max-md:translate-x-0 -translate-x-full max-md:translate-y-full'
              : 'max-md:translate-x-0 translate-x-full max-md:translate-y-full',
          'md:w-[min(88vw,380px)] md:border-l md:border-border',
          side === 'left' ? 'md:border-l-0 md:border-r' : '',
        )}
      >
        {/* 手机上的抽屉把手：告诉用户这东西是贴着底边的。走文档流而不是绝对定位，
            免得盖住各面板自己那套 header */}
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong md:hidden" />
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
