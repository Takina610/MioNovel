/**
 * 正文 → 块。
 *
 * 这是**所有非正文 HTML 直出的形态**（编辑器、表格、幻灯片、聊天）共用的一层：
 * 一段正文在代码里是「一行」，在表格里是「一行」，在聊天里是「一条消息」，
 * 在幻灯片里是「一个项目符号」——切法完全一样，都是「最里层的块级元素」。
 * 所以切分和分类只写一次，各形态只决定怎么摆放、怎么上色。
 *
 * 为什么要在 JS 里过一遍 DOM，而不是纯 CSS：CSS 看不见文字内容，而「这一段是
 * 对话」只能从文字本身判断（成对引号包起来的那句）。判断结果写进块的 kind，
 * 上色仍然全在 CSS 里——颜色只有主题那一份，这里不碰颜色，只贴标签。
 */

/** 一段在「别的样子」里扮演什么。取值借的是编辑器那套：正文的哪些部分像字符串、哪些像注释 */
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

/** 会单独占一行的块级元素。取最里层那些：`<div><p>x</p></div>` 里是 p 不是 div */
export const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th, pre, dt, dd, div, section'

/** 成对的引号：中日文的对话都用它们包起来 */
const QUOTE_PAIRS: Array<[string, string]> = [
  ['「', '」'],
  ['『', '』'],
  ['“', '”'],
  ['‘', '’'],
  ['"', '"'],
]

export interface Block {
  /** 这一块像什么。颜色和排版都按它走 */
  kind: LineKind
  /** 纯文本（空白已折叠）。单元格、幻灯片、聊天的「字数」都数它 */
  text: string
  /**
   * 块内 HTML（解析时已净化过）。需要保留注音、链接、强调的地方用它——
   * 表格之外的三种形态都是直接塞进 DOM 的。
   */
  html: string
  /** 字数：汉字、字母、数字各算 1，空白不算 */
  chars: number
  /** 标题层级（1-6）。不是标题就是 0 */
  level: number
  /** 双语书的次要语言段（解析时标的 data-mn-lang） */
  alt: boolean
}

/** 这行文本有多长（空白不算） */
export function textLength(element: Element): number {
  const text = element.textContent ?? ''
  return text.replace(/\s+/g, '').length
}

/**
 * 「这一段基本就是一句引号里的话」才算对话。
 *
 * 判据是引号之间的部分占全段一半以上：日文小说常见的
 * 「……はい」と答えた。 这类「对话 + 尾巴」也能认出来，
 * 反过来，叙述里顺带提一句引文不会被染成一整句对话。
 */
export function looksLikeDialogue(text: string): boolean {
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

/** 这一行除了图片之外没有别的内容（两种模式的图片都要认：`.mn-media` 是
 *  换了引用的那种，`img` / `svg` 是原样留下的那种） */
export function isMediaOnly(element: Element): boolean {
  const media = element.querySelectorAll('.mn-media, img, svg')
  if (media.length === 0) return false
  let text = element.textContent ?? ''
  for (const item of Array.from(media)) text = text.replace(item.textContent ?? '', '')
  return text.replace(/\s+/g, '').length === 0
}

/** 会不会被当成一「行」：本身是块级，而且里面没有更深的块 */
export function isLineElement(element: Element): boolean {
  return element.matches(BLOCK_SELECTOR) && element.querySelector(BLOCK_SELECTOR) === null
}

/**
 * 判断一段像什么。
 * 顺序是有意的：图片先认（它已经被换成占位标记了），
 * 然后是标题和次要语言段（有明确标记），最后才靠引号猜对话——
 * 反过来会把「标题里带引号」认成交谈。
 */
export function classify(element: Element): LineKind {
  if (isMediaOnly(element)) return 'image'
  const tag = element.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tag)) return 'keyword'
  if (element.classList.contains('mn-chapter-title')) return 'keyword'
  if (element.classList.contains('mn-volume-title')) return 'keyword'
  if (tag === 'figcaption') return 'comment'
  // 双语书的次要语言段：对照模式下它降调显示，在这儿就是注释
  if (element.hasAttribute('data-mn-lang')) return 'comment'
  if (tag === 'blockquote') return 'comment'
  if (looksLikeDialogue(element.textContent ?? '')) return 'string'
  return 'text'
}

/** 图片引用里显示出来的路径。取不到原始路径时给一句人话，不要把 blob: 地址摆出来 */
export function mediaPath(src: string, resolve?: (src: string) => string | undefined): string {
  if (!src) return '图片'
  if (src.startsWith('data:')) return '内嵌图片'
  const original = src.startsWith('blob:') ? resolve?.(src) : src
  if (!original) return '图片'
  return original.replace(/^mnres:\/\//, '').replace(/^\.?\//, '')
}

/**
 * 正文里的图片全部换成一行引用：`![](./figure.png)`。
 *
 * 表格和编辑器这两种形态里不渲染任何图——封面、卷首插图、正文插图都不例外。
 * 这不是「加载失败」，而是**这份文本里确实有一张图，这行是它的地址**：
 * 一句话说明这里原本是什么，同时把原图路径留给人查。
 * （文档、幻灯片、聊天能正常放图，它们不走这一条。）
 */
export function replaceMedia(root: Element, resolve?: (src: string) => string | undefined): void {
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
 * 图片的排版。两件事：
 *
 * 1. **拆掉 `<figure>`。** 图与图注本来就是两块（一行图、一行说明），套在 figure
 *    里会让「最深的块才是行」的判定把它们粘成一块；而 figure 自己又不在块级选择器
 *    里，于是**整张图会被丢掉**——聊天和幻灯片里就表现为「说明文字在、图没了」。
 * 2. **给还不在任何块里的图自己包一块。** `![](./路径)` 占位（编辑器 / 表格用）
 *    和原样的 `<img>`（文档 / 幻灯片 / 聊天用）都要包，否则它落在行的外面，
 *    谁都渲染不到它。
 */
export function normalizeMediaLines(body: Element): void {
  for (const figure of Array.from(body.querySelectorAll('figure'))) {
    for (const child of Array.from(figure.childNodes)) {
      figure.parentNode?.insertBefore(child, figure)
    }
    figure.remove()
  }

  for (const media of Array.from(body.querySelectorAll('.mn-media, img, svg'))) {
    const block = media.parentElement?.closest(BLOCK_SELECTOR)
    if (block && isLineElement(block)) continue
    const line = body.ownerDocument!.createElement('div')
    media.replaceWith(line)
    line.appendChild(media)
  }
}

/**
 * 正文 HTML → 一份可以遍历的 DOM + 那些「最里层的块」。
 *
 * 编辑器形态和块状形态（表格 / 幻灯片 / 聊天）都从这里起步：它们的分块规则
 * 必须一致，不然同一章在四个形态里会切出不同的段数。
 *
 * media 决定图片怎么处理：'reference' 换成 `![](./路径)`（编辑器、表格），
 * 'keep' 原样留着（幻灯片、聊天——它们放得下图）。
 * resolve 用来把渲染时的 blob 地址还原成书里的原始路径（见 hooks/useChapterHtml）。
 */
export function prepareBody(
  html: string,
  options: { media?: 'keep' | 'reference'; resolve?: (src: string) => string | undefined } = {},
): { body: Element; elements: Element[] } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  // 图片引用（`![](./路径)`）只属于编辑器与表格；其余形态留着原图。
  // 不管哪种模式，都要把图整理成「一块」——否则它渲染不到（见 normalizeMediaLines）
  if (options.media === 'reference') replaceMedia(body, options.resolve)
  normalizeMediaLines(body)
  const all = Array.from(body.querySelectorAll(BLOCK_SELECTOR))
  // 最深的那层块才是「一块」：外层 div 只是容器
  const elements = all.filter(isLineElement)
  return { body, elements }
}

/**
 * 正文 HTML → 块数组。
 *
 * 输入是解析时净化过的正文，这里只读不改（'keep' 模式下连图都不动），
 * 所以返回的 html 可以安全地塞回 DOM。
 */
export function chapterBlocks(
  html: string,
  options: { media?: 'keep' | 'reference'; resolve?: (src: string) => string | undefined } = {},
): Block[] {
  if (!html) return []
  const { elements } = prepareBody(html, options)
  return elements.map((element) => {
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
    const chars = textLength(element)
    const level = /^h[1-6]$/.test(element.tagName.toLowerCase())
      ? Number(element.tagName[1])
      : 0
    return {
      kind: classify(element),
      text,
      html: element.innerHTML,
      // 空块（空行、分隔线）在有些形态里要占一格，别缩成 0
      chars: chars === 0 ? 1 : chars,
      level,
      alt: element.hasAttribute('data-mn-lang'),
    }
  })
}

/** 单个块是否是可读的正文（空行、分隔线这类不算） */
export function isContentBlock(block: Block): boolean {
  return block.text.length > 0
}

/**
 * 正文 HTML → 「图片写成一行引用」的正文 HTML。
 *
 * 编辑器形态和飞书形态都不渲染任何图：打开一本书应该是一片字，
 * 而不是一张全屏的图。做法和 chapterBlocks 的 'reference' 模式共用同一套
 * （替换 + 整理成块），只是这里返回 HTML——那两个形态的正文是直出的。
 *
 * 引用行里写的是**书里的原始路径**（`OEBPS/Images/pic.png`），不是渲染时的
 * blob 地址，所以 resolve 必须把 blob 还原回原始路径（见 hooks/useChapterHtml）。
 */
export function mediaLinesHtml(
  html: string,
  resolve?: (src: string) => string | undefined,
): string {
  if (!html) return html
  const { body } = prepareBody(html, { media: 'reference', resolve })
  return body.innerHTML
}
