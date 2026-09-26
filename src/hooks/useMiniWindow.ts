import { useEffect } from 'react'
import { desktopInvoke, isDesktop } from '../lib/desktop'
import { resolveCombos } from '../lib/hotkey'
import { useHotkeyBindings } from '../store/hotkeys'
import { miniAvailable, useMini } from '../store/mini'
import { useSettings } from '../store/settings'

/** 快捷键 / 放大按钮标志位的轮询间隔。窗口行为在壳里已经即时发生，
 *  这里只负责把 store 同步回去；主窗口藏着时浏览器会把定时器节流到 1s，无妨 */
const EVENTS_POLL_MS = 500

/**
 * 小窗模式与桌面壳的桥（挂在主窗口这一侧，见 App.tsx）。
 *
 * 设置变化（开关、落角、快捷键）随时推给壳（src-tauri/src/mini.rs 的
 * mini_apply）；壳上的**系统级**快捷键按下、或小窗里的「放大」被点时，
 * 壳会直接把窗口做掉（不等轮询），这里每 500ms 扫一次标志把 store 同步回
 * （mini_take_events，取走即清）。开关状态只有 store/mini 一份，壳只是执行人。
 * 浏览器里空转。
 */
export function useMiniWindow(): void {
  const enabled = useMini((state) => state.enabled)
  const corner = useMini((state) => state.corner)
  const rawCombos = useHotkeyBindings((state) => state.combos['mini-window'])
  const themeId = useSettings((state) => state.global.themeId)

  // 任何主题都能开小窗（小窗视觉直接沿用全局主题：亮色主题下小窗是亮的、
  // 暗色下是暗的）。可用性判断与设置弹窗里那一栏的出现条件是同一个函数
  // （store/mini 的 miniAvailable）
  const available = miniAvailable(themeId, isDesktop())
  const active = enabled && available
  // 依赖要稳定：数组直接进依赖会让 effect 每次渲染都重推一遍配置
  const hotkeys = resolveCombos(rawCombos, 'mini-window').join('|')

  useEffect(() => {
    if (!isDesktop()) return
    const list = hotkeys ? hotkeys.split('|') : []
    // themeId 一起推：壳把它 eval 进小窗，主题切换即时跟随（localStorage
    // 跨进程同步有延迟，靠它不行）
    void desktopInvoke('mini_apply', {
      config: { enabled: active, corner, hotkeys: list, themeId },
    })
  }, [active, corner, hotkeys, themeId])

  useEffect(() => {
    if (!isDesktop()) return
    const timer = window.setInterval(() => {
      void desktopInvoke<{ toggle: boolean; restore: boolean }>('mini_take_events').then(
        (events) => {
          if (!events) return
          // 放大：主窗口已经由壳还原了，这里把设置翻回关（连带关掉小窗）
          if (events.restore) useMini.getState().setEnabled(false)
          // 快捷键：壳已经把窗口做了，这里只补设置
          else if (events.toggle) useMini.getState().toggle()
        },
      )
    }, EVENTS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

}
