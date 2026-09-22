import { BUILTIN_THEMES } from './builtin'
import type { ReaderTheme } from './types'
import { TOKEN_VARS } from './vars'

const STYLE_ID = 'mn-theme'
const TOKEN_KEYS = Object.keys(TOKEN_VARS) as (keyof typeof TOKEN_VARS)[]

/**
 * 主题注册表——唯一事实来源。
 *
 * 设计要点：主题不是「一组散落在组件里的 inline style」，而是数据。
 * applyThemeSheet() 把整个注册表编译成一张样式表，切换主题只改
 * documentElement 上的一个 data-theme 属性。带来三个好处：
 *
 *   1. 换主题是浏览器换一条 CSS 规则，不走 React 渲染，也没有逐 token 的 JS 写入；
 *   2. 用户主题只要注册进 registry 就自动生效，不需要改代码或 CSS；
 *   3. 加一套主题的成本 = 加一条数据，不是改 N 个组件。
 *
 * 对比：koodo-reader 的主题是「一个颜色 + 约 60 个手工维护的选择器数组」，
 * 每加一个可主题化的 UI 面就要往数组里补类名。变量级联不需要这个成本。
 */
let registry: ReaderTheme[] = [...BUILTIN_THEMES]

export function listThemes(): ReaderTheme[] {
  return registry
}

export function getTheme(id: string | undefined): ReaderTheme {
  const found = id ? registry.find((theme) => theme.id === id) : undefined
  // 主题被删掉或设置里存了个不存在的 id 时，回落到第一个内置主题而不是崩掉
  return found ?? BUILTIN_THEMES[0]
}

/** 注册额外的主题（用户导入、插件）。同 id 覆盖。 */
export function registerThemes(themes: ReaderTheme[]): void {
  for (const theme of themes) {
    const index = registry.findIndex((item) => item.id === theme.id)
    if (index >= 0) registry[index] = theme
    else registry.push(theme)
  }
  installThemeSheet()
}

function themeBlock(theme: ReaderTheme): string {
  const declarations = TOKEN_KEYS.map(
    (key) => `  ${TOKEN_VARS[key]}: ${theme.tokens[key]};`,
  ).join('\n')
  // color-scheme 交给主题声明：滚动条、<select> 这些原生控件才会跟着明暗走，
  // 而不是靠我们逐个去画。
  return `:root[data-theme='${theme.id}'] {\n  color-scheme: ${theme.scheme};\n${declarations}\n}`
}

export function buildThemeSheet(themes: ReaderTheme[] = registry): string {
  return themes.map(themeBlock).join('\n\n')
}

/** 把注册表编译成样式表注入 <head>。注册表变了就重新生成。 */
export function installThemeSheet(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = buildThemeSheet()
}

/**
 * 应用主题。整个切换就是两个属性 + 一个 meta，
 * 因为所有颜色都已经以变量的形式挂在了 :root 上。
 */
export function applyTheme(theme: ReaderTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.scheme = theme.scheme

  // 手机浏览器地址栏 / 状态栏的颜色跟着主题走，不然暗色主题配白色状态栏很割裂
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.tokens.bg)
}
