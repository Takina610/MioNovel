import { useEffect, useRef } from 'react'
import { hotkeyCommandOf, matchesCombo, type HotkeyId } from '../lib/hotkey'
import { useHotkeyBindings, useHotkeyCombo } from '../store/hotkeys'

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

/**
 * 命令表里的一个快捷键（组合可以在阅读设置里改，表见 lib/hotkey.ts）。
 *
 * 和上面那个 useHotkeys 是两件事：那个绑「一组固定的键」（Esc 这类约定），
 * 这个绑「一条命令」——组合可改，按 scope 决定要不要避开输入框。
 * **每个页面只登记自己有的那几条**：书架没有目录可开，就不登记 toc；
 * 五套办公外壳的首页由 ShelfShell 统一登记。
 *
 * enabled=false 时整个让位（这套外壳里没有这个功能）。
 */
export function useHotkey(id: HotkeyId, handler: () => void, enabled = true): void {
  const combo = useHotkeyCombo(id)
  const scope = hotkeyCommandOf(id).scope
  // handler 每次渲染都是新的闭包，用 ref 兜住，免得每渲染一次就换一遍监听
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      // 正在录键：这一下归录键控件（见 store/hotkeys 的 recording）
      if (useHotkeyBindings.getState().recording) return
      // 按住不放会连发，这些命令都是「切一下」的东西
      if (event.repeat) return
      if (!matchesCombo(event, combo)) return
      // focused 的组合可以是不带修饰键的单键（S / T / F）：那就不能在输入框里抢
      if (scope === 'focused') {
        const target = event.target as HTMLElement | null
        if (target) {
          const tag = target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
            return
          }
        }
      }
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, scope, enabled])
}
