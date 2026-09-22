import { useEffect } from 'react'

export type HotkeyHandler = (event: KeyboardEvent) => void

/**
 * 键盘快捷键。
 *
 * 输入框里打字时不触发——这是最容易忘、也最烦人的一条。
 * 另外跳过带修饰键的组合（除非 handler 自己处理），免得和浏览器快捷键打架。
 */
export function useHotkeys(handler: HotkeyHandler, deps: unknown[] = []): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
