import { useCallback, useMemo } from 'react'
import { chapterBlocks, mediaModeFor } from '../lib/blocks'
import { avatarHue, avatarInitial, chapterMessages, chatSender } from '../lib/chat'
import { deskPeerText, deskReceipts, deskStampText } from '../lib/desk'
import { activeRowOf, chapterRows, rowsTotal } from '../lib/sheet'
import { chapterSlides, slideBudget } from '../lib/slide'
import { ChatThread, DeskThread, SheetGrid, SlideCard } from './Content'

/**
 * 块状形态的正文。
 *
 * 表格、幻灯片、聊天、客服工作台这四种形态的正文不是「一片字」，而是格子 /
 * 幻灯片 / 气泡，所以它由这里渲染。ReaderView 只管把这一块放进它的滚动容器里
 * （进度、锚点跳转、键盘滚动那几件事仍然归它），至于里面是什么由 chrome 决定。
 *
 * 分工的边界很清楚：**派生数据是纯函数算的**（lib/sheet.ts / lib/slide.ts /
 * lib/chat.ts / lib/desk.ts），外壳需要同一份数据时（编辑栏的当前行、缩略图栏、
 * 已读回执）自己再算一遍——纯函数，两边算出来的东西一定一样。
 */
export interface ChapterBodyProps {
  chrome: 'chat' | 'sheet' | 'slide' | 'desk'
  html: string
  /** 渲染时的图片地址 → 书里的原始路径（四种块状形态写图片引用都要用） */
  resources?: Map<string, string>
  /** 章名。聊天的分隔线、表格的 A1、幻灯片的标题页、客服的分隔线都用它 */
  label: string
  /** 书名（幻灯片的副标题、客服的消息行上「书名 : 作者」） */
  bookTitle: string
  /** 作者（聊天里的发信人） */
  author: string
  /** 章内进度 0-1。表格的「当前行」、幻灯片的「当前这张」、客服的已读回执按它算 */
  percent: number
  /** 字号（幻灯片按它决定一张装多少字，见 lib/slide.ts 的 slideBudget） */
  fontSize: number
  /**
   * 这本书真实的最近阅读时间（客服工作台用：消息行上那一行小字的时间）。
   * 只有读到的那一条上写它，别的消息不写时间——一条消息一个编出来的时刻
   * 是最容易露馅的东西（见决定记录 27）。
   */
  readStamp?: number
}

export function ChapterBody({
  chrome,
  html,
  resources,
  label,
  bookTitle,
  author,
  percent,
  fontSize,
  readStamp,
}: ChapterBodyProps) {
  const resolve = useCallback((src: string) => resources?.get(src), [resources])
  const blocks = useMemo(
    () =>
      chapterBlocks(html, {
        // 图片怎么处理由 mediaModeFor 一处说了算（见 lib/blocks.ts）
        media: mediaModeFor(chrome),
        resolve,
      }),
    [html, chrome, resolve],
  )

  // 四个派生结果都在这儿算（不能在分支里调 hook），但只算当前形态那一个
  const messages = useMemo(
    () => (chrome === 'chat' || chrome === 'desk' ? chapterMessages(blocks, label) : []),
    [chrome, blocks, label],
  )
  const receipts = useMemo(
    () => (chrome === 'desk' ? deskReceipts(messages, percent) : []),
    [chrome, messages, percent],
  )
  const rows = useMemo(
    () => (chrome === 'sheet' ? chapterRows(blocks, label) : []),
    [chrome, blocks, label],
  )
  const slides = useMemo(
    () =>
      chrome === 'slide'
        ? chapterSlides(blocks, {
            title: label,
            subtitle: author ? `${bookTitle} · ${author}` : bookTitle,
            ...slideBudget(fontSize),
          })
        : [],
    [chrome, blocks, label, bookTitle, author, fontSize],
  )

  if (chrome === 'chat') {
    return <ChatThread messages={messages} sender={chatSender(author)} chapterLabel={label} />
  }

  if (chrome === 'desk') {
    const sender = chatSender(author)
    return (
      <DeskThread
        messages={messages}
        sender={sender}
        avatar={avatarInitial(author || bookTitle)}
        // 头像色域取橙色那一段：1688 的默认头像是橙色的（见 lib/chat.ts 的 avatarHue）
        hue={avatarHue(author || bookTitle, 8, 34)}
        peer={deskPeerText(bookTitle, author)}
        stamp={readStamp ? deskStampText(readStamp) : ''}
        receipts={receipts}
        chapterLabel={label}
      />
    )
  }

  if (chrome === 'sheet') {
    return (
      <SheetGrid
        rows={rows}
        title={label}
        activeRow={activeRowOf(rows, percent)}
        total={rowsTotal(rows)}
      />
    )
  }

  return (
    <div className="mn-ppt__stage">
      {slides.map((slide) => (
        // id 给缩略图栏点跳转用：和真 PPT 里点缩略图跳到那一张是一回事。
        // 一「页」= 一屏（高度由 PptApp 量出来写进 --mn-ppt-page），
        // 所以上下滚动就是一张张翻——这正是编辑视图的样子
        <section key={slide.index} id={`mn-slide-${slide.index}`} className="mn-ppt__page">
          <SlideCard slide={slide} />
        </section>
      ))}
    </div>
  )
}
