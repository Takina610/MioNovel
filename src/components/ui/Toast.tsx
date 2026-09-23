import { usePresence } from '../../hooks/usePresence'
import { cx } from '../../lib/cx'
import { IconInfo } from './icons'

interface ToastProps {
  message: string | null
  onDismiss: () => void
}

/**
 * 一次性的提示条（重复导入被跳过这类）。
 *
 * 消失时间由 store 定（5 秒），这里只管两件事：登场从那一条上浮 + 淡入，
 * 消失时先播 180ms 的离场动画再卸载（store 一置空就卸载的话，视觉上是「啪」地不见）。
 */
export function Toast({ message, onDismiss }: ToastProps) {
  const { value, leaving } = usePresence(message, 180)

  if (value === null) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-60 flex justify-center px-4">
      <button
        type="button"
        onClick={onDismiss}
        className={cx(
          'pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-border bg-surface/95 py-2 pr-4 pl-3 text-[12.5px] text-fg shadow-[var(--mn-shadow-float)] backdrop-blur-md',
          leaving ? 'mn-fade-out' : 'mn-rise',
        )}
      >
        <IconInfo className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 truncate">{value}</span>
      </button>
    </div>
  )
}
