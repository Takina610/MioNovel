import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 阅读设置。
 *
 * 这里存的是**数值**，不是 CSS：真实生效靠 settingsToVars() 把它们写成
 * 阅读器容器上的 CSS 变量。这样改字号只是写一个 style 属性，
 * 正文 DOM 不重渲染、变量还会级联到从 EPUB 迁进来的 HTML 上。
 */
export interface ReaderSettings {
  /** 主题 id，对应 themes 注册表 */
  themeId: string
  /** px */
  fontSize: number
  /** 倍数 */
  lineHeight: number
  /** em */
  letterSpacing: number
  /** em，段间距 */
  paragraphGap: number
  /** em，首行缩进。0 表示不缩进 */
  indent: number
  /** rem，正文栏宽 */
  contentWidth: number
  align: 'left' | 'justify'
  /** FONT_STACKS 的 id */
  fontFamily: string
  pageMode: 'scroll' | 'paged'
  /** 自定义 CSS 逃生口：不用改代码就能微调主题 */
  userCss: string
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  themeId: 'day',
  fontSize: 19,
  lineHeight: 1.8,
  letterSpacing: 0.01,
  paragraphGap: 1,
  indent: 2,
  contentWidth: 42,
  align: 'left',
  fontFamily: 'sans',
  pageMode: 'scroll',
  userCss: '',
}

/**
 * 字体一律用系统栈。中文字体动辄几 MB，打进包和「离线可读的 PWA」直接冲突，
 * 而且系统自带的宋/黑/楷在这个场景下本来就是最合适的选择。
 */
export const FONT_STACKS = [
  {
    id: 'sans',
    name: '黑体',
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif",
  },
  {
    id: 'serif',
    name: '宋体',
    stack:
      "'Songti SC', 'SimSun', 'Source Han Serif SC', 'Noto Serif CJK SC', Georgia, 'Times New Roman', serif",
  },
  {
    id: 'kai',
    name: '楷体',
    stack: "'Kaiti SC', 'KaiTi', 'STKaiti', 'AR PL UKai CN', 'TW-Kai', 'LiSu', serif",
  },
  {
    id: 'mono',
    name: '等宽',
    stack: "'Cascadia Mono', 'Sarasa Mono SC', 'JetBrains Mono', Consolas, 'Courier New', monospace",
  },
]

/** 各设置的取值范围，滑动条直接用 */
export const SETTING_RANGES = {
  fontSize: { min: 14, max: 34, step: 1 },
  lineHeight: { min: 1.2, max: 2.6, step: 0.05 },
  letterSpacing: { min: 0, max: 0.2, step: 0.01 },
  paragraphGap: { min: 0, max: 2, step: 0.1 },
  indent: { min: 0, max: 3, step: 0.5 },
  contentWidth: { min: 24, max: 64, step: 2 },
} as const

export function fontStackOf(id: string): string {
  return FONT_STACKS.find((font) => font.id === id)?.stack ?? FONT_STACKS[0].stack
}

/** 设置 → CSS 变量。变量名要和 styles/app.css 里 :root 那份默认值对得上 */
export function settingsToVars(settings: ReaderSettings): Record<string, string> {
  return {
    '--mn-font-size': `${settings.fontSize}px`,
    '--mn-line-height': `${settings.lineHeight}`,
    '--mn-letter-spacing': `${settings.letterSpacing}em`,
    '--mn-para-gap': `${settings.paragraphGap}em`,
    '--mn-indent': `${settings.indent}em`,
    '--mn-content-width': `${settings.contentWidth}rem`,
    '--mn-reader-font': fontStackOf(settings.fontFamily),
    '--mn-align': settings.align,
  }
}

/** 某本书的独立设置：开关 + 只存被改过的字段 */
export interface PerBookStyle {
  enabled: boolean
  settings: Partial<ReaderSettings>
}

interface SettingsState {
  global: ReaderSettings
  perBook: Record<string, PerBookStyle>
  /** 改全局设置。某一本开了独立设置时，改这里不会影响它 */
  update: (patch: Partial<ReaderSettings>) => void
  /** 改某本书的设置（自动把它标成独立） */
  updateForBook: (bookId: string, patch: Partial<ReaderSettings>) => void
  setPerBookEnabled: (bookId: string, enabled: boolean) => void
  /** 撤掉这本书的独立设置，回到全局 */
  clearPerBook: (bookId: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      global: DEFAULT_SETTINGS,
      perBook: {},

      update: (patch) => set((state) => ({ global: { ...state.global, ...patch } })),

      updateForBook: (bookId, patch) =>
        set((state) => {
          const current = state.perBook[bookId] ?? { enabled: true, settings: {} }
          return {
            perBook: {
              ...state.perBook,
              [bookId]: { enabled: true, settings: { ...current.settings, ...patch } },
            },
          }
        }),

      setPerBookEnabled: (bookId, enabled) =>
        set((state) => {
          const current = state.perBook[bookId] ?? { enabled: false, settings: {} }
          return { perBook: { ...state.perBook, [bookId]: { ...current, enabled } } }
        }),

      clearPerBook: (bookId) =>
        set((state) => {
          const next = { ...state.perBook }
          delete next[bookId]
          return { perBook: next }
        }),
    }),
    { name: 'mionovel:settings', version: 1 },
  ),
)

/**
 * 某本书实际生效的设置。
 * 注意这是个纯函数，不要拿去当 zustand selector——它会每次返回新对象，
 * 在 useStore 里会造成无谓的重渲染。组件里用 useMemo 包一层。
 */
export function resolveSettings(global: ReaderSettings, perBook?: PerBookStyle): ReaderSettings {
  if (!perBook?.enabled) return global
  return { ...global, ...perBook.settings }
}

export function isPerBookEnabled(perBook: Record<string, PerBookStyle>, bookId: string): boolean {
  return perBook[bookId]?.enabled ?? false
}
