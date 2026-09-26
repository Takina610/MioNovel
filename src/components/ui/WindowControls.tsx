import { useEffect, useState, type HTMLAttributes, type MouseEvent } from 'react'
import { desktopInvoke, isDesktop, isMiniWindow } from '../../lib/desktop'
import { cx } from '../../lib/cx'
import { IconClose, IconWindowMax, IconWindowMin, IconWindowRestore } from './icons'

/**
 * 桌面端无框窗口的标题栏部件。
 *
 * 桌面壳上，**非常规主题**（七套带外壳的形态）把 Windows 原生标题栏收掉，
 * 最小化 / 最大化 / 关闭挪进外壳自己的顶栏——那一条本来就是「窗口的标题栏」，
 * 再叠一条原生的是重复。普通阅读形态保持带边的原生窗口。
 *
 * 收放的决定点在**应用主题的那两处**（hooks/useTheme 的 useGlobalTheme 与
 * useScopedTheme）：主题在哪应用，set_decorations 就在哪推——不设一个从
 * DOM 属性反推形态的观察器（同一次提交里「挂载读属性、effect 写属性」
 * 的先后在 StrictMode 下对不上，踩过）。
 *
 * 这一簇只会被七套外壳的顶栏渲染；外壳挂着，形态就必然不是 plain。
 * 所以这里只排除两处：浏览器（PWA 没有窗口控制这回事）和小窗
 * （小窗天生无框，也不该动主窗口）。「关闭」走壳上的 window_close：
 * 按设置-高级里选的关窗行为执行（藏进托盘 / 退出程序），与原生标题栏
 * 的 × 同一条路。
 */

/** 此刻要不要挂自绘的窗口控制（无框外壳顶栏的三颗钮） */
export function useFrameless(): boolean {
  return isDesktop() && !isMiniWindow()
}

/** 最大化按钮的图标跟真实状态走：不经按钮的最大化（拖到屏幕顶、Win+↑）也要跟上 */
function useMaximized(active: boolean): boolean {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    if (!active) return
    let disposed = false
    const sync = () => {
      void desktopInvoke<boolean>('window_is_maximized').then((value) => {
        if (!disposed) setMaximized(value === true)
      })
    }
    sync()
    const timer = window.setInterval(sync, 1000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [active])
  return maximized
}

const INTERACTIVE = 'button,input,textarea,select,a,[role="menu"],[role="menuitem"],label'

/** 两次按下间隔小于这个值 = 双击（最大化 ⇄ 还原），单位毫秒 */
const DOUBLE_PRESS_MS = 400

/**
 * 顶栏的拖拽区。`data-mn-drag` 标在顶栏容器和里面**不动的那几块字**上：
 * 单击按住拖动窗口，快速二连击切最大化——和原生标题栏同一套手感。
 * 落点若是按钮、输入框这类交互元素，让位给它们。
 *
 * 双击**不监听 dblclick 事件**：第一下 mousedown 已经让壳进入拖拽的模态
 * 循环，第二个 dblclick 常被它吃掉；改成自己按两次按下的间隔判。
 * 浏览器里返回空对象，JSX 里照常展开。
 */
export function chromeDragProps(): HTMLAttributes<HTMLElement> {
  if (!isDesktop() || isMiniWindow()) return {}
  let lastPress = 0
  const press = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (!target?.closest('[data-mn-drag]')) return
    if (target.closest(INTERACTIVE)) return
    const now = Date.now()
    if (now - lastPress < DOUBLE_PRESS_MS) {
      lastPress = 0
      void desktopInvoke<boolean>('window_toggle_maximize')
      return
    }
    lastPress = now
    void desktopInvoke('window_drag')
  }
  return { onMouseDown: press }
}

/**
 * 顶栏右上角的三颗钮：最小化 / 最大化（已最大化时是还原）/ 关闭。
 * 高度随所在顶栏撑满（self-stretch），颜色全走主题 token——
 * 七套外壳共用这一份，亮暗主题各自动。
 */
export function WindowControls({ className }: { className?: string }) {
  const frameless = useFrameless()
  const maximized = useMaximized(frameless)
  if (!frameless) return null
  const base =
    'flex w-10 items-center justify-center text-fg-muted transition-colors duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2 hover:text-fg'
  return (
    <div className={cx('flex shrink-0 items-stretch self-stretch', className)}>
      <button
        type="button"
        className={base}
        title="最小化"
        aria-label="最小化"
        onClick={() => void desktopInvoke('window_minimize')}
      >
        <IconWindowMin className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={base}
        title={maximized ? '还原' : '最大化'}
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => void desktopInvoke<boolean>('window_toggle_maximize')}
      >
        {maximized ? <IconWindowRestore className="h-4 w-4" /> : <IconWindowMax className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className={cx(base, 'hover:text-danger')}
        title="关闭窗口"
        aria-label="关闭窗口"
        onClick={() => void desktopInvoke('window_close')}
      >
        <IconClose className="h-4 w-4" />
      </button>
    </div>
  )
}
