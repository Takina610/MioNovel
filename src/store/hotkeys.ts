import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  comboProblem,
  DEFAULT_HOTKEYS,
  hotkeyCommandOf,
  type HotkeyId,
} from '../lib/hotkey'

export {
  DEFAULT_HOTKEYS,
  HOTKEY_COMMANDS,
  HOTKEY_LABELS,
  hotkeyCommandOf,
  hotkeyLiveOn,
} from '../lib/hotkey'
export type { HotkeyCommand, HotkeyId, HotkeyPresence, HotkeyScope } from '../lib/hotkey'

/**
 * 可自定义快捷键的**状态**（命令表在 lib/hotkey.ts，那边是纯数据、不依赖 zustand）。
 *
 * 这里只存「哪个功能绑了哪串组合」，判定分散在两处：
 *
 *   hooks/useGlobalHotkeys   两个「伪装」功能（演示 / 摸鱼），全窗口唯一监听
 *   hooks/useHotkeys         页面里的命令（阅读设置 / 目录 / 全屏），各自登记
 *
 * recording 是「此刻正在录键」：录键那一下必须让**所有**快捷键让位，否则用户想把
 * Alt+S 改绑给别的功能时，摸鱼模式会先被切一遍（见 ui/HotkeyInput）。
 */
interface HotkeyState {
  combos: Record<HotkeyId, string>
  recording: boolean
  setCombo: (id: HotkeyId, combo: string) => void
  resetCombo: (id: HotkeyId) => void
  setRecording: (recording: boolean) => void
}

export const useHotkeyBindings = create<HotkeyState>()(
  persist(
    (set) => ({
      combos: { ...DEFAULT_HOTKEYS },
      recording: false,
      setCombo: (id, combo) => set((state) => ({ combos: { ...state.combos, [id]: combo } })),
      resetCombo: (id) =>
        set((state) => ({ combos: { ...state.combos, [id]: DEFAULT_HOTKEYS[id] } })),
      setRecording: (recording) => set({ recording }),
    }),
    {
      name: 'mionovel:hotkeys',
      version: 1,
      // 只存组合。recording 是「此刻正在录键」，它跟着刷新回来只会让快捷键失灵
      partialize: (state) => ({ combos: state.combos }),
      // 命令表加了新功能时，老存档里没有它：合并一次，缺的那条回到默认值
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<HotkeyState>
        return { ...current, ...saved, combos: { ...current.combos, ...saved.combos } }
      },
    },
  ),
)

/**
 * 某个功能**生效中**的组合。
 *
 * 顺手挡住「存档被手改坏」：认不出来、或者不符合它那一档的组合（比如给全窗口的
 * 功能存了一个单字母），回落到默认值——而不是把一串乱码显示在菜单里、按了还没反应。
 */
export function resolveCombo(combos: Record<HotkeyId, string>, id: HotkeyId): string {
  const command = hotkeyCommandOf(id)
  const combo = combos[id]
  if (combo && !comboProblem(combo, command.scope)) return combo
  return command.combo
}

/** 组件里读单个功能的组合（菜单提示、录键控件都走它） */
export function useHotkeyCombo(id: HotkeyId): string {
  const combo = useHotkeyBindings((state) => state.combos[id])
  return resolveCombo({ ...DEFAULT_HOTKEYS, [id]: combo }, id)
}
