import type { CSSProperties } from 'react'
import { listThemes } from '../../themes/apply'
import { groupThemes } from '../../themes/groups'
import type { ReaderTheme } from '../../themes/types'
import { cx } from '../../lib/cx'
import { IconCheck } from '../ui/icons'
import vscodeLogo from '../../assets/logos/vscode.svg'
import wordLogo from '../../assets/logos/word.svg'
import excelLogo from '../../assets/logos/excel.svg'
import powerpointLogo from '../../assets/logos/powerpoint.svg'
import feishuLogo from '../../assets/logos/feishu.png'
import wecomLogo from '../../assets/logos/wecom.png'
import b2bLogo from '../../assets/logos/1688.png'

interface ThemePickerProps {
  activeId: string
  onSelect: (themeId: string) => void
}

/**
 * 每套主题一张真实截图（同一本书在那套主题下的样子），按主题 id 取文件名。
 * 截图是缩略图（440px 宽的 webp），`loading="lazy"` 让没滚到的组先不加载。
 * 没有对应截图的主题（新加的还没截）回落到色卡，不会报错。
 */
const SHOTS = import.meta.glob<string>('../../assets/theme-shots/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

const shotOf = (id: string): string | undefined => SHOTS[`../../assets/theme-shots/${id}.webp`]

/**
 * 各产品的商标。这是 AGENTS.md 第一条说的「产品记号」：有意写死、不走主题
 * token——它们标识的是外壳伪装的那款软件，不是这套配色的一部分。
 * 全部取自官方渠道的真实彩色图标（Word / Excel / PowerPoint / VS Code 是
 * Wikimedia Commons 上的官方图标 SVG；飞书、企业微信、1688 是各家官网的
 * favicon），不是这里画的。同一产品的亮暗主题共用一个商标。
 */
const LOGOS: Record<string, string> = {
  vscode: vscodeLogo,
  'vscode-light': vscodeLogo,
  word: wordLogo,
  'word-dark': wordLogo,
  excel: excelLogo,
  'excel-dark': excelLogo,
  ppt: powerpointLogo,
  'ppt-dark': powerpointLogo,
  feishu: feishuLogo,
  'feishu-dark': feishuLogo,
  wecom: wecomLogo,
  'wecom-dark': wecomLogo,
  desk: b2bLogo,
  'desk-dark': b2bLogo,
}

/**
 * 主题选择。封面是真实截图；按类别分组（类别从形态推导，见 themes/groups.ts）——
 * 加一套主题只要往 builtin.ts 里加一条，这里自动多一张卡、归进对的类别。
 */
export function ThemePicker({ activeId, onSelect }: ThemePickerProps) {
  const groups = groupThemes(listThemes())

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2.5">
          <h3 className="text-[15px] font-semibold text-fg">{group.label}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {group.themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: ReaderTheme
  active: boolean
  onSelect: (themeId: string) => void
}) {
  const shot = shotOf(theme.id)
  const logo = LOGOS[theme.id]
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={active}
      className={cx(
        'group relative overflow-hidden rounded-xl border text-left',
        'transition-[border-color,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)]',
        active
          ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_18%,transparent)]'
          : 'border-border hover:border-border-strong',
      )}
    >
      {shot ? (
        <img
          src={shot}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="block aspect-[32/17] w-full select-none object-cover transition-transform duration-[var(--mn-dur-3)] ease-[var(--mn-ease)] group-hover:scale-[1.04]"
        />
      ) : (
        // 色卡：三行「正文」用这套主题的阅读区底色和前景色画，一眼就是它读起来的样子
        <span
          className="flex aspect-[32/17] w-full flex-col justify-center gap-1 px-6 transition-transform duration-[var(--mn-dur-3)] ease-[var(--mn-ease)] group-hover:scale-[1.04]"
          style={{ background: theme.tokens.readerBg }}
        >
          <span
            className="block h-1 w-2/3 rounded-full transition-[width] duration-300 ease-[var(--mn-ease)] group-hover:w-3/4"
            style={{ background: theme.tokens.readerFg }}
          />
          <span className="block h-1 w-full rounded-full opacity-60" style={{ background: theme.tokens.readerFg }} />
          <span className="block h-1 w-1/2 rounded-full opacity-40" style={{ background: theme.tokens.readerFg }} />
        </span>
      )}
      <span
        className="flex items-center justify-between gap-1.5 px-2.5 py-2"
        style={{ background: theme.tokens.surface }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {logo ? (
            <img
              src={logo}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-4 w-4 shrink-0 object-contain"
            />
          ) : null}
          <span className="truncate text-[13px]" style={{ color: theme.tokens.fgMuted }}>
            {theme.name}
          </span>
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
