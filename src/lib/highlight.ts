import type { LineKind } from './code'

/**
 * 语法高亮。
 *
 * 只有演示模式用得上，而且是**按需加载**：highlight.js 只在这里被引用，
 * 打开演示模式时才 `import()`——不读小说的人不必为它付首屏的代价。
 *
 * 为什么按行高亮：正文的每一段对应文件里的一行，行号、缩略图、翻页位置都靠
 * 这个一一对应。整份文件高亮之后按 \n 切开，跨行的 token（块注释、模板字符串）
 * 会把 span 切断；而演示模式生成的每一行都是自足的（没有跨行结构），
 * 所以逐行 tokenize 既准确又保住了契约。
 *
 * 颜色不在这里写死：highlight.js 输出的 `hljs-*` 类名由 styles/code.css 映射到
 * 主题的 `--mn-code-*` 变量上——换主题时高亮颜色跟着变，和别的正文一样。
 */

type Hljs = typeof import('highlight.js/lib/common').default

let hljs: Hljs | null = null
let loading: Promise<void> | null = null

/** 加载 highlight.js。重复调用共享同一个 promise */
export function ensureHighlighter(): Promise<void> {
  if (hljs) return Promise.resolve()
  if (!loading) {
    loading = import('highlight.js/lib/common').then((module) => {
      hljs = module.default
    })
  }
  return loading
}

export function highlighterReady(): boolean {
  return hljs !== null
}

/**
 * hljs 的类名 → 我们自己的行类型。
 *
 * 缩略图按行类型上色（一行一个颜色），所以只需要挑出这一行「最显眼」的那个 token：
 * 标题行是关键字色、对话行是字符串色、注释行是注释色，和正文看起来是一回事。
 */
const KIND_RULES: Array<[string[], LineKind]> = [
  [['hljs-comment', 'hljs-quote'], 'comment'],
  [['hljs-string', 'hljs-regexp', 'hljs-char'], 'string'],
  [['hljs-number', 'hljs-literal'], 'number'],
  [['hljs-type', 'hljs-class', 'hljs-built_in', 'hljs-tag'], 'type'],
  [['hljs-title', 'hljs-function', 'hljs-meta'], 'fn'],
  [['hljs-attr', 'hljs-variable', 'hljs-property', 'hljs-params', 'hljs-selector'], 'prop'],
  [['hljs-keyword', 'hljs-doctag'], 'keyword'],
]

function kindOf(html: string): LineKind {
  let best = -1
  let kind: LineKind = 'text'
  for (const [classes, candidate] of KIND_RULES) {
    for (const name of classes) {
      const at = html.indexOf(`class="${name}`)
      if (at < 0) continue
      if (best < 0 || at < best) {
        best = at
        kind = candidate
      }
    }
  }
  return kind
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ESCAPES[char])
}

export interface HighlightedLine {
  html: string
  kind: LineKind
}

/** 单文件组件：脚本段按 TypeScript、模板段按 HTML 走 */
function modeFor(line: string, language: string, current: string): string {
  if (language !== 'vue') return language
  const trimmed = line.trim()
  if (trimmed.startsWith('<script')) return 'typescript'
  if (trimmed.startsWith('</script')) return 'xml'
  if (trimmed.startsWith('<template')) return 'xml'
  return current
}

/**
 * 逐行高亮。
 *
 * 高亮器还没加载完时退回纯文本（转义过），页面先正常显示、加载完再重画——
 * 演示模式是一层显示，晚一拍变彩色比卡住不动强。
 */
export function highlightLines(lines: string[], language: string): HighlightedLine[] {
  if (!hljs) {
    return lines.map((line) => ({ html: escapeHtml(line), kind: 'text' as LineKind }))
  }
  const instance = hljs
  let mode = language === 'vue' ? 'xml' : language
  return lines.map((line) => {
    mode = modeFor(line, language, mode)
    try {
      const result = instance.highlight(line, { language: mode, ignoreIllegals: true })
      const html = result.value
      // 空行不要留下 `<span></span>`：缩略图的一行得是干净的
      return { html: html.trim() === '' ? '' : html, kind: kindOf(html) }
    } catch {
      return { html: escapeHtml(line), kind: 'text' as LineKind }
    }
  })
}
