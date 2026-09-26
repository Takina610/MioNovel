import { useEffect, useMemo, useRef, useState } from 'react'
import { comboDisplay, comboFromEvent, comboProblem, type HotkeyScope } from '../../lib/hotkey'
import { cx } from '../../lib/cx'
import { useHotkeyBindings } from '../../store/hotkeys'
import { IconClose } from './icons'

/** 这一行里的一个冲突组合：它和哪些别的功能绑了同一串 */
export interface ComboConflict {
  combo: string
  others: string[]
}

interface HotkeyRowProps {
  /** 功能名，这一行左上角的字就是它 */
  label: string
  description: string
  /** 生效中的组合（已解析）。空的数组是合法状态：这个功能暂时没有键 */
  combos: string[]
  /** 默认组合。「恢复默认」只在偏离默认时出现 */
  defaults: string[]
  /** 这一条属于哪一档（global 必须带修饰键，focused 可以是单键）。见 lib/hotkey.ts */
  scope: HotkeyScope
  onAdd: (combo: string) => void
  onRemove: (combo: string) => void
  onReset: () => void
  /** 这一行里冲突着的组合（和别的功能绑了同一串）。冲突不拦着录——
   *  红字加上「两边的这一串都停用」就是后果，比录的时候挡住更看得见 */
  conflicts?: ComboConflict[]
}

/**
 * 快捷键设置的一行：标题和说明在上，**这条功能的所有组合**在下面——
 * 每串组合是一枚 chip，右边的 ×（做大了一点，好点）删掉它；右上角点
 * 「设置快捷键」进入录键，按下的组合**追加**进去。偏离默认时旁边出现
 * 「恢复默认」。
 *
 * **冲突的组合标红**：同一串绑在两条命令上，谁先响应说不清，两边的这一串
 * 都停用（运行时判定见 store/hotkeys 的 conflictOwners），chip 底下一行字
 * 说清和谁撞了。
 *
 * 录键期间键盘事件由它自己吃掉（capture + preventDefault + stopPropagation）：
 * 不这么做的话，用户想把 Alt+S 绑给演示模式，摸鱼模式会先被切一遍——
 * 「录下来的那一下也真的触发了功能」是这个控件最容易出的错。
 * 同理，store 里有一个 recording 标记，全局快捷键看到它就整个让位。
 *
 * Esc 取消录键，Backspace / Delete 恢复默认。修饰键单独按不算一个组合（它们只是前缀）。
 */
export function HotkeyRow({
  label,
  description,
  combos,
  defaults,
  scope,
  onAdd,
  onRemove,
  onReset,
  conflicts,
}: HotkeyRowProps) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const setGlobalRecording = useHotkeyBindings((state) => state.setRecording)
  const conflictedCombos = useMemo(
    () => new Set((conflicts ?? []).map((item) => item.combo)),
    [conflicts],
  )

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
      if (combos.includes(next)) {
        setError('这个组合已经绑过了')
        return
      }
      const problem = comboProblem(next, scope)
      if (problem) {
        setError(problem)
        return
      }
      // 和别的功能撞了也照录：设置里会标红、这一串两边都停用（见 conflicts）
      onAdd(next)
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
  }, [recording, combos, onAdd, onReset, scope])

  // 和默认对不上了才给「恢复默认」：贴着默认的时候它只是噪音
  const modified =
    combos.length !== defaults.length ||
    [...combos].sort().join('|') !== [...defaults].sort().join('|')

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-fg">{label}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {modified ? (
            <button
              type="button"
              onClick={() => {
                onReset()
                setError(null)
              }}
              className="rounded-lg px-2 py-1.5 text-[12.5px] text-fg-muted transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2 hover:text-fg"
            >
              恢复默认
            </button>
          ) : null}
          <button
            ref={buttonRef}
            type="button"
            // 录键时按 Esc 只该取消录键，不该连设置面板一起关掉（面板认这个标记）
            data-mn-esc-local={recording ? '' : undefined}
            aria-label={`${label}：${recording ? '正在录制快捷键' : '设置快捷键'}`}
            onClick={() => {
              setError(null)
              setRecording((open) => !open)
            }}
            className={cx(
              'h-8 min-w-[96px] rounded-lg border px-3 text-[12.5px]',
              'transition-[border-color,background-color,color,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
              recording
                ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
                : 'border-border text-fg hover:border-border-strong hover:bg-surface-2',
            )}
          >
            {recording ? '按下按键…' : '设置快捷键'}
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {combos.map((combo) => {
          const conflicted = conflictedCombos.has(combo)
          return (
            <span
              key={combo}
              className={cx(
                'flex items-center gap-0.5 rounded-lg border bg-bg py-1 pl-2.5 pr-1 font-mono text-[12.5px]',
                conflicted
                  ? // 冲突的组合：红着，运行时它也不响（两边的这一串都停用）
                    'border-danger text-danger'
                  : 'border-border text-fg',
              )}
            >
              {comboDisplay(combo)}
              <button
                type="button"
                aria-label={`删除 ${label}的 ${comboDisplay(combo)}`}
                onClick={() => onRemove(combo)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-fg-faint transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] hover:bg-surface-2 hover:text-danger"
              >
                {/* × 比常规图标大一号：它删的是整串组合，点错比点不到更伤 */}
                <IconClose className="h-4 w-4" />
              </button>
            </span>
          )
        })}
        {combos.length === 0 ? (
          <span className="text-[12.5px] text-fg-faint">未绑定快捷键</span>
        ) : null}
      </div>

      {/* 冲突说清「和谁」：用户要能照着这行字去把另一处改掉 */}
      {conflicts && conflicts.length > 0 ? (
        <div className="mt-2 space-y-0.5" role="alert">
          {conflicts.map((item) => (
            <p key={item.combo} className="text-[12px] leading-relaxed text-danger">
              {comboDisplay(item.combo)} 和「{item.others.join('」「')}
              」存在冲突，冲突的快捷键已被停用
            </p>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : recording ? (
        <p className="mt-2 text-[12px] text-fg-faint">Esc 取消，Backspace 恢复默认</p>
      ) : null}
    </div>
  )
}
