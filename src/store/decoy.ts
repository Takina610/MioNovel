import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DECOY_PRESET } from '../lib/decoy'

/**
 * 演示模式。
 *
 * 打开之后，编辑器形态里所有说明文字都换成看着像真的的代码：书名变成仓库名、
 * 章节变成文件名、正文每一段变成一行代码（具体是哪门语言的代码由 preset 决定，
 * 模板在 lib/decoy.ts）。它不改任何数据，只改「怎么显示」。
 *
 * 开关是**持久化**的：阅读设置里能手动打开，那它就该像别的设置一样被记住。
 * 快捷键改的也是同一个开关——两处入口、一个状态。快捷键本身在哪、
 * 怎么监听见 store/hotkeys 与 hooks/useGlobalHotkeys。
 */
interface DecoyState {
  enabled: boolean
  preset: string
  toggle: () => void
  setEnabled: (enabled: boolean) => void
  setPreset: (preset: string) => void
}

export const useDecoy = create<DecoyState>()(
  persist(
    (set) => ({
      enabled: false,
      preset: DEFAULT_DECOY_PRESET,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      setPreset: (preset) => set({ preset }),
    }),
    { name: 'mionovel:decoy', version: 1 },
  ),
)
