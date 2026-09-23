import type { CodeTokens, ThemeTokens } from './types'

/**
 * token 名 → CSS 自定义属性名。
 *
 * 这份映射是「一处定义」的锚点：apply.ts 用它生成主题样式表，src/styles/app.css
 * 用同名变量把 token 接到 Tailwind 工具类上。改名字要同时改这两处。
 */
export const TOKEN_VARS = {
  bg: '--mn-bg',
  surface: '--mn-surface',
  surface2: '--mn-surface-2',
  border: '--mn-border',
  borderStrong: '--mn-border-strong',
  fg: '--mn-fg',
  fgMuted: '--mn-fg-muted',
  fgFaint: '--mn-fg-faint',
  accent: '--mn-accent',
  accentSoft: '--mn-accent-soft',
  danger: '--mn-danger',
  overlay: '--mn-overlay',
  readerBg: '--mn-reader-bg',
  readerFg: '--mn-reader-fg',
  readerFgMuted: '--mn-reader-fg-muted',
  readerLink: '--mn-reader-link',
  readerSelection: '--mn-reader-selection',
  readerRule: '--mn-reader-rule',
} as const satisfies Record<keyof ThemeTokens, string>

/**
 * 代码形态多出来的那几个变量。和主 token 分开，是因为只有 chrome: 'code'
 * 的主题需要它们——普通主题不为用不上的值买单。
 */
export const CODE_TOKEN_VARS = {
  gutter: '--mn-code-gutter-fg',
  guide: '--mn-code-guide',
  string: '--mn-code-string',
  comment: '--mn-code-comment',
  keyword: '--mn-code-keyword',
  number: '--mn-code-number',
  type: '--mn-code-type',
  fn: '--mn-code-fn',
  prop: '--mn-code-prop',
  image: '--mn-code-image',
} as const satisfies Record<keyof CodeTokens, string>
