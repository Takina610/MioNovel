import type { ThemeTokens } from './types'

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
