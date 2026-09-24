import type { CSSProperties } from 'react'
import type { ChatMessage } from '../lib/chat'
import type { SheetRow } from '../lib/sheet'
import { SHEET_HEAD } from '../lib/sheet'
import type { Slide } from '../lib/slide'
import { cx } from '../lib/cx'

/**
 * 三种「不是一片字」的正文。
 *
 * 表格、幻灯片、聊天这三种形态读的不是一行行文章，而是一格一格的东西，
 * 所以正文由这里渲染，而不是走 content.css 那套排版（那套管的是段落和标题）。
 *
 * 三条公共约定：
 *
 * 1. **文字原样**。气泡 / 单元格 / 幻灯片里的 html 是解析时净化过的原文，
 *    注音、链接、强调、图片都保留；这里只决定外层长什么样。
 * 2. **双语书的次要语言段照旧受控**。data-alt 的那些块用同一组变量
 *    （--mn-alt-display / --mn-primary-display / --mn-alt-color），
 *    所以「对照 / 只看译文 / 只看原文」在这三种形态里也照样管用。
 * 3. **块级元素不带正文排版**。这些形态里没有「段落」，段落级的 margin、缩进、
 *    行号都不该出现——它们只出现在普通形态和编辑器形态里。
 */

/* ==========================================================================
   聊天：一段 = 一条消息
   ========================================================================== */

export interface ChatThreadProps {
  messages: ChatMessage[]
  /** 发信人（书名里的作者，或「书友」） */
  sender: string
  /** 头像上的字与色相（由 lib/chat.ts 算，同一个作者永远同一个颜色） */
  initial: string
  hue: number
  /** 这一段的分隔线文字：章名 */
  chapterLabel: string
}

export function ChatThread({ messages, sender, initial, hue, chapterLabel }: ChatThreadProps) {
  return (
    <div className="mn-thread">
      <div className="mn-thread__divider">{chapterLabel}</div>
      {messages.map((message) =>
        message.divider ? (
          <div key={message.key} className="mn-thread__divider">
            {message.text}
          </div>
        ) : (
          <div
            key={message.key}
            className="mn-thread__row"
            data-alt={message.alt ? 'true' : undefined}
            style={{ ['--mn-avatar-hue' as string]: String(hue) } as CSSProperties}
          >
            {/* 头像每一行都画：微信桌面版就是一气泡一头像，收起来反而不像 */}
            <span className="mn-thread__avatar" title={sender}>
              {initial}
            </span>
            <div className={cx('mn-thread__bubble', `mn-thread__bubble--${message.kind}`)}>
              <span
                className="mn-thread__body"
                // 和阅读器同一条契约：内容是解析时净化过的
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            </div>
          </div>
        ),
      )}
    </div>
  )
}

/** 聊天气泡里那张图的容器：真聊天里图片消息就是一张图（样式在 apps.css 的 .mn-thread__body img） */

/* ==========================================================================
   表格：一段 = 一行
   ========================================================================== */

export interface SheetGridProps {
  rows: SheetRow[]
  /** 章标题（第 1 行的 A1） */
  title: string
  /** 现在哪一行在视口里（行号）。名称框和编辑栏跟着它走 */
  activeRow: number
  /** 这一章的字数合计（状态栏的「计数」） */
  total: number
}

export function SheetGrid({ rows, title, activeRow, total }: SheetGridProps) {
  return (
    <div className="mn-sheet">
      <div className="mn-sheet__row mn-sheet__row--title">
        <span className="mn-sheet__gutter" />
        <span className="mn-sheet__cell mn-sheet__cell--title" style={{ gridColumn: '2 / -1' }}>
          {title}
        </span>
      </div>
      <div className="mn-sheet__row mn-sheet__row--head">
        <span className="mn-sheet__gutter mn-sheet__gutter--corner" />
        {SHEET_HEAD.map((head) => (
          <span key={head} className="mn-sheet__cell mn-sheet__cell--head">
            {head}
          </span>
        ))}
      </div>
      {rows.map((row) => {
        const current = row.row === activeRow
        return (
          <div key={row.row} className="mn-sheet__row" data-alt={row.alt ? 'true' : undefined}>
            <span className="mn-sheet__gutter" data-active={current ? 'true' : undefined}>
              {row.row}
            </span>
            <span
              className="mn-sheet__cell mn-sheet__cell--text"
              data-kind={row.kind}
              data-active={current ? 'true' : undefined}
            >
              {row.text}
            </span>
            <span className="mn-sheet__cell mn-sheet__cell--num" data-active={current ? 'true' : undefined}>
              {row.chars}
            </span>
            <span className="mn-sheet__cell mn-sheet__cell--kind" data-active={current ? 'true' : undefined}>
              {row.kindLabel}
            </span>
          </div>
        )
      })}
      <div className="mn-sheet__foot">
        共 {rows.length} 段 · {total} 字
      </div>
    </div>
  )
}

/* ==========================================================================
   幻灯片：一段（或几段）= 一张
   ========================================================================== */

export interface SlideCardProps {
  slide: Slide
  /** 缩略图模式：什么都不省，只是整体缩小（由外层 transform 缩放） */
  thumb?: boolean
}

/** 一张幻灯片。缩略图栏和大图共用它——所以缩略图里看到的字和正文里是同一份 */
export function SlideCard({ slide, thumb }: SlideCardProps) {
  return (
    <div className={cx('mn-slide', slide.cover && 'mn-slide--cover')} data-thumb={thumb ? 'true' : undefined}>
      <div className="mn-slide__frame">
        <h1 className="mn-slide__title">
          {slide.titleHtml ? (
            <span dangerouslySetInnerHTML={{ __html: slide.titleHtml }} />
          ) : (
            slide.title
          )}
        </h1>
        {slide.cover && slide.body.length > 0 ? (
          <p className="mn-slide__subtitle">{slide.body[0].text}</p>
        ) : null}
        <div className="mn-slide__body">
          {slide.body.slice(slide.cover ? 1 : 0).map((part, index) => (
            <div
              key={index}
              className="mn-slide__part"
              data-kind={part.kind}
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          ))}
        </div>
      </div>
      {thumb ? null : <span className="mn-slide__number">第 {slide.index} 张</span>}
    </div>
  )
}
