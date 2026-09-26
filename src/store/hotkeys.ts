import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { conflictedCombos, DEFAULT_HOTKEYS, resolveCombos, type HotkeyId } from '../lib/hotkey'

export {
  DEFAULT_HOTKEYS,
  HOTKEY_COMMANDS,
  HOTKEY_LABELS,
  hotkeyCommandOf,
  hotkeyLiveOn,
  resolveCombos,
  conflictOwners,
  conflictedCombos,
  conflictLabels,
} from '../lib/hotkey'
export type { HotkeyCommand, HotkeyId, HotkeyPresence, HotkeyScope } from '../lib/hotkey'

/**
 * 可自定义快捷键的**状态**（命令表在 lib/hotkey.ts，那边是纯数据、不依赖 zustand）。
 *
 * 一个功能可以绑**多个组合**（「下一页」默认就是 ↓ / → / Space / PageDown 四个），
 * 所以 combos 的值是数组；空的数组 = 这个功能暂时没有键（合法状态）。
 *
 * 这里只存「哪个功能绑了哪几串组合」，判定分散在两处：
 *
 *   hooks/useGlobalHotkeys   两个「伪装」功能（演示 / 摸鱼），全窗口唯一监听
 *   hooks/useHotkeys         页面里的命令（阅读设置 / 翻页 / 全屏…），各自登记
 *
 * recording 是「此刻正在录键」：录键那一下必须让**所有**快捷键让位，否则用户想把
 * Alt+S 改绑给别的功能时，摸鱼模式会先被切一遍（见 ui/HotkeyRow）。
 */
interface HotkeyState {
  combos: Record<HotkeyId, string[]>
  recording: boolean
  /** 给某条命令加一个组合。同一命令里重复的组合不写第二遍 */
  addCombo: (id: HotkeyId, combo: string) => void
  /** 删掉某条命令的一个组合 */
  removeCombo: (id: HotkeyId, combo: string) => void
  /** 某条命令整体回到默认 */
  resetCommand: (id: HotkeyId) => void
  setRecording: (recording: boolean) => void
}

export const useHotkeyBindings = create<HotkeyState>()(
  persist(
    (set) => ({
      combos: { ...DEFAULT_HOTKEYS },
      recording: false,
      addCombo: (id, combo) =>
        set((state) => {
          const current = state.combos[id] ?? []
          if (current.includes(combo)) return state
          return { combos: { ...state.combos, [id]: [...current, combo] } }
        }),
      removeCombo: (id, combo) =>
        set((state) => ({
          combos: { ...state.combos, [id]: (state.combos[id] ?? []).filter((c) => c !== combo) },
        })),
      resetCommand: (id) => set((state) => ({ combos: { ...state.combos, [id]: [...DEFAULT_HOTKEYS[id]] } })),
      setRecording: (recording) => set({ recording }),
    }),
    {
      name: 'mionovel:hotkeys',
      version: 2,
      // 只存组合。recording 是「此刻正在录键」，它跟着刷新回来只会让快捷键失灵
      partialize: (state) => ({ combos: state.combos }),
      // v1 存的是「一命令一组合」（字符串）；v2 起是一命令多组合（数组）。
      // 旧存档逐条包成数组搬过来，没听说过的命令扔掉。
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as { combos?: Record<string, unknown> }
        const combos: Partial<Record<HotkeyId, string[]>> = {}
        for (const [id, value] of Object.entries(saved.combos ?? {})) {
          if (!(id in DEFAULT_HOTKEYS)) continue
          if (typeof value === 'string') combos[id as HotkeyId] = value ? [value] : []
          else if (Array.isArray(value)) combos[id as HotkeyId] = value.filter((c) => typeof c === 'string')
        }
        return { combos: { ...DEFAULT_HOTKEYS, ...combos } }
      },
      // 命令表加了新功能时，老存档里没有它：合并一次，缺的那条回到默认值
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<HotkeyState>
        return { ...current, ...saved, combos: { ...current.combos, ...saved.combos } }
      },
    },
  ),
)

/**
 * 某个功能**生效中**的组合列表（组件里读它，录键控件与设置面板都走它）。
 * 先选原数组（store 里的引用是稳定的），再到渲染里解析——
 * 选择器每次都返回新数组会让 zustand 的快照比较失效。
 * 解析规则见 lib/hotkey.ts 的 resolveCombos（认不出的、不合作用域的、重复的都丢掉；
 * 空数组 = 用户把键全删了，不回退默认值）。
 */
export function useHotkeyCombos(id: HotkeyId): string[] {
  const raw = useHotkeyBindings((state) => state.combos[id])
  return resolveCombos(raw, id)
}

/** 组件里读单个功能的**第一个**组合（菜单提示用；键全删了就是空串） */
export function useHotkeyCombo(id: HotkeyId): string {
  return useHotkeyCombos(id)[0] ?? ''
}

/**
 * 冲突判定在 lib/hotkey.ts（conflictOwners / conflictedCombos / conflictLabels，
 * 纯函数、验收脚本直接断言）。这里只留 React 的入口：组件里读冲突集合用。
 */
export function useConflictedCombos(): Set<string> {
  const combos = useHotkeyBindings((state) => state.combos)
  return useMemo(() => conflictedCombos(combos), [combos])
}

/** 与 hooks 无关的场合（验收脚本）用这个：菜单提示的那一串 */
export function firstCombo(combos: Record<HotkeyId, string[]>, id: HotkeyId): string {
  return resolveCombos(combos[id], id)[0] ?? ''
}
