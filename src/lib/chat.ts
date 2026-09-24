import type { Block } from './blocks'

/**
 * 段 → 消息（企业微信形态）。
 *
 * 一条正文 = 一条消息。这不是修辞：聊天窗口里能装下一段话的只有气泡，
 * 而读者要看的就是原文，所以每段的文字原样进气泡（html 保留注音、链接、图片）。
 *
 * 两处刻意的克制：
 *
 * 1. **不编造发信人和时间。** 一整个会话只有一个发信人——这本书（作者名字，
 *    没有就写「书友」）。不把对话段染成「你自己发的」，也不给每条消息配一个
 *    编出来的时间：那两样都是往书里加原文没有的东西。能用的真数据都用了——
 *    章标题当分隔线、字数当状态。
 * 2. **章内的小标题变成居中分隔线**，不是气泡。聊天里的分隔线（日期、入群提示）
 *    长这样，而且它本来就是「这一段是标题」的意思，放在气泡里反而怪。
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
