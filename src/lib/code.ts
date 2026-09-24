import { buildDecoyDocument } from './decoy'
import { highlightLines } from './highlight'
import {
  classify,
  prepareBody,
  textLength,
  type LineKind,
} from './blocks'

/**
 * 正文 → 代码形态。
 *
 * 编辑器皮肤（styles/code.css）负责把外壳画成编辑器，这份文件负责正文那一半：
 * 给每一段标上它在「代码」里扮演什么，以及给缩略图算出每一行的宽度。
 *
 * 分块和分类本来就在这里，后来被表格 / 幻灯片 / 聊天三种形态共用了，
 * 于是搬到 lib/blocks.ts；这里只剩下「怎么摆成一份代码文件」。
 *
 * 这一切只在 chrome: 'code' 的主题下发生。普通主题不进这个文件。
 */

export type { LineKind }

/** 缩略图的一行。宽度按字数换算，由调用方给「一行放得下几个字」 */
export interface CodeLine {
  /** 这一段的字数（汉字按 1 个算） */
  chars: number
  kind: LineKind
  /** 这一行显示出来的文字。缩略图要照着它写（见 components/code/Minimap） */
  text: string
}

const NUMBER_RUN = /\d+(?:[.,:/]\d+)*/g

/** 文本节点里的数字单独包一层，好让它们用数字色显示 */
function wrapNumbers(root: Element): void {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    // 图片占位里的路径不拆数字：那是文件名，不是正文里的数字
    if (!text.parentElement?.closest('.mn-media') && NUMBER_RUN.test(text.data)) {
      targets.push(text)
    }
    NUMBER_RUN.lastIndex = 0
    node = walker.nextNode()
  }
  for (const text of targets) {
    const pieces = text.data.split(NUMBER_RUN)
    const numbers = text.data.match(NUMBER_RUN) ?? []
    if (numbers.length === 0) continue
    const fragment = text.ownerDocument.createDocumentFragment()
    pieces.forEach((piece, index) => {
      if (piece) fragment.appendChild(text.ownerDocument.createTextNode(piece))
      const number = numbers[index]
      if (number) {
        const span = text.ownerDocument.createElement('span')
        span.className = 'mn-tok-num'
        span.textContent = number
        fragment.appendChild(span)
      }
    })
    text.parentNode?.replaceChild(fragment, text)
  }
}

/**
 * 正文 HTML → 代码形态的 HTML + 缩略图数据。
 *
 * 输入是解析时净化过的正文，这里只加类名、把图片换成引用、给数字包一层，
 * 不删不改原文——颜色全由类名和主题变量决定。
 *
 * resolve 用来把渲染时的 blob 地址还原成书里的原始路径（见 hooks/useChapterHtml），
 * 拿不到就退回一句「图片」。
 *
 * decoy 打开时（演示模式，见 store/decoy）每一行换成一行假代码：行数、行号、
 * 缩略图的位置都不变，只有文字和颜色变了。换的是**内容**，不是把界面改成另一个样子。
 *
 * 返回值按 html 缓存：缩略图的宽度还要看字号和栏宽，那部分在 Minimap 里算，
 * 所以改字号不会让这一遍重跑（重新序列化整章在翻页时是要卡的）。
 */
export function decorateChapterHtml(
  html: string,
  options: {
    resolve?: (src: string) => string | undefined
    /** 演示模式用的语言 id。给了就整章换成一份源文件 */
    decoy?: string | null
    /** 这一章的标识：文件名和文件里的类名都由它推出来，三处必须传同一个 */
    seed?: string
  } = {},
): { html: string; lines: CodeLine[] } {
  const { resolve, decoy, seed } = options
  if (!html) return { html: '', lines: [] }

  // 图片换成一行引用（`![](./figure.png)`），并且把图与图注拆成各自的一行——
  // 分块规则和表格 / 幻灯片 / 聊天完全一致，见 lib/blocks.ts
  const { body, elements: lineElements } = prepareBody(html, { media: 'reference', resolve })

  // 演示模式：整章换成一份完整的源文件，再交给 highlight.js 上色
  // （行数与段落数严格相等，见 lib/decoy.ts）
  const script = decoy
    ? buildDecoyDocument(decoy, seed ?? html.slice(0, 400), lineElements.length)
    : null
  const painted = script ? highlightLines(script.lines, script.language) : null

  const lines: CodeLine[] = []
  lineElements.forEach((element, index) => {
    // 原文要在改写之前取：演示模式下 element 的内容马上就被换掉了
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
    element.classList.add('mn-code-line')

    if (painted && script) {
      const line = painted[index]
      // 行级 token 类不加：它会盖掉行内 span 的颜色
      element.innerHTML = line.html
      const source = script.lines[index]
      lines.push({ chars: Math.max(1, source.length), kind: line.kind, text: source })
      return
    }

    const kind = classify(element)
    if (kind !== 'text') element.classList.add(`mn-tok-${kind}`)
    if (kind !== 'comment' && kind !== 'image') wrapNumbers(element)
    const chars = textLength(element)
    // 图片、分隔这类空块在缩略图里给一格短线，别渲染成 0 宽
    lines.push({ chars: chars === 0 ? 2 : chars, kind, text })
  })

  return { html: body.innerHTML, lines }
}

/** 文件名里不能出现的字符。VS Code 的标签页上会看到这些名字，所以不能只是「随便截一下」 */
const UNSAFE_NAME = /[\\/:*?"<>|\n\r\t]/g

/** 章节标题 → 文件名。标题里通常已经带「第一章」了，不重复加 */
export function chapterFileName(title: string, index: number): string {
  const cleaned = title.replace(UNSAFE_NAME, ' ').replace(/\s+/g, ' ').trim()
  const base = cleaned || `第 ${index + 1} 章`
  return `${base.length > 40 ? `${base.slice(0, 40)}…` : base}.md`
}

/** 书名 → 资源管理器里的文件夹名 */
export function bookFolderName(title: string): string {
  const cleaned = title.replace(UNSAFE_NAME, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || '未命名'
}
