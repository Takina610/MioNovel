import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseCombo } from '../lib/hotkey'

/**
 * 可自定义的全局快捷键。
 *
 * 只存两个功能各自的组合串（`Alt+Q` 这种，判定见 lib/hotkey.ts），
 * 真实监听只有一处：hooks/useGlobalHotkeys。
 *
 * 为什么不做成「一键换绑所有操作」的通用快捷键系统：这个应用里需要全局
 * 快捷键的只有这两个「伪装」功能（阅读器的 t / s / f 走的是另一条路，
 * 它们只在阅读器里、且不带修饰键）。为一个还不存在的需求先造一套映射表，
 * 以后每个新命令都要在这里登记一次，不值得。
 */
export type HotkeyId = 'decoy' | 'dim'

export const DEFAULT_HOTKEYS: Record<HotkeyId, string> = {
  decoy: 'Alt+Q',
  dim: 'Alt+S',
}

/** 冲突提示里要把对方的名字说出来，所以标签也放这儿，和默认值挨着 */
export const HOTKEY_LABELS: Record<HotkeyId, string> = {
  decoy: '演示模式',
  dim: '摸鱼模式',
}

interface HotkeyState {
  combos: Record<HotkeyId, string>
  /**
   * 正在录新组合。录键那一刻全局快捷键必须让位——否则用户按下 Alt+S 想把它绑给
   * 演示模式，摸鱼模式会先被切一遍（见 ui/HotkeyInput.tsx）。
   */
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
      // 以后加第三个功能时，老存档里没有它：合并一次，缺的回到默认值
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<HotkeyState>
        return { ...current, ...saved, combos: { ...current.combos, ...saved.combos } }
      },
    },
  ),
)

/**
 * 一份组合表里某个功能**生效中**的组合。
 * 顺手挡住「存档被手改坏」：认不出来的组合回落到默认值，而不是把一串乱码
 * 显示在菜单里、按了还没反应。
 */
export function resolveCombo(combos: Record<HotkeyId, string>, id: HotkeyId): string {
  return parseCombo(combos[id]) ? combos[id] : DEFAULT_HOTKEYS[id]
}

/** 组件里读单个功能的组合（菜单提示、录键控件都走它） */
export function useHotkeyCombo(id: HotkeyId): string {
  const combo = useHotkeyBindings((state) => state.combos[id])
  return parseCombo(combo) ? combo : DEFAULT_HOTKEYS[id]
}
