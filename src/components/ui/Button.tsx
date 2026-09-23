import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type Variant = 'solid' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const VARIANTS: Record<Variant, string> = {
  solid: 'bg-accent text-white shadow-sm hover:shadow-md hover:brightness-[1.06] active:brightness-95',
  outline: 'border border-border text-fg hover:border-border-strong hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'border border-border text-danger hover:border-danger/40 hover:bg-danger/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] rounded-md',
  md: 'h-9 px-3.5 text-sm rounded-lg',
  lg: 'h-11 px-5 text-[15px] rounded-xl',
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 font-medium',
        // 按下时轻微回缩：所有按钮的手感统一，不靠各自的 :active 颜色变化
        'transition-[transform,background-color,color,box-shadow,border-color,filter] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)] active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
