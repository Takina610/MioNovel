import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 摸鱼模式。
 *
 * 打开之后，编辑器形态的两块**正文区**（左侧文件树、右侧代码区）各盖一层黑纱：
 * 隔着几步看不出一行行是什么字，但屏幕上还亮着标题栏、活动栏和状态栏——
 * 远处看过去就是「开着编辑器」。整屏压暗反而像屏幕关了或者人在别处。
 *
 * 它和演示模式（store/decoy）是两件事，两个开关互不依赖：
 * 演示模式换的是**显示什么**（小说变代码），这里只改**有多亮**。
 * 一起开也行：一份暗着的代码文件。
 *
 * 开关和程度都持久化——理由和演示模式一样：设置面板里能改的东西，
 * 不该刷新一下就忘。程度留一个宽范围：不同距离、不同屏幕亮度下，
 * 「看不清」的那条线不在同一个地方。
 */
interface DimState {
  enabled: boolean
  /** 0-1，黑纱的不透明度，越大越暗 */
  level: number
  toggle: () => void
  setEnabled: (enabled: boolean) => void
  setLevel: (level: number) => void
}

/**
 * 滑条范围。上限不给到 1：全黑之后那块地方就只剩一个空洞，
 * 屏幕看上去像关掉了——而「看着像还开着」正是这个功能的前提。
 */
export const DIM_LEVEL_RANGE = { min: 0.1, max: 0.9, step: 0.05 } as const

export const useDim = create<DimState>()(
  persist(
    (set) => ({
      enabled: false,
      level: 0.5,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      setLevel: (level) => set({ level }),
    }),
    { name: 'mionovel:dim', version: 1 },
  ),
)

/** 黑纱的不透明度：关着就是 0。外壳直接把它的字符串形式写进 `--mn-dim` */
export function useDimLevel(): number {
  return useDim((state) => (state.enabled ? state.level : 0))
}
