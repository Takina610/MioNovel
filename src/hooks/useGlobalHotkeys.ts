import { useEffect } from 'react'
import { matchesCombo } from '../lib/hotkey'
import { useDecoy } from '../store/decoy'
import { useDim } from '../store/dim'
import { useHotkeyBindings } from '../store/hotkeys'

/**
 * 两个「伪装」功能的快捷键，挂在 App 上——书架和阅读器都得能按。
 *
 * 挂在 window 上而不是走阅读器的 useHotkeys：那条路会跳掉所有带修饰键的组合，
 * 而且它只在阅读器里活着。组合可改，判定见 lib/hotkey.ts（按 event.code 比键位）。
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

      if (matchesCombo(event, combos.decoy)) {
        event.preventDefault()
        toggleDecoy()
        return
      }

      if (matchesCombo(event, combos.dim)) {
        // 摸鱼模式只属于编辑器形态：普通形态下这个开关在设置里都看不见，
        // 按下去也该什么都不做（否则键位被悄悄占掉，状态却要等切回编辑器才看得见）。
        // 读 <html> 上的 data-chrome，而不是 useChrome()：阅读器里某本书可能开着
        // 独立主题，那一层才是此刻真正生效的形态（见 themes/apply.ts）。
        if (document.documentElement.dataset.chrome !== 'code') return
        event.preventDefault()
        toggleDim()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combos, toggleDecoy, toggleDim])
}
