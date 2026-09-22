/** 明暗标记。只用来设 `color-scheme`（滚动条、表单控件的原生配色），
 *  不要拿它去猜主题的颜色——两边没有推导关系，猜了迟早出错。 */
export type ThemeScheme = 'light' | 'dark'

/**
 * 主题 token。应用外壳（书架、工具栏、弹窗）和正文共用同一组变量：
 * 换主题是整个 app 一起变，不让正文和 UI 各说各话。
 *
 * 加 token 的代价是每个主题都要补一个值，所以这里只放真的会用到的东西。
 */
export interface ThemeTokens {
  /** 页面底色 */
  bg: string
  /** 卡片、面板 */
  surface: string
  /** 再上一层：悬停态、内嵌区块 */
  surface2: string
  border: string
  borderStrong: string
  /** 正文文字色（UI 里的） */
  fg: string
  fgMuted: string
  fgFaint: string
  accent: string
  accentSoft: string
  /** 危险操作：删除 */
  danger: string
  /** 弹窗遮罩 */
  overlay: string

  /** 阅读区底色。和 bg 分开：有些主题希望正文区比外壳更亮或更暗 */
  readerBg: string
  readerFg: string
  readerFgMuted: string
  readerLink: string
  readerSelection: string
  /** 分隔线、引用块竖线 */
  readerRule: string
}

export interface ReaderTheme {
  /** 稳定标识，会写进 data-theme 和设置里。改动等于换了一个主题 */
  id: string
  /** 显示名 */
  name: string
  scheme: ThemeScheme
  /** 内置主题不允许删除 */
  builtin: boolean
  tokens: ThemeTokens
}
