import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../../hooks/usePresence'
import { cx } from '../../lib/cx'
import { IconCheck, IconChevron } from './icons'

export interface SelectOption {
  value: string
  label: string
  /** 第二行的补充说明，比 label 淡一档 */
  hint?: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** 没有可见标签时给读屏用的名字 */
  ariaLabel?: string
  /** field：带边框、占满一行（表单里用）；ghost：跟内容同宽（工具条里用） */
  variant?: 'field' | 'ghost'
  /** 触发按钮上 label 前面的小图标 */
  leadingIcon?: ReactNode
  className?: string
  /** 弹出层跟按钮的哪一边对齐 */
  align?: 'start' | 'end'
}

/** 弹出层离触发按钮的间距 */
const OFFSET = 6
/** 估算高度用的行高，只用来决定往上还是往下弹 */
const ROW_ESTIMATE = 40

interface Anchor {
  left: number
  width: number
  /** 往下弹时的 top */
  below: number
  /** 往上弹时的 bottom（用 bottom 定位，就不用先知道列表有多高） */
  above: number
  placement: 'below' | 'above'
}

/**
 * 自定义下拉。
 *
 * 为什么不用原生 `<select>`：原生控件的弹出列表由操作系统画，改不动它的字体、
 * 圆角、动效，暗色主题下还会突然亮一下——整个界面里最显眼的「原生感」就是它。
 * 换掉它的代价是要自己补键盘操作和 aria，所以这个组件里那一半代码都是无障碍，
 * 不是功能。
 *
 * 弹出层走 portal + fixed：面板内容是可滚动的，绝对定位的下拉会被裁掉。
 * 跟着滚动重新定位（而不是关掉下拉），因为在设置面板里滚一下就把下拉关掉很烦。
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  variant = 'field',
  leadingIcon,
  className,
  align = 'start',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const listId = `${id}-list`

  // 关掉之后多留 140ms 播离场动画，见 hooks/usePresence.ts
  const { value: shown, leaving } = usePresence(open ? listId : null, 140)
  const mounted = shown !== null

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selected = options[selectedIndex]

  const measure = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const estimated = Math.min(options.length * ROW_ESTIMATE + 12, 320)
    // 下面放不下、上面更宽敞时才往上弹
    const spaceBelow = window.innerHeight - rect.bottom - OFFSET
    const placement: Anchor['placement'] =
      spaceBelow < estimated && rect.top > spaceBelow ? 'above' : 'below'
    const width = Math.max(rect.width, variant === 'ghost' ? 180 : 0)
    setAnchor({
      left: align === 'end' ? Math.max(8, rect.right - width) : rect.left,
      width,
      below: rect.bottom + OFFSET,
      above: window.innerHeight - rect.top + OFFSET,
      placement,
    })
  }, [align, options.length, variant])

  // 打开前先把位置算好，避免先渲染在错的地方再跳一下
  useLayoutEffect(() => {
    if (!open) return
    measure()
    setActiveIndex(selectedIndex)
  }, [open, measure, selectedIndex])

  // 弹出层挂上之后再量一次：估算的高度和实际高度有出入时纠正上下方向
  useLayoutEffect(() => {
    if (!open || !mounted) return
    const list = listRef.current
    const trigger = triggerRef.current
    if (!list || !trigger) return
    const rect = trigger.getBoundingClientRect()
    const height = list.offsetHeight
    const spaceBelow = window.innerHeight - rect.bottom - OFFSET
    const wanted = spaceBelow < height && rect.top > spaceBelow ? 'above' : 'below'
    setAnchor((current) => (current && current.placement !== wanted ? { ...current, placement: wanted } : current))
  }, [open, mounted, options.length])

  // 滚动 / 改变窗口大小时跟着走
  useEffect(() => {
    if (!open) return
    const reposition = () => measure()
    window.addEventListener('scroll', reposition, { capture: true, passive: true })
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true })
      window.removeEventListener('resize', reposition)
    }
  }, [open, measure])

  // 点别处关掉。用 pointerdown 而不是 click：拖选文字松手时不该算「点了外面」
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  // 键盘移动时把高亮项滚进可视区
  useLayoutEffect(() => {
    if (!open) return
    const list = listRef.current
    const row = list?.children[activeIndex] as HTMLElement | undefined
    row?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const commit = (next: string) => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const move = (delta: 1 | -1) => {
    setActiveIndex((current) => {
      const next = current + delta
      if (next < 0) return options.length - 1
      if (next >= options.length) return 0
      return next
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
        else move(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        if (!open) setOpen(true)
        else move(-1)
        return
      case 'Home':
        if (!open) return
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        if (!open) return
        event.preventDefault()
        setActiveIndex(options.length - 1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) setOpen(true)
        else commit(options[activeIndex].value)
        return
      case 'Escape':
        if (!open) return
        // 只关下拉，不关外层面板：drop 给 Panel 的 Esc 处理看（见 Panel.tsx）
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        return
      case 'Tab':
        setOpen(false)
        return
      default:
        return
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        // 下拉开着的时候，Esc 归这个组件处理——Panel 的 Esc 处理器会跳过带这个标记的
        data-mn-esc-local={open ? '' : undefined}
        className={cx(
          'flex items-center gap-2 rounded-lg border text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          variant === 'field' ? 'h-9 w-full justify-between px-3' : 'h-9 justify-start px-3',
          open
            ? 'border-accent bg-bg text-fg'
            : 'border-border bg-bg text-fg hover:border-border-strong',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leadingIcon ? <span className="shrink-0 text-fg-faint">{leadingIcon}</span> : null}
          <span className="min-w-0 truncate">{selected?.label ?? '未选择'}</span>
        </span>
        <IconChevron
          className={cx(
            'h-4 w-4 shrink-0 text-fg-faint transition-transform duration-200 ease-[var(--mn-ease)]',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted && anchor
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              onMouseDown={(event) => event.preventDefault()}
              className={cx(
                'fixed z-70 max-h-[min(52vh,320px)] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl',
                leaving ? 'mn-pop-out pointer-events-none' : 'mn-pop',
              )}
              style={{
                left: anchor.left,
                width: anchor.width,
                ...(anchor.placement === 'below' ? { top: anchor.below } : { bottom: anchor.above }),
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <div
                    key={option.value}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option.value)}
                    className={cx(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px]',
                      isActive && 'bg-surface-2',
                      isSelected ? 'text-accent' : 'text-fg',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-fg-faint">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <IconCheck className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </div>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
