/**
 * 章内查找。
 *
 * 为什么需要它：Word 的标题栏正中间就是一个搜索框，功能区里还有「查找」。
 * 这两处要么真能搜，要么就别画——一个看着能打字、打进去什么也不发生的输入框
 * 是骗人的（AGENTS.md 第二节第 3 条：不画假输入框）。
 *
 * 找的范围是**当前这一章**：一本书动辄几百章，全文搜索要先把每一章都读一遍
 * （库里存的是分章的 HTML，没有全文索引），为一个标题栏上的框不值得。
 * 章内的东西是读者真正要的——「这句话在哪一段出现过」。
 *
 * 三条实现上的取舍：
 *
 * 1. **只在一个文本节点里找**。跨元素边界的词（<b>上</b>下 这种）不算命中：
 *    跨节点替换要把元素切开，正文 DOM 是解析器给我们的，不该被查找弄碎。
 * 2. **不改原文一个字**。只在命中处套一个 <mark class="mn-find">，
 *    清掉标记时把文字还回父节点，正文与解析结果逐字相同。
 * 3. **不搜我们自己拼进去的东西**（章末那对「上一章 / 下一章」、注音 rt），
 *    它们不是书里的字。
 *
 * 纯 DOM 操作，不碰 React：正文那一块是 dangerouslySetInnerHTML 写进去的，
 * 字符串没变 React 就不会动它，所以标记能留在里面。
 */

/** 命中标记的类名。样式在 styles/word.css（当前那一处另有 is-current） */
export const FIND_MARK = 'mn-find'
/** 不参与查找的子树：章末翻章按钮、注音 */
const SKIP_SELECTOR = '[data-mn-nav], rt, .mn-chapter-nav'

/** 命中处要套的那个元素 */
function markFor(text: string): HTMLElement {
  const mark = document.createElement('mark')
  mark.className = FIND_MARK
  mark.textContent = text
  return mark
}

/**
 * 清掉上一次的标记：把 <mark class="mn-find"> 拆掉，文字还给父节点。
 * 拆完如果父节点空了（本来只有一个空的 mark）就把它摘掉。
 * 返回清掉了几个。
 */
export function clearFinds(root: HTMLElement): number {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark.${FIND_MARK}`))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
    // 相邻的文本节点合并回去：不合并的话反复查找会把一个段落切成几十个节点，
    // 下一次查找命中被切碎、样式也会因为节点边界出问题
    parent.normalize()
  }
  return marks.length
}

/**
 * 在正文里找出所有命中并套上标记，按出现顺序返回这些标记。
 * query 为空（或只有空白）时只做清理，返回空数组。
 *
 * 大小写：英文忽略大小写（和 Word 的默认一致），中日文本来就没有大小写。
 */
export function markFinds(root: HTMLElement, query: string): HTMLElement[] {
  clearFinds(root)
  const needle = query.trim()
  if (!needle) return []

  const hay = needle.toLowerCase()
  const marks: HTMLElement[] = []

  // 先把要扫的文本节点收集成一份静态列表：一边扫一边改 DOM 的话，
  // TreeWalker 会被自己插进去的节点带偏（标记内部的文字会被重复命中）
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const text = node.nodeValue ?? ''
      if (!text.trim()) return NodeFilter.FILTER_REJECT
      const parent = (node as Text).parentElement
      if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
      return text.toLowerCase().includes(hay) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  const targets: Text[] = []
  while (walker.nextNode()) targets.push(walker.currentNode as Text)

  for (const node of targets) {
    const text = node.nodeValue ?? ''
    const lower = text.toLowerCase()
    let from = 0
    let at = lower.indexOf(hay, from)
    if (at < 0) continue
    // 这个节点里的命中处：把命中之间的文字原样留在外面的文本节点里
    const pieces: Node[] = []
    while (at >= 0) {
      if (at > from) pieces.push(document.createTextNode(text.slice(from, at)))
      pieces.push(markFor(text.slice(at, at + needle.length)))
      from = at + needle.length
      at = lower.indexOf(hay, from)
    }
    if (from < text.length) pieces.push(document.createTextNode(text.slice(from)))
    const parent = node.parentNode
    if (!parent) continue
    for (const piece of pieces) parent.insertBefore(piece, node)
    parent.removeChild(node)
    parent.normalize()
    marks.push(...pieces.filter((piece): piece is HTMLElement => piece instanceof HTMLElement))
  }
  return marks
}

/** 只数不改：查一下这一章里有几处（查找框旁的计数用它） */
export function countFinds(root: HTMLElement, query: string): number {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const text = node.nodeValue ?? ''
      if (!text.trim()) return NodeFilter.FILTER_REJECT
      const parent = (node as Text).parentElement
      if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let total = 0
  while (walker.nextNode()) {
    const text = (walker.currentNode.nodeValue ?? '').toLowerCase()
    let from = 0
    let at = text.indexOf(needle, from)
    while (at >= 0) {
      total++
      from = at + needle.length
      at = text.indexOf(needle, from)
    }
  }
  return total
}

/**
 * 把某一处命中挪到眼前。
 *
 * 用 scrollIntoView 而不是自己算偏移：正文外面套了几层（滚动容器、纸张、
 * 居中），算起来容易差一个容器的高度。block: 'center' 让命中落在屏幕中间，
 * 上一处下一处翻的时候不会一上一下地跳。
 */
export function revealFind(mark: HTMLElement, isCurrent: boolean): void {
  mark.classList.toggle('is-current', isCurrent)
  if (isCurrent) mark.scrollIntoView({ block: 'center', behavior: 'auto' })
}
