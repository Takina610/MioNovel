import type { Block } from './blocks'
import type { BookRecord } from '../db/db'

/**
 * 段 → 消息（企业微信形态）。
 *
 * 一条正文 = 一条消息。这不是修辞：聊天窗口里能装下一段话的只有气泡，
 * 而读者要看的就是原文，所以每段的文字原样进气泡（html 保留注音、链接、图片）。
 *
 * 两处刻意的克制：
 *
 * 三处刻意的克制：
 *
 * 1. **不编造发信人和时间。** 一整个会话只有一个发信人——这本书（作者名字，
 *    没有就写「书友」）。不把对话段染成「你自己发的」，也不给每条消息配一个
 *    编出来的时间：那两样都是往书里加原文没有的东西。能用的真数据都用了——
 *    章标题当分隔线、字数当状态。
 * 2. **章内的小标题变成居中分隔线**，不是气泡。聊天里的分隔线（日期、入群提示）
 *    长这样，而且它本来就是「这一段是标题」的意思，放在气泡里反而怪。
 * 3. **图不在气泡里，写成一行 `![](./路径)`**（和编辑器、文档同一条约定，见
 *    lib/blocks.ts）。正文进来的 html 已经是引用行，所以这里不额外做什么——
 *    提这一句是为了说明「气泡里没有图」是设计，不是漏了。
 * 4. **双语书的次要语言段（原文）当「我发的消息」**：靠右、用强调色浅底那个气泡，
 *    发信人写「我」。这是用户定的读法——左边是这本书（主语言/译文），右边是我
 *    （原文对照）。第 1 条「不把对话段染成你自己发的」说的是**正文里的对话**，
 *    和这一条不冲突：染的是书里标了次要语言的那些段（解析时的 data-mn-lang）。
 */

export interface ChatMessage {
  key: string
  kind: Block['kind']
  /** 气泡内容（已净化的 HTML，图片、注音、链接都保留） */
  html: string
  text: string
  chars: number
  /** 双语书的次要语言段：显示与否由阅读设置里的双语模式决定 */
  alt: boolean
  /** 居中分隔线（章内小标题），不画气泡 */
  divider: boolean
}

/**
 * 一段正文 = 一条消息。
 *
 * 两处要过滤掉的东西，都是「读者不该在聊天里看到」的：
 *
 * 1. **空行**（TXT 的段落间隔段 `<p class="mn-blank">`）。它们是排版用的空行，
 *    在聊天里会变成一个个空气泡——屏幕上就是一片白方块。
 * 2. **开头那个章标题**。它和聊天窗口顶上那条分隔线（chapterLabel）是同一句话，
 *    留着一个就够。只有「开头 + 是标题 + 文字一样」才丢，正文中间的小标题照旧
 *    当分隔线显示。
 */
export function chapterMessages(blocks: Block[], label = ''): ChatMessage[] {
  const target = label.trim()
  const messages: ChatMessage[] = []
  blocks.forEach((block, index) => {
    if (block.text.length === 0 && block.kind !== 'image') return
    const isHeading = block.kind === 'keyword'
    const leading = messages.length === 0
    if (leading && isHeading && target && block.text.trim() === target) return
    messages.push({
      key: `m-${index}`,
      kind: block.kind,
      html: block.html,
      text: block.text,
      chars: block.chars,
      alt: block.alt,
      divider: isHeading,
    })
  })
  return messages
}

/** 发消息的那个人：书的作者；没有作者就是一个通用称呼，不是编出来的名字 */
export function chatSender(author: string | undefined): string {
  const trimmed = (author ?? '').trim()
  return trimmed || '书友'
}

/** 双语书的原文段当「我发的消息」时，那行写谁 */
export const CHAT_ME = '我'

/**
 * 一条消息的发信人。
 *
 * 双语书的次要语言段（原文，解析时标的 data-mn-lang）在聊天形态里显示成
 * **我发的消息**（靠右、强调色浅底气泡），所以那几行写「我」；其余照样写书的作者。
 * 写在这里而不是组件里：「哪几行算我发的」是这条外壳的规矩之一，
 * 和 CHAT_RAIL 一样要能被断言盯住（verify:apps）。
 */
export function messageSender(message: ChatMessage, sender: string): string {
  return message.alt ? CHAT_ME : sender
}

/**
 * 头像色相。企业微信里每个人一个颜色方块 + 姓名字首，
 * 我们只有一个发信人，所以取名字的哈希——同一个作者永远同一个颜色。
 */
export function avatarHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  // 只取 200-320 这一段色相：蓝到紫，正好是企业微信默认头像的色域
  return 200 + (Math.abs(hash) % 120)
}

/** 头像上的那个字：中文取首字，英文取首字母 */
export function avatarInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '友'
  return /^[\x00-\x7F]/.test(trimmed) ? trimmed[0].toUpperCase() : trimmed[0]
}

/**
 * 最左边那条功能栏（企业微信桌面版的最左一列）。
 *
 * 里面 13 格和真企业微信一一对应，但**只有 4 格是真的**——消息 / 日程 / 通讯录 / 微盘
 * 换的是左边那一栏列什么（见决定记录 27：会响的按钮必须真响）。其余 9 格
 * （邮件、文档、待办、会议、智能文档、智能总结、工作台、高级功能、分组）
 * 在这个阅读器里没有对应物，所以灰着，`why` 就是它们 `title` 里那句解释。
 *
 * 写在这里而不是组件里，是因为「哪几格是真的」不看屏幕发现不了：
 * 顺序错了、把某一格从灰改成了能点，都只有断言拦得住（verify:apps）。
 */
export interface ChatRailItem {
  id: string
  label: string
  /** 有 view = 这一格真的换列表；没有 = 灰着 */
  view?: ChatView
  /** 灰着的原因（进 title） */
  why?: string
}

export type ChatView = 'msg' | 'contacts' | 'schedule' | 'drive'

export const CHAT_RAIL: ChatRailItem[] = [
  { id: 'msg', label: '消息', view: 'msg' },
  { id: 'mail', label: '邮件', why: '这个外壳里没有邮件' },
  { id: 'doc', label: '文档', why: '这个外壳里没有云文档' },
  { id: 'schedule', label: '日程', view: 'schedule' },
  { id: 'todo', label: '待办', why: '这个外壳里没有待办' },
  { id: 'meeting', label: '会议', why: '这个外壳里没有会议' },
  { id: 'smart-doc', label: '智能文档', why: '这个外壳里没有智能文档' },
  { id: 'summary', label: '智能总结', why: '这个外壳里没有智能总结' },
  { id: 'workbench', label: '工作台', why: '这个外壳里没有工作台' },
  { id: 'contacts', label: '通讯录', view: 'contacts' },
  { id: 'drive', label: '微盘', view: 'drive' },
  { id: 'advanced', label: '高级功能', why: '这个外壳里没有高级功能' },
  { id: 'group', label: '分组', why: '这个外壳里没有分组' },
]

/**
 * 会话行上那个小标签。企业微信那里写的是「全员 / 外部 / 群主」，
 * 我们这边只有两个真值：正在读的这本「在读」，读完的「已读完」，其余不写。
 * （没有第三个标签可写——用户名、部门、成员数都是编的，见决定记录 27。）
 */
export function sessionTag(book: BookRecord, currentBookId?: string): string {
  // 「读完」这条先判：正开着的会话也可能是已经读完的，那时候「已读完」比「在读」更准
  if (book.state === 'ready' && book.progress && book.progress.ratio >= 1) return '已读完'
  if (book.id === currentBookId) return '在读'
  return ''
}

/** 会话行上那个红色角标：还有几章没读。读完了、或者还没解析出来的不显示 */
export function sessionUnread(book: BookRecord): number {
  if (book.state !== 'ready') return 0
  const read = book.progress ? book.progress.chapterIndex + 1 : 0
  return Math.max(0, book.chapterCount - read)
}
