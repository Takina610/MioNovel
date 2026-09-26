import { useEffect, useRef } from 'react'
import { hotkeyCommandOf, matchesCombo, type HotkeyId } from '../lib/hotkey'
import { useConflictedCombos, useHotkeyBindings, useHotkeyCombos } from '../store/hotkeys'

export type HotkeyHandler = (event: KeyboardEvent) => void

/**
 * 命令表里的一个快捷键（组合可以在阅读设置里改，一命令可以绑多个，表见 lib/hotkey.ts）。
 *
 * 命中判定：按下的组合只要是这条命令绑定的**任何一串**就算。
 * 和组合可改一样，按 scope 决定要不要避开输入框。
 * **每个页面只登记自己有的那几条**：书架没有目录可开，就不登记 toc；
 * 翻页键登记在 ReaderView，退出阅读登记在 ReaderPage。
 *
 * **冲突的组合不响**（见 store/hotkeys 的 conflictOwners）：同一串绑在两条命令上，
 * 谁先响应说不清，两边的这一串都停用——设置里红着的就是它们。
 *
 * enabled=false 时整个让位（这套外壳里没有这个功能）。
 */
export function useHotkey(id: HotkeyId, handler: () => void, enabled = true): void {
  const all = useHotkeyCombos(id)
  const conflicted = useConflictedCombos()
  const combos = all.filter((combo) => !conflicted.has(combo))
  const scope = hotkeyCommandOf(id).scope
  // handler 每次渲染都是新的闭包，用 ref 兜住，免得每渲染一次就换一遍监听
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })

  // effect 的依赖要稳定：数组每次渲染都是新引用，用拼接串当钥匙
  const key = combos.join('|')
  useEffect(() => {
    if (!enabled) return
    const list = key ? key.split('|') : []
    const onKeyDown = (event: KeyboardEvent) => {
      // 正在录键：这一下归录键控件（见 store/hotkeys 的 recording）
      if (useHotkeyBindings.getState().recording) return
      // 按住不放会连发，这些命令都是「切一下」的东西
      if (event.repeat) return
      if (!list.some((combo) => matchesCombo(event, combo))) return
      // focused 的组合可以是不带修饰键的单键（S / T / 空格）：那就不能在输入框里抢
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
  }, [key, scope, enabled])
}
