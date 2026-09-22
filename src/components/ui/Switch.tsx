import { cx } from '../../lib/cx'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-fg">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] text-fg-faint">{description}</span>
        ) : null}
      </span>
      <span
        className={cx(
          'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[19px]' : 'translate-x-[3px]',
          )}
        />
      </span>
    </button>
  )
}
