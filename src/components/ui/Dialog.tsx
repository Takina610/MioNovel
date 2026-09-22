import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * 用原生 <dialog>：焦点陷阱、Esc 关闭、backdrop 焦点隔离都是浏览器给的，
 * 自己实现这些细节是凭空找 bug。
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // 点遮罩关闭：命中 dialog 本身说明点的是它周围的空白区域
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cx(
        'm-auto w-[min(94vw,520px)] rounded-2xl border border-border bg-surface p-5 text-fg',
        'backdrop:bg-overlay open:flex open:flex-col',
        className,
      )}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-fg-muted">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
      {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
    </dialog>
  )
}
