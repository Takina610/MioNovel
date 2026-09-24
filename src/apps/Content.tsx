import { useLayoutEffect, useRef, useState } from 'react'
import { messageSender, type ChatMessage } from '../lib/chat'
import type { SheetRow } from '../lib/sheet'
import { SHEET_COLUMNS, SHEET_FIRST_ROW, SHEET_HEAD } from '../lib/sheet'
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
  /** 这一段的分隔线文字：章名 */
  chapterLabel: string
}

/**
 * 消息流。
 *
 * 桌面版企业微信的群里，一条消息长这样：**发信人在气泡左上角、和气泡左沿对齐，
 * 旁边没有头像**（截图里那个群就是这样，每条都写全名，连着的两条也写）。
 * 所以这里不放头像；发信人是书的作者——**除了双语书的原文段**，那几行当「我发的消息」
 * 显示在右边（见 lib/chat.ts 的 messageSender）。
 */
export function ChatThread({ messages, sender, chapterLabel }: ChatThreadProps) {
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
          >
            <span className="mn-thread__sender">{messageSender(message, sender)}</span>
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

/**
 * 工作表网格。
 *
 * 最上面那一行是**列标题**（A / B / C，当前那一列点亮）——Excel 的窗口里
 * 它一直在，所以这里也一直在；表头里那三个字段名（正文 / 字数 / 类型）在
 * 第 2 行，和第 1 行一样都是这份表的一部分（见 lib/sheet.ts）。
 *
 * 行号那一格的宽度、列标题的行高、网格线的颜色都写在 styles/excel.css 里，
 * 全部取 `--mn-sheet-*` 那几个 token（一处定义，行列标题共用）。
 */
export function SheetGrid({ rows, title, activeRow, total }: SheetGridProps) {
  const active = rows.find((row) => row.row === activeRow)
  const activeLetter = active ? active.address.match(/^([A-Z]+)/)?.[1] : undefined

  /**
   * 数据后面那一片空格子。
   *
   * Excel 里往下看到底都是格子，不是一片白——短章（两段话）在这一屏里会露出
   * 大半个窗口，所以我们把剩下的那一屏补成空行。**这不是编内容**：空行只有
   * 行号，而行号是结构性计数器（和 VS Code 的行号、幻灯片序号同一类，
   * 见 AGENTS.md 第二节第 4 条）。
   *
   * 数量按「滚动容器还空着多少」算，而且基准高度要扣掉**已经画上去的空行**
   * （fillersRef）：不扣的话「补上 → 变高 → 不用补 → 又变矮」会来回抖。
   */
  const sheetRef = useRef<HTMLDivElement>(null)
  const fillersRef = useRef(0)
  const [fillers, setFillers] = useState(0)

  useLayoutEffect(() => {
    const sheet = sheetRef.current
    const scroller = sheet?.closest('.mn-scroll') as HTMLElement | null
    if (!sheet || !scroller) return
    const measure = () => {
      // 挑「一行有多高」：补出来的空行和数据行是同一套格子（CSS 里同一档行高），
      // 所以量到哪个都一样。行高量不出来（还没排版）就什么也不做
      const sample =
        sheet.querySelector<HTMLElement>('.mn-sheet__fill .mn-sheet__row') ??
        sheet.querySelector<HTMLElement>('.mn-sheet__row:not(.mn-sheet__row--cols)')
      const rowH = sample?.offsetHeight ?? 0
      if (rowH <= 0) return
      // 基准高度是「不含空行」的那一份：不扣掉已画的空行，加了就超、超了又减，会来回抖
      const base = sheet.offsetHeight - fillersRef.current * rowH
      // floor 不是 ceil：宁可差一行，也不要多出一行把页面顶出滚动条
      const next = Math.max(0, Math.floor((scroller.clientHeight - base) / rowH))
      if (next !== fillersRef.current) {
        fillersRef.current = next
        setFillers(next)
      }
    }
    measure()
    // 刚挂上时字号变量、字体都可能还没落定，量到的行高会偏。补两拍再量一次
    const settle = window.setTimeout(measure, 100)
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => {
      window.clearTimeout(settle)
      observer.disconnect()
    }
  }, [rows, fillers])

  const lastRow = rows.length > 0 ? rows[rows.length - 1].row : SHEET_FIRST_ROW - 1

  return (
    <div className="mn-sheet" ref={sheetRef}>
      <div className="mn-sheet__row mn-sheet__row--cols">
        <span className="mn-sheet__corner" />
        {SHEET_COLUMNS.map((column) => (
          <span
            key={column}
            className="mn-sheet__colhead"
            data-active={column === activeLetter ? 'true' : undefined}
          >
            {column}
          </span>
        ))}
      </div>
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
      {fillers > 0 ? (
        <div className="mn-sheet__fill" aria-hidden>
          {Array.from({ length: fillers }, (_, index) => (
            <div key={index} className="mn-sheet__row">
              <span className="mn-sheet__gutter">{lastRow + index + 1}</span>
              <span className="mn-sheet__cell" />
              <span className="mn-sheet__cell" />
              <span className="mn-sheet__cell" />
            </div>
          ))}
        </div>
      ) : null}
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
