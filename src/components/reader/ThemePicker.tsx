import { listThemes } from '../../themes/apply'
import type { ReaderTheme } from '../../themes/types'
import { cx } from '../../lib/cx'

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
        'overflow-hidden rounded-lg border p-2 text-left transition-colors',
        active ? 'border-accent' : 'border-border hover:border-border-strong',
      )}
      style={{ background: theme.tokens.surface }}
    >
      <span
        className="flex h-11 w-full flex-col justify-center gap-1 rounded-md px-2"
        style={{ background: theme.tokens.readerBg }}
      >
        <span className="block h-1 w-2/3 rounded-full" style={{ background: theme.tokens.readerFg }} />
        <span
          className="block h-1 w-full rounded-full opacity-60"
          style={{ background: theme.tokens.readerFg }}
        />
        <span
          className="block h-1 w-1/2 rounded-full opacity-40"
          style={{ background: theme.tokens.readerFg }}
        />
      </span>
      <span
        className="mt-1.5 block text-[11.5px]"
        style={{ color: theme.tokens.fgMuted }}
      >
        {theme.name}
      </span>
    </button>
  )
}
