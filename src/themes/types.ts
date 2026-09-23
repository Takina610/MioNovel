import type { ReaderSettings } from '../store/settings'

/** 明暗标记。只用来设 `color-scheme`（滚动条、表单控件的原生配色），
 *  不要拿它去猜主题的颜色——两边没有推导关系，猜了迟早出错。 */
export type ThemeScheme = 'light' | 'dark'

/**
 * 界面形态。
 *
 * plain 是默认的阅读器；code 把外壳换成代码编辑器——书架变成资源管理器，
 * 正文按代码排版（行号、语法高亮、缩略图、状态栏）。
 *
 * 为什么形态写在主题里而不是单独一个「编辑器模式」开关：用户要的是
 * 「选中这套主题，整个应用就是那个样子」。分成两个开关的话，
 * 颜色和形态可以互相矛盾，那不是一种观感，只是两块设置。
 */
export type ThemeChrome = 'plain' | 'code'

/**
 * 代码形态的语法配色。
 *
 * 只给 chrome: 'code' 的主题用，所以没声明形态的主题不用补这几个值。
 * 名字借的是编辑器那套：正文的哪些部分该像字符串、哪些该像注释。
 */
export interface CodeTokens {
  /** 行号 */
  gutter: string
  /** 缩进参考线 */
  guide: string
  /** 对话（成对引号包起来的那一句） */
  string: string
  /** 次要语言段、图注这类「可以扫过去」的内容 */
  comment: string
  /** 章标题、卷标题 */
  keyword: string
  /** 数字 */
  number: string
  /** 类型名：类、接口、struct、返回类型（VS Code 里的青色） */
  type: string
  /** 函数 / 方法名，也用在注解上（VS Code 里的黄色） */
  fn: string
  /** 字段、变量、属性（VS Code 里的浅蓝） */
  prop: string
  /** 图片占位（`![](./figure.png)` 这类引用） */
  image: string
}

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
  /** 界面形态，不写就是 plain */
  chrome?: ThemeChrome
  /** chrome: 'code' 的语法配色 */
  code?: CodeTokens
  /**
   * 这套主题自带的排版参数。**只在用户主动选中它时**写进阅读设置，
   * 之后用户怎么改都归用户——它是一次预设，不是一层覆盖。
   * 所以「选了编辑器主题，正文自动变成等宽、不缩进」不需要在组件里写特例。
   */
  preset?: Partial<ReaderSettings>
}
