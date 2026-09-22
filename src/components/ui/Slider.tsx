interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** 显示值的格式，例如 19 → "19 px" */
  format?: (value: number) => string
}

export function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <label className="block select-none">
      <span className="flex items-baseline justify-between">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className="text-[12px] tabular-nums text-fg-faint">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        className="mn-range mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
