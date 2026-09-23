import type { CSSProperties } from 'react'
import { listThemes } from '../../themes/apply'
import type { ReaderTheme } from '../../themes/types'
import { cx } from '../../lib/cx'
import { IconCheck } from '../ui/icons'

interface ThemePickerProps {
  activeId: string
  onSelect: (themeId: string) => void
}

/**
 * 主题选择。
 *
 * 色卡的颜色直接从主题注册表里读——加一套主题只要往 builtin.ts 里加一条，
 * 这里自动多一张卡，没有任何一处需要改。
 */
export function ThemePicker({ activeId, onSelect }: ThemePickerProps) {
  const themes = listThemes()

  return (
    <div className="grid grid-cols-3 gap-2">
      {themes.map((theme) => (
        <ThemeSwatch
          key={theme.id}
          theme={theme}
          active={theme.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function ThemeSwatch({
  theme,
  active,
  onSelect,
}: {
  theme: ReaderTheme
  active: boolean
  onSelect: (themeId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={active}
      className={cx(
        'group relative overflow-hidden rounded-xl border p-2 text-left',
        'transition-[border-color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
        active
          ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_18%,transparent)]'
          : 'border-border hover:-translate-y-0.5 hover:border-border-strong',
      )}
      style={{ background: theme.tokens.surface }}
    >
      {/* 卡里那三行「正文」用这套主题的阅读区底色和前景色画，一眼就是它读起来的样子 */}
      <span
        className="flex h-11 w-full flex-col justify-center gap-1 rounded-md px-2"
        style={{ background: theme.tokens.readerBg }}
      >
        <span
          className="block h-1 w-2/3 rounded-full transition-[width] duration-300 ease-[var(--mn-ease)] group-hover:w-3/4"
          style={{ background: theme.tokens.readerFg }}
        />
        <span
          className="block h-1 w-full rounded-full opacity-60"
          style={{ background: theme.tokens.readerFg }}
        />
        <span
          className="block h-1 w-1/2 rounded-full opacity-40"
          style={{ background: theme.tokens.readerFg }}
        />
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-1">
        <span className="truncate text-[11.5px]" style={{ color: theme.tokens.fgMuted }}>
          {theme.name}
        </span>
        {active ? (
          <IconCheck
            className="mn-pop h-3.5 w-3.5 shrink-0"
            style={{ color: theme.tokens.accent } as CSSProperties}
          />
        ) : null}
      </span>
    </button>
  )
}
