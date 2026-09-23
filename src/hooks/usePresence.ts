import { useEffect, useRef, useState } from 'react'

/**
 * 淡出用的小工具：值变成 null 之后，再多留 `exitMs` 毫秒。
 *
 * 为什么需要它：React 只会「卸载」元素，不会给元素时间播离场动画。想让 toast、
 * 下拉浮层这样登场也要退场的东西动起来，就必须把「值没了」和「DOM 还在」拆开：
 * 值没了之后先加一个离场类，等动画播完再真正卸载。
 *
 * 返回值里 `value` 是要渲染的内容（离场期间仍然是旧值），`leaving` 是给离场类用的。
 */
export function usePresence<T>(value: T | null, exitMs = 180): { value: T | null; leaving: boolean } {
  const [held, setHeld] = useState<T | null>(value)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (value !== null) {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current)
        timer.current = undefined
      }
      setHeld(value)
      setLeaving(false)
      return
    }
    // 值变空：留着旧内容播完离场动画再清掉。
    // held 为空说明本来就没东西可退场（首次渲染、或者已经退完了），直接返回——
    // 少了这一条，StrictMode 下重复执行的 effect 会把 leaving 卡在 true。
    if (held === null || timer.current !== undefined) return
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      setHeld(null)
      setLeaving(false)
    }, exitMs)
  }, [value, held, exitMs])

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current)
    },
    [],
  )

  return { value: held, leaving }
}
