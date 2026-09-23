import { cx } from '../../lib/cx'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

/**
 * 开关。
 * 轨道换色用 --mn-ease（颜色不该弹），滑块位移用 --mn-spring（它该弹）——
 * 一条曲线管所有动效是「动起来都一样」的常见来源。
 */
export function Switch({ checked, onChange, label, description }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-fg">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] text-fg-faint">{description}</span>
        ) : null}
      </span>
      <span
        className={cx(
          'relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-border-strong group-hover:bg-border-strong/80',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm',
            'transition-transform duration-250 ease-[var(--mn-spring)] group-hover:scale-105 group-active:scale-95',
            checked ? 'translate-x-[21px]' : 'translate-x-[3px]',
          )}
        />
      </span>
    </button>
  )
}
