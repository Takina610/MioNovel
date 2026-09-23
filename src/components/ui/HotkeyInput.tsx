import { useEffect, useRef, useState } from 'react'
import { comboFromEvent, comboProblem } from '../../lib/hotkey'
import { cx } from '../../lib/cx'
import { useHotkeyBindings } from '../../store/hotkeys'

interface HotkeyInputProps {
  /** 功能名，只用在 aria-label 上（面板里那一行的标题是共用的「快捷键」） */
  name: string
  combo: string
  onChange: (combo: string) => void
  onReset: () => void
  /** 除了「必须带修饰键」之外还要查的条件（比如已被另一个功能占用），返回文案表示不可用 */
  check?: (combo: string) => string | null
}

/**
 * 改一个快捷键：点一下就进入录键，接着按什么就是什么。
 *
 * 录键期间键盘事件由它自己吃掉（capture + preventDefault + stopPropagation）：
 * 不这么做的话，用户想把 Alt+S 绑给演示模式，摸鱼模式会先被切一遍——
 * 「录下来的那一下也真的触发了功能」是这个控件最容易出的错。
 * 同理，store 里有一个 recording 标记，全局快捷键看到它就整个让位。
 *
 * Esc 取消，Backspace / Delete 恢复默认。修饰键单独按不算一个组合（它们只是前缀）。
 */
export function HotkeyInput({ name, combo, onChange, onReset, check }: HotkeyInputProps) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const setGlobalRecording = useHotkeyBindings((state) => state.setRecording)

  useEffect(() => {
    setGlobalRecording(recording)
    // 卸载（面板被销毁）时别把标记留在 store 里，否则全局快捷键会一直不响
    return () => setGlobalRecording(false)
  }, [recording, setGlobalRecording])

  useEffect(() => {
    if (!recording) return
    const stop = () => setRecording(false)

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        stop()
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        onReset()
        setError(null)
        stop()
        return
      }
      const next = comboFromEvent(event)
      // 只按了修饰键：它还不是一个组合，继续等真正的那个键
      if (!next) return
      const problem = comboProblem(next) ?? check?.(next) ?? null
      if (problem) {
        setError(problem)
        return
      }
      onChange(next)
      setError(null)
      stop()
    }

    // 点别处也算放弃（Safari 里点按钮不聚焦，光靠 blur 收不到）
    const onPointerDown = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) stop()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [recording, onChange, onReset, check])

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] text-fg-muted">快捷键</span>
      <span className="flex flex-col items-end gap-1">
        <button
          ref={buttonRef}
          type="button"
          // 录键时按 Esc 只该取消录键，不该连设置面板一起关掉（面板认这个标记，见 ui/Panel.tsx）
          data-mn-esc-local={recording ? '' : undefined}
          aria-label={`${name}快捷键：${recording ? '正在录制' : combo}`}
          onClick={() => {
            setError(null)
            setRecording((open) => !open)
          }}
          className={cx(
            'h-7 min-w-[96px] rounded-lg border px-3 font-mono text-[12px]',
            'transition-[border-color,background-color,color,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
            recording
              ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
              : 'border-border text-fg hover:border-border-strong hover:bg-surface-2',
          )}
        >
          {recording ? '按下按键…' : combo}
        </button>
        <span className={cx('text-[11px]', error ? 'text-danger' : 'text-fg-faint')}>
          {error ?? (recording ? 'Esc 取消，Backspace 恢复默认' : '点一下改键')}
        </span>
      </span>
    </div>
  )
}
