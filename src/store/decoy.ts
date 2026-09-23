import { useEffect } from 'react'
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
 * 快捷键（Alt+Q）改的也是同一个开关——两处入口、一个状态。
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

/**
 * Alt+Q 的监听。
 *
 * 挂在 window 上而不是走阅读器的 useHotkeys：那条路会跳掉所有带修饰键的组合，
 * 而且它只在阅读器里活着——演示模式在书架上也得能用。
 * 用 `event.code` 判键位：Alt 组合下 `key` 会跟着键盘布局变，`code` 不会。
 */
export function useDecoyHotkey(): void {
  const toggle = useDecoy((state) => state.toggle)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.code !== 'KeyQ' && event.key !== 'q' && event.key !== 'Q') return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])
}
