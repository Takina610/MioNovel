import { useEffect } from 'react'
import { hotkeyLiveOn, matchesCombo, resolveCombos } from '../lib/hotkey'
import { useDecoy } from '../store/decoy'
import { useDim } from '../store/dim'
import { useHotkeyBindings } from '../store/hotkeys'

/**
 * 两个「伪装」功能的快捷键，挂在 App 上——书架、阅读器、五套外壳底下都得能按。
 *
 * 它们挂在 window 这一处，而不是走页面里的 useHotkey：这两个不管焦点在哪都要响
 * （命令表里是 global，必须带修饰键），而且判定必须只有一份。页面里的命令
 * （阅读设置 / 目录 / 全屏）走 useHotkeys 的 useHotkey，各自登记。
 *
 * **在不在，读 hotkeyLiveOn**（命令表里每条自己的 presence）：演示模式只属于
 * 编辑器形态；摸鱼模式属于所有带外壳的形态——五套办公外壳都能压暗正文那一片。
 * 键位与设置面板那一栏读的是同一个判断，不会再出现「面板里有开关、键却不响」。
 */
export function useGlobalHotkeys(): void {
  const combos = useHotkeyBindings((state) => state.combos)
  const toggleDecoy = useDecoy((state) => state.toggle)
  const toggleDim = useDim((state) => state.toggle)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 正在录新快捷键：这一下按键归录键控件，不然它会先把功能切一遍。
      // 用 getState 现读，免得录键这个动作让 App 重渲染一次。
      if (useHotkeyBindings.getState().recording) return
      // 按住不放会连续触发，而这两个都是「切一下」的东西，不该切成一串
      if (event.repeat) return

      // 读 <html> 上的 data-chrome，而不是 useChrome()：阅读器里某本书可能开着
      // 独立主题，那一层才是此刻真正生效的形态（见 themes/apply.ts）。
      const chrome = document.documentElement.dataset.chrome ?? ''

      if (resolveCombos(combos.decoy, 'decoy').some((combo) => matchesCombo(event, combo))) {
        if (!hotkeyLiveOn('decoy', chrome)) return
        event.preventDefault()
        toggleDecoy()
        return
      }

      if (resolveCombos(combos.dim, 'dim').some((combo) => matchesCombo(event, combo))) {
        if (!hotkeyLiveOn('dim', chrome)) return
        event.preventDefault()
        toggleDim()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combos, toggleDecoy, toggleDim])
}
