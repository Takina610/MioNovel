import type { Block } from './blocks'

/**
 * 段 → 幻灯片（PPT 形态）。
 *
 * 一章 = 一节，节里是一叠幻灯片。切法：
 *
 * 1. **第一张是标题页**：标题 = 章名，副标题 = 书名（作者有就带上）。
 * 2. **章内的标题（标题块）自己起一张幻灯片**，它当标题，后面的段落当正文。
 * 3. 其余段落按预算往一张里装：一段算它的字数，一张装不下（默认 220 字）
 *    或者段落数到 5 就换下一张。换张时**这一组的第一段就是新那张的标题**——
 *    把它留在标题里、正文里不再重复，屏幕上就不会出现同一段字两遍。
 *
 * 标题用 CSS 裁几行，不在文本里截断：**不往正文里插任何原文没有的字**，
 * 这一条从编辑器形态起就是硬的（见 docs/SPEC.md 五 5.4）。长段落不当标题
 * （TITLE_MAX_CHARS）的理由也是这一条：塞进标题框里会被版心裁掉尾巴。
 *
 * 图片走 `![](./路径)` 引用行（`mediaModeFor` 一处定义）——幻灯片也是只读的演示文稿，
 * 一张插图铺满版心比一行地址更糟（见决定记录 38）。
 *
 * 备注（演讲者备注）写的是这一张上全部的文字，加上它是第几张——
 * 真做幻灯片时备注里也常常就是把这一页要讲的话摆出来。
 */

export interface SlidePart {
  html: string
  text: string
  kind: Block['kind']
}

export interface Slide {
  /** 1 起的序号，状态栏写「幻灯片 3 / 12」 */
  index: number
  /** 标题页：标题是章名，副标题是书名 */
  cover: boolean
  title: string
  titleHtml: string
  body: SlidePart[]
  /** 备注：这一张的全部文字 */
  notes: string
  chars: number
}

export interface SlideOptions {
  /** 章名（标题页的标题） */
  title: string
  /** 书名（标题页的副标题） */
  subtitle?: string
  /** 一张装多少字 */
  maxChars?: number
  /** 一张最多几段 */
  maxParts?: number
}

const DEFAULT_MAX_CHARS = 220
const DEFAULT_MAX_PARTS = 5

/**
 * 多长的一块才配当标题。
 *
 * 标题框里那行字是 3.2em（幻灯片版心 1320 时约 58px、一行 17 个字、框里放得下三行），
 * 一段更长的正文塞进去就会被版心裁掉尾巴——在阅读器里那就是**正文少了几个字**。
 * 所以长段落不当标题：那一张的标题留空（框还是那个虚线框，和截图里的空占位框一样），
 * 整段进正文——正文框能长到版心底部，装得下。
 * 章内小标题（heading）照旧当标题：它们本来就短，而且标题页/大纲认的就是它。
 */
const TITLE_MAX_CHARS = 48

/**
 * 一张装多少字。
 *
 * 编辑视图里一「页」就是一张 16:9 的幻灯片：内容框是固定的（左右各留 12.35%、
 * 高 24.4%），字一放大，装得下的字就少了。**一张装不下时多余的字会被版心裁掉**
 * ——在阅读器里那就是「正文少了一段」，所以预算得跟着字号走：
 * 按「一行的字数 × 行数」估一下（版心 1320 时内容框约 993×181，行距 1.5），
 * 也就是 120000 ÷ 字号²；再夹在 80（字很大时也不能一张只装一句话）与
 * 220（原来那个默认值，字正常时不该多切张）之间。
 *
 * 阅读器那边算幻灯片（apps/ChapterBody）和缩略图栏（apps/PptApp）**都要问它**，
 * 不然两边切出来的张数不一样、缩略图和大图就对不上了。
 */
export function slideBudget(fontSize: number): { maxChars: number; maxParts: number } {
  const capacity = Math.round(120_000 / (fontSize * fontSize))
  return { maxChars: Math.max(80, Math.min(DEFAULT_MAX_CHARS, capacity)), maxParts: DEFAULT_MAX_PARTS }
}

export function chapterSlides(blocks: Block[], options: SlideOptions): Slide[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const maxParts = options.maxParts ?? DEFAULT_MAX_PARTS
  const target = options.title.trim()
  const content = blocks.filter((block, index) => {
    if (block.text.length === 0 && block.kind !== 'image') return false
    // 开头那个章标题不切进幻灯片：标题页上写的就是它
    if (index === 0 && block.kind === 'keyword' && target && block.text.trim() === target) {
      return false
    }
    return true
  })

  const slides: Slide[] = [
    {
      index: 1,
      cover: true,
      title: options.title,
      titleHtml: '',
      body: options.subtitle ? [{ html: '', text: options.subtitle, kind: 'comment' }] : [],
      notes: options.subtitle ? `${options.title}\n${options.subtitle}` : options.title,
      chars: options.title.length,
    },
  ]

  /** 正在装的那一张。null 表示还没有内容页 */
  let current: Slide | null = null

  const flush = () => {
    if (!current) return
    current.index = slides.length + 1
    current.notes = [current.title, ...current.body.map((part) => part.text)]
      .filter(Boolean)
      .join('\n')
    slides.push(current)
    current = null
  }

  for (const block of content) {
    const isHeading = block.kind === 'keyword' && block.level > 0
    const parts = current?.body.length ?? 0
    const chars = current?.body.reduce((sum, part) => sum + part.text.length, 0) ?? 0

    // 标题块永远另起一张，而且它不再作为正文出现
    if (isHeading || !current || parts >= maxParts || chars >= maxChars) {
      flush()
      // 长段落不当标题（当标题就会在版心外面被裁掉，见 TITLE_MAX_CHARS）：
      // 它就是这一张的正文，标题留空
      const asTitle = isHeading || block.text.length <= TITLE_MAX_CHARS
      current = {
        index: 0,
        cover: false,
        title: asTitle ? block.text : '',
        titleHtml: asTitle ? block.html : '',
        body: asTitle ? [] : [{ html: block.html, text: block.text, kind: block.kind }],
        notes: '',
        chars: block.chars,
      }
      continue
    }

    current.body.push({ html: block.html, text: block.text, kind: block.kind })
  }
  flush()

  return slides
}
