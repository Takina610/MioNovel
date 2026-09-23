import { buildDecoyDocument } from './decoy'
import { highlightLines } from './highlight'

/**
 * 正文 → 代码形态。
 *
 * 编辑器皮肤（styles/code.css）负责把外壳画成编辑器，这份文件负责正文那一半：
 * 给每一段标上它在「代码」里扮演什么，以及给缩略图算出每一行的宽度。
 *
 * 为什么要在 JS 里过一遍 DOM，而不是纯 CSS：CSS 看不见文字内容，
 * 而「这一段是对话」只能从文字本身判断（引号包起来的那句）。
 * 判断结果写成类名落到元素上，上色仍然全在 CSS 里——颜色只有主题那一份，
 * 这里不碰颜色，只贴标签。
 *
 * 这一切只在 chrome: 'code' 的主题下发生。普通主题不进这个文件。
 */

/** 一段在代码里的角色。名字对应 CodeTokens 里的那几个 token */
export type LineKind =
  | 'text'
  | 'string'
  | 'comment'
  | 'keyword'
  | 'number'
  | 'type'
  | 'fn'
  | 'prop'
  | 'image'

/** 缩略图的一行。宽度按字数换算，由调用方给「一行放得下几个字」 */
export interface CodeLine {
  /** 这一段的字数（汉字按 1 个算） */
  chars: number
  kind: LineKind
  /** 这一行显示出来的文字。缩略图要照着它写（见 components/code/Minimap） */
  text: string
}

/** 会单独占一行的块级元素。取最里层那些：`<div><p>x</p></div>` 里是 p 不是 div */
const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, pre, dt, dd, div, section'

/** 成对的引号：中日文的对话都用它们包起来 */
const QUOTE_PAIRS: Array<[string, string]> = [
  ['「', '」'],
  ['『', '』'],
  ['“', '”'],
  ['‘', '’'],
  ['"', '"'],
]

const NUMBER_RUN = /\d+(?:[.,:/]\d+)*/g

/** 一段算一行时，文本有多长（图片这类没有文字的块按一个短行算） */
function textLength(element: Element): number {
  const text = element.textContent ?? ''
  return text.replace(/\s+/g, '').length
}

/**
 * 判断一段像什么。
 * 顺序是有意的：图片先认（它已经被换成占位标记了），
 * 然后是标题和次要语言段（有明确标记），最后才靠引号猜对话——
 * 反过来会把「标题里带引号」认成交谈。
 */
function classify(element: Element): LineKind {
  if (isMediaOnly(element)) return 'image'
  const tag = element.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tag)) return 'keyword'
  if (element.classList.contains('mn-chapter-title')) return 'keyword'
  if (element.classList.contains('mn-volume-title')) return 'keyword'
  if (tag === 'figcaption') return 'comment'
  // 双语书的次要语言段：对照模式下它降调显示，在代码形态里就是注释
  if (element.hasAttribute('data-mn-lang')) return 'comment'
  if (tag === 'blockquote') return 'comment'
  if (looksLikeDialogue(element.textContent ?? '')) return 'string'
  return 'text'
}

/** 这一行除了图片占位之外没有别的内容 */
function isMediaOnly(element: Element): boolean {
  const media = element.querySelectorAll('.mn-media')
  if (media.length === 0) return false
  let text = element.textContent ?? ''
  for (const item of Array.from(media)) text = text.replace(item.textContent ?? '', '')
  return text.replace(/\s+/g, '').length === 0
}

/** 会不会被当成一「行」：本身是块级，而且里面没有更深的块 */
function isLineElement(element: Element): boolean {
  return element.matches(BLOCK_SELECTOR) && element.querySelector(BLOCK_SELECTOR) === null
}

/**
 * 图片的排版。
 *
 * 两件事：把 `<figure>` 拆开（图与图注本来就是两行，套在 figure 里会让
 * 「最深的块才是行」的判定把它们粘成一块），以及给还不在任何「行」里的图
 * 自己包一行——否则它落在行号列的左边，和正文对不齐（`<figure><img><figcaption>`
 * 这种写法在 epub 里到处都是）。
 */
function normalizeMediaLines(body: Element): void {
  for (const figure of Array.from(body.querySelectorAll('figure'))) {
    for (const child of Array.from(figure.childNodes)) {
      figure.parentNode?.insertBefore(child, figure)
    }
    figure.remove()
  }

  for (const media of Array.from(body.querySelectorAll('.mn-media'))) {
    const block = media.parentElement?.closest(BLOCK_SELECTOR)
    if (block && isLineElement(block)) continue
    const line = body.ownerDocument!.createElement('div')
    line.className = 'mn-code-line mn-tok-image'
    media.replaceWith(line)
    line.appendChild(media)
  }
}

/**
 * 「这一段基本就是一句引号里的话」才算对话。
 *
 * 判据是引号之间的部分占全段一半以上：日文小说常见的
 * 「……はい」と答えた。 这类「对话 + 尾巴」也能认出来，
 * 反过来，叙述里顺带提一句引文不会被染成一整句对话。
 */
function looksLikeDialogue(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  for (const [open, close] of QUOTE_PAIRS) {
    const start = trimmed.indexOf(open)
    if (start < 0) continue
    const end = trimmed.lastIndexOf(close)
    if (end <= start) continue
    if ((end + 1 - start) / trimmed.length >= 0.5) return true
  }
  return false
}

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

/** 图片引用里显示出来的路径。取不到原始路径时给一句人话，不要把 blob: 地址摆出来 */
function mediaPath(src: string, resolve?: (src: string) => string | undefined): string {
  if (!src) return '图片'
  if (src.startsWith('data:')) return '内嵌图片'
  const original = src.startsWith('blob:') ? resolve?.(src) : src
  if (!original) return '图片'
  return original.replace(/^mnres:\/\//, '').replace(/^\.?\//, '')
}

/**
 * 正文里的图片全部换成一行引用：`![](./figure.png)`。
 *
 * 编辑器形态下不渲染任何图——封面、卷首插图、正文插图都不例外。
 * 这不是「加载失败」，而是**这份文本里确实有一张图，这行是它的地址**：
 * 一句话说明这里原本是什么，同时把原图路径留给人查。
 */
function replaceMedia(root: Element, resolve?: (src: string) => string | undefined): void {
  const media = Array.from(root.querySelectorAll('img, svg'))
  for (const element of media) {
    if (element.closest('.mn-media')) continue
    const image = element.tagName.toLowerCase() === 'img' ? element : element.querySelector('image')
    const src =
      element.getAttribute('src') ??
      image?.getAttribute('href') ??
      image?.getAttribute('xlink:href') ??
      ''
    const alt = (element.getAttribute('alt') ?? '').replace(/[[\]]/g, '').trim()
    const span = element.ownerDocument!.createElement('span')
    span.className = 'mn-media'
    span.textContent = `![${alt || '插图'}](./${mediaPath(src, resolve)})`
    element.replaceWith(span)
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

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  replaceMedia(body, resolve)
  normalizeMediaLines(body)
  const all = Array.from(body.querySelectorAll(BLOCK_SELECTOR))
  // 最深的那层块才是「一行」：外层 div 只是容器
  const lineElements = all.filter((element) => element.querySelector(BLOCK_SELECTOR) === null)

  // 演示模式：整章换成一份完整的源文件，再交给 highlight.js 上色
  // （行数与段落数严格相等，见 lib/decoy.ts）
  const script = decoy ? buildDecoyDocument(decoy, seed ?? html.slice(0, 400), lineElements.length) : null
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
      const text = script.lines[index]
      lines.push({ chars: Math.max(1, text.length), kind: line.kind, text })
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
