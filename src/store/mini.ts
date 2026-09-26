import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 小窗模式（桌面端）。
 *
 * 开关与落角存这里；快捷键的键位走命令表（lib/hotkey.ts 的 mini-window，
 * 和别的快捷键同一张表、同一个设置控件）。这些设置的**执行人**是桌面壳
 * （src-tauri/src/mini.rs）：hooks/useMiniWindow 把它们推过去，壳负责建窗、
 * 落位、悬浮显隐和注册系统级快捷键。浏览器（PWA）里没有壳，这里的状态
 * 存了也无人消费——所以设置弹窗里那一栏只在桌面端出现。
 */
export type MiniCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * 小窗此刻可不可用：桌面端即可（**任何主题都能开**）。小窗的视觉直接沿用
 * 全局主题的令牌——亮色主题下小窗是亮的、暗色下是暗的、羊皮下就是羊皮，
 * 不需要按主题限制。设置弹窗里那一栏的出现条件与桥推给壳的 enabled 用的是
 * 同一个函数——「弹窗里有这一栏」和「壳上真的会有窗」不许各判各的。
 */
export function miniAvailable(_themeId: string, desktop: boolean): boolean {
  return desktop
}

export const MINI_CORNERS: ReadonlyArray<{ id: MiniCorner; label: string }> = [
  { id: 'top-left', label: '左上' },
  { id: 'top-right', label: '右上' },
  { id: 'bottom-left', label: '左下' },
  { id: 'bottom-right', label: '右下' },
]

/** 小窗整体的不透明度范围。再透就读不清了 */
export const MINI_OPACITY_RANGE = { min: 0.3, max: 1, step: 0.05 } as const

/** 黑纱的范围（同摸鱼模式的思路）：全黑之后那块只剩一个空洞，不像在读书 */
export const MINI_DIM_RANGE = { min: 0, max: 0.9, step: 0.05 } as const

interface MiniState {
  enabled: boolean
  corner: MiniCorner
  /** 小窗整体不透明度，1 = 不透明 */
  opacity: number
  /** 盖在小窗上的黑纱浓度，0 = 不变暗 */
  dim: number
  toggle: () => void
  setEnabled: (enabled: boolean) => void
  setCorner: (corner: MiniCorner) => void
  setOpacity: (opacity: number) => void
  setDim: (dim: number) => void
}

export const useMini = create<MiniState>()(
  persist(
    (set) => ({
      enabled: false,
      corner: 'bottom-right',
      opacity: 1,
      dim: 0,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      setCorner: (corner) => set({ corner }),
      setOpacity: (opacity) => set({ opacity }),
      setDim: (dim) => set({ dim }),
    }),
    { name: 'mionovel:mini', version: 1 },
  ),
)
