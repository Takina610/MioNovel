import { desktopInvoke } from '../lib/desktop'
import { IconFullscreen } from '../components/ui/app-icons'

/** 右上角的「放大」：壳把主窗口还原、小窗收掉，设置随之翻回关 */
export function MiniRestoreButton() {
  return (
    <button
      type="button"
      aria-label="恢复主窗口"
      title="恢复主窗口"
      onClick={() => void desktopInvoke('mini_request_restore')}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2 hover:text-fg"
    >
      <IconFullscreen className="h-4 w-4" />
    </button>
  )
}
