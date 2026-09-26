import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { BookRecord } from '../db/db'
import {
  CHAT_RAIL,
  avatarHue,
  avatarInitial,
  sessionTag,
  sessionUnread,
  type ChatView,
} from '../lib/chat'
import { fileNameFor } from '../lib/appdocs'
import { formatChars, formatPercent, formatRelativeTime } from '../lib/format'
import { cx } from '../lib/cx'
import {
  IconBack,
  IconChevron,
  IconChevronRight,
  IconImport,
  IconList,
  IconSearch,
  IconSidebar,
  IconSliders,
} from '../components/ui/icons'
import {
  IconCalendar,
  IconChatBubble,
  IconChevronWide,
  IconCloud,
  IconContacts,
  IconDoc,
  IconFullscreen,
  IconMail,
  IconMeeting,
  IconPhone,
  IconPlusThin,
  IconSmartDoc,
  IconSparkle,
  IconTag,
  IconTodo,
  IconVideo,
  IconWorkbench,
} from '../components/ui/app-icons'
import { useHotkeyCombo } from '../store/hotkeys'
import { toggleFullscreen } from '../lib/fullscreen'
import { WindowControls, chromeDragProps } from '../components/ui/WindowControls'
import { AppMenu } from './OfficeFrame'
import type { AppFrameProps } from './types'
import type { ShelfProps } from './ShelfShell'
import type { TocRow } from '../hooks/useToc'

/**
 * 功能栏那 13 格的图标。顺序和「哪几格是真的」在 lib/chat.ts 的 CHAT_RAIL 里
 * （那是纯数据，verify:apps 断言的就是它）；这里只负责给每一格配一个记号。
 *
 * 图标盒子给 30px 而不是 24px：我们这批记号画在 24 格里、墨迹只占 60% 上下，
 * 按 24 画出来看着比企业微信的小一圈（见 AGENTS.md 那条换算）。
 */
const RAIL_ICONS: Record<string, ReactNode> = {
  msg: <IconChatBubble className="h-[30px] w-[30px]" />,
  mail: <IconMail className="h-[30px] w-[30px]" />,
  doc: <IconDoc className="h-[30px] w-[30px]" />,
  schedule: <IconCalendar className="h-[30px] w-[30px]" />,
  todo: <IconTodo className="h-[30px] w-[30px]" />,
  meeting: <IconMeeting className="h-[30px] w-[30px]" />,
  'smart-doc': <IconSmartDoc className="h-[30px] w-[30px]" />,
  summary: <IconSparkle className="h-[30px] w-[30px]" />,
  workbench: <IconWorkbench className="h-[30px] w-[30px]" />,
  contacts: <IconContacts className="h-[30px] w-[30px]" />,
  drive: <IconCloud className="h-[30px] w-[30px]" />,
  advanced: <IconChevronWide className="h-[30px] w-[30px]" />,
  group: <IconTag className="h-[30px] w-[30px]" />,
}

/**
 * 企业微信形态。
 *
 * 一本书 = 一个会话，一段正文 = 一条消息（见 lib/chat.ts）。界面照着桌面版企业微信
 * 的截图重画（量到的尺寸写在 styles/chat.css 的开头）：最左边一条 58px 的功能栏
 * （13 格「图标 + 小字」，选中的那一格垫一块浅蓝方块），中间 249px 的会话列表
 * （搜索框 + 「＋」+ 会话行），右边是会话（群名 + 消息流 + 输入区），
 * 最右边 158px 的群信息面板。
 *
 * 四处刻意的取舍：
 *
 * 1. **功能栏那 13 格里只有 4 格真的会响**：消息 / 日程 / 通讯录 / 微盘换的是左边
 *    那一栏列什么（按最近阅读、按最后阅读日期、按作者、按文件）。其余 9 格
 *    （邮件、待办、会议、智能文档……）这个阅读器里没有对应物，照企业微信的样子
 *    画出来、但是灰的，title 里说清为什么——见决定记录 27。
 * 2. **输入区里没有假输入框**。真聊天的输入框能打字，我们的不能——所以那个白盒子里
 *    放的是**这一章的位置**：一行真数据 + 一条能拖的进度条。右下角「发送(S)」的位置
 *    是「下一章」，按下去真的翻章。
 * 3. **右边那块面板 = 群信息的位置**：企业微信里放群公告、群名和成员名单，
 *    我们放「本章」（当前章名）+「聊天记录」（目录）。卷/部这类目录分组
 *    正好落在企业微信那些橙色分组标题的位置上。
 * 4. **不编发信人和时间**。发信人是书里的作者（没有就写「书友」），会话行上的
 *    标签只有两个真值：「在读」「已读完」；时间用的是真的「最近阅读」时间，
 *    不编「9:51」。
 */
export function ChatApp(props: AppFrameProps) {
  const { book } = props
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024)
  /**
   * 输入区收起来。收的是那个白盒子（这一章的位置 + 进度条 + 「发送」那一行），
   * 工具条留着——收起按钮就在工具条上，收完还得能放下来。
   * 长章读到一半时会想收一下：消息区一次多出一屏。
   */
  const [composerOpen, setComposerOpen] = useState(true)
  const [view, setView] = useState<ChatView>('msg')
  const settingsHotkey = useHotkeyCombo('settings')
  const fullscreenHotkey = useHotkeyCombo('fullscreen')
  const dimHotkey = useHotkeyCombo('dim')

  const chapterLabel = props.chapterTitle || `第 ${props.chapterIndex + 1} 章`
  const threadRef = useRef<HTMLDivElement>(null)

  /**
   * 「本章」那一行：把消息区卷回本章开头。真动作，不是摆设。
   *
   * 用直接写 scrollTop 而不是 smooth：阅读器里所有「跳」都是这么做的
   * （换章、恢复位置都是直接写），而且平滑滚动靠 rAF 逐帧推进——标签页在后台
   * 时一帧都不来，按下去就真的什么都不发生了（这个坑在验收时量到过）。
   */
  const backToChapterTop = () => {
    const scroller = threadRef.current?.querySelector('.mn-scroll')
    if (scroller) scroller.scrollTop = 0
  }

  return (
    <ChatFrame
      view={view}
      onView={setView}
      books={props.books}
      currentBookId={book.id}
      chapterIndex={props.chapterIndex}
      onOpenBook={props.onOpenBook}
      onImport={props.onImport}
      onOpenSettings={props.onOpenSettings}
      dim={props.dim}
      main={
        <>
          <header className="mn-chat__head" {...chromeDragProps()} data-mn-drag="">
            <div className="mn-chat__peer" data-mn-drag="">
              <span className="mn-chat__peer-name" title={book.title}>
                {book.title}
              </span>
              {/* 副标题写这一屏此刻的真数据：多少章、多少字、读到哪 */}
              <span className="mn-chat__peer-sub">
                共 {props.chapterCount} 章 · {formatChars(book.totalChars)} · 已读{' '}
                {formatPercent(props.percent)}
              </span>
            </div>
            <div className="mn-chat__head-actions">
              <button type="button" className="mn-chat__icon-btn" title="语音通话（这个外壳里没有）" disabled>
                <IconPhone className="h-6 w-6" />
              </button>
              <button type="button" className="mn-chat__icon-btn" title="视频通话（这个外壳里没有）" disabled>
                <IconVideo className="h-6 w-6" />
              </button>
              <button
                type="button"
                className={cx('mn-chat__icon-btn', panelOpen && 'is-active')}
                title="聊天记录（目录）"
                aria-pressed={panelOpen}
                onClick={() => setPanelOpen((open) => !open)}
              >
                <IconSidebar className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="mn-chat__icon-btn"
                title="阅读设置"
                onClick={props.onOpenSettings}
              >
                <IconSliders className="h-6 w-6" />
              </button>
              <AppMenu
                items={[
                  { label: '阅读设置', hint: settingsHotkey, onSelect: props.onOpenSettings },
                  {
                    label: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）',
                    hint: dimHotkey,
                    onSelect: props.onToggleDim,
                  },
                  { label: '全屏', hint: fullscreenHotkey, onSelect: toggleFullscreen },
                  { label: '回到会话列表', separatorBefore: true, onSelect: props.onBack },
                ]}
              />
            </div>
            {/* 桌面端非常规主题：原生标题栏收掉了，三颗窗口钮挂在这条顶栏上 */}
            <WindowControls />
          </header>

          <div className="mn-chat__body">
            <div className="mn-chat__column">
              <div className="mn-chat__stage">
                <div ref={threadRef} className="mn-chat__scroll mn-veil">
                  {props.children}
                </div>
              </div>

              <footer className="mn-chat__compose">
                <div className="mn-chat__box" data-collapsed={composerOpen ? undefined : 'true'}>
                  <div className="mn-chat__tools">
                    <button type="button" className="mn-chat__tool" title="导入文件" onClick={props.onImport}>
                      <IconImport className="h-6 w-6" />
                    </button>
                    {/* 换章：左右箭头（带杆的那种，一眼看得出是「前一条 / 后一条」）。
                        chevron 画的是「向下」，顺时针 90° 才是朝左——和飞书顶栏那个返回箭头同一条换算 */}
                    <button
                      type="button"
                      className="mn-chat__tool"
                      title="上一章"
                      disabled={props.chapterIndex <= 0}
                      onClick={() => props.onChapter(props.chapterIndex - 1)}
                    >
                      <IconBack className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      className="mn-chat__tool"
                      title="下一章"
                      disabled={props.chapterIndex >= props.chapterCount - 1}
                      onClick={() => props.onChapter(props.chapterIndex + 1)}
                    >
                      <IconBack className="h-6 w-6 rotate-180" />
                    </button>
                    {/* 回会话列表：用列表记号，不用箭头——左边那对箭头已经占了「前一条 / 后一条」的意思 */}
                    <button type="button" className="mn-chat__tool" title="回到会话列表" onClick={props.onBack}>
                      <IconList className="h-6 w-6" />
                    </button>
                    <div className="flex-1" />
                    {/* 收起 / 展开输入区。收起之后只剩这一条工具条，按钮就在它上面 */}
                    <button
                      type="button"
                      className="mn-chat__tool"
                      title={composerOpen ? '收起输入区' : '展开输入区'}
                      aria-pressed={!composerOpen}
                      onClick={() => setComposerOpen((open) => !open)}
                    >
                      {/* 开着的箭头朝下（按下去收到底）、收着的朝上（按下去放回来） */}
                      <IconChevron className={cx('h-6 w-6', !composerOpen && 'rotate-180')} />
                    </button>
                    <button
                      type="button"
                      className="mn-chat__tool"
                      title="聊天记录（目录）"
                      aria-pressed={panelOpen}
                      onClick={() => setPanelOpen((open) => !open)}
                    >
                      {/* 和顶栏那个目录开关同一个记号（都是开合右边那块面板） */}
                      <IconSidebar className="h-6 w-6" />
                    </button>
                  </div>
                  {composerOpen ? (
                    <div className="mn-chat__input">
                      <span className="mn-chat__box-text">
                        {chapterLabel}
                        <span className="mn-chat__box-hint"> · 已读 {formatPercent(props.percent)}</span>
                      </span>
                      <input
                        type="range"
                        className="mn-chat__range"
                        min={0}
                        max={1000}
                        step={1}
                        value={Math.round(props.percent * 1000)}
                        onChange={(event) => props.onSeek(Number(event.target.value) / 1000)}
                        aria-label="全书进度"
                        title="拖一下换位置（这个外壳里没有输入框：发不出去的框不如一个有用的滑条）"
                      />
                    </div>
                  ) : null}
                  {composerOpen ? (
                    <div className="mn-chat__send-row">
                      <button
                        type="button"
                        className="mn-chat__send"
                        disabled={props.chapterIndex >= props.chapterCount - 1}
                        title="下一章（发送）"
                        onClick={() => props.onChapter(props.chapterIndex + 1)}
                      >
                        下一章
                      </button>
                    </div>
                  ) : null}
                </div>
              </footer>
            </div>

            {panelOpen ? (
              <ChatPanel
                chapters={props.chapters}
                chapterIndex={props.chapterIndex}
                chapterCount={props.chapterCount}
                chapterLabel={chapterLabel}
                chapterChars={props.chapterChars}
                percent={props.percent}
                onChapter={props.onChapter}
                onBackToChapterTop={backToChapterTop}
                onOpenSettings={props.onOpenSettings}
                onBack={props.onBack}
                dimOn={props.dimOn}
                onToggleDim={props.onToggleDim}
                dimHotkey={dimHotkey}
              />
            ) : null}
          </div>

        </>
      }
    />
  )
}

/**
 * 右边那块面板——企业微信里这是群信息面板（群公告、群名、群成员）。
 *
 * 我们这一层放的是同一批位置上的真东西：
 *
 *   群公告      → 「本章 ›」：点一下把消息区卷回本章开头
 *   群名卡片    → 当前这一章的章名（企业微信那里也是两行的大字）
 *   群成员 · N  → 「聊天记录 · N 章」（目录）
 *   成员分组    → 卷 / 部那类目录分组（企业微信的公司名也是橙色小字 + ›，
 *                 点一下跳到那一组的第一章）
 *   成员行      → 每一章一行；当前这一章带一个小标签（企业微信那里是「群主」）
 *
 * 所以这层没有一处编造：整块面板就是这本书的目录，只是摆在了企业微信摆成员的地方。
 */
function ChatPanel({
  chapters,
  chapterIndex,
  chapterCount,
  chapterLabel,
  chapterChars,
  percent,
  onChapter,
  onBackToChapterTop,
  onOpenSettings,
  onBack,
  dimOn,
  onToggleDim,
  dimHotkey,
}: {
  chapters?: TocRow[]
  chapterIndex: number
  chapterCount: number
  chapterLabel: string
  chapterChars?: number
  percent: number
  onChapter: (index: number) => void
  onBackToChapterTop: () => void
  onOpenSettings: () => void
  onBack?: () => void
  dimOn: boolean
  onToggleDim: () => void
  dimHotkey: string
}) {
  /** 分组那一行点了跳到它下面的第一章：从分组往后找第一个章节行 */
  const firstChapterOf = (rows: TocRow[], position: number): number | null => {
    for (let i = position + 1; i < rows.length; i++) {
      if (rows[i].type === 'chapter') return rows[i].index
    }
    return null
  }

  return (
    <aside className="mn-chat__panel" aria-label="聊天记录">
      <button
        type="button"
        className="mn-chat__panel-top"
        title="回到本章开头"
        onClick={onBackToChapterTop}
      >
        <span className="mn-chat__panel-top-label">本章</span>
        <IconChevronRight className="h-4 w-4" />
      </button>
      <div className="mn-chat__panel-card" title={chapterLabel}>
        {chapterLabel}
      </div>

      <div className="mn-chat__panel-sec">
        <span>
          聊天记录 · {chapterCount} 章
        </span>
        <div className="flex-1" />
        <AppMenu
          items={[
            { label: '阅读设置', onSelect: onOpenSettings },
            {
              label: dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）',
              hint: dimHotkey,
              onSelect: onToggleDim,
            },
            { label: '回到会话列表', separatorBefore: true, onSelect: onBack ?? (() => undefined) },
          ]}
        />
      </div>

      <div className="mn-chat__panel-list">
        {chapters === undefined ? (
          <p className="mn-office__side-hint">正在读目录…</p>
        ) : (
          chapters.map((row, position) =>
            row.type === 'group' ? (
              <button
                key={`g-${position}`}
                type="button"
                className="mn-chat__panel-group"
                title={`跳到「${row.label}」的第一章`}
                onClick={() => {
                  const first = firstChapterOf(chapters, position)
                  if (first !== null) onChapter(first)
                }}
              >
                {row.label} ›
              </button>
            ) : (
              <PanelRow
                key={row.index}
                label={row.label}
                active={row.index === chapterIndex}
                onClick={() => onChapter(row.index)}
              />
            ),
          )
        )}
      </div>

      <div className="mn-chat__panel-foot">
        <div className="mn-chat__panel-text">
          <span>本章 {formatChars(chapterChars ?? 0)}</span>
          <span>已读 {formatPercent(percent)}</span>
        </div>
      </div>
    </aside>
  )
}

/** 目录里的一章。当前那一章滚进视野——企业微信里选中的成员也这么浮上来 */
function PanelRow({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])
  return (
    <button
      ref={ref}
      type="button"
      className={cx('mn-chat__panel-row', active && 'is-active')}
      aria-current={active}
      title={label}
      onClick={onClick}
    >
      <span className="mn-chat__panel-glyph">
        <IconChatBubble className="h-[18px] w-[18px]" />
      </span>
      <span className="mn-chat__panel-name">{label}</span>
      {active ? <span className="mn-chat__panel-mark">本章</span> : null}
    </button>
  )
}

/**
 * 会话窗口的框：功能栏 + 会话列表 + 主区。
 * 阅读器和首页共用它——首页只是主区里没有人被选中。
 */

function ChatFrame({
  view,
  onView,
  books,
  currentBookId,
  chapterIndex,
  onOpenBook,
  onImport,
  onOpenSettings,
  dim,
  main,
}: {
  view: ChatView
  onView: (view: ChatView) => void
  books?: BookRecord[]
  currentBookId?: string
  chapterIndex?: number
  onOpenBook?: (book: BookRecord) => void
  onImport?: () => void
  onOpenSettings: () => void
  dim: number
  main: ReactNode
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const list = (books ?? []).filter(
    (book) =>
      !needle ||
      book.title.toLowerCase().includes(needle) ||
      book.author.toLowerCase().includes(needle),
  )

  /**
   * 窄屏上会话列表是浮层：390px 的宽度里，功能栏 52 + 列表 249 只剩 89 给消息，
   * 那不是聊天窗口，是一条竖着的缝。和编辑器形态的侧栏同一个做法：
   * 窄屏收起来、按钮切换，宽屏一直是常驻的一列。
   */
  const [narrowList, setNarrowList] = useState(false)
  /** 「消息」那一格的角标：还有几个会话没读完（真的数得出来的东西） */
  const unreadSessions = (books ?? []).filter((book) => sessionUnread(book) > 0).length

  return (
    <div
      className="mn-chat"
      style={{ ['--mn-dim' as string]: String(dim) }}
      data-list={narrowList ? 'open' : 'closed'}
    >
      <button
        type="button"
        className="mn-chat__list-toggle"
        aria-label={narrowList ? '收起会话列表' : '展开会话列表'}
        aria-pressed={narrowList}
        onClick={() => setNarrowList((open) => !open)}
      >
        <IconChatBubble className="h-4 w-4" />
      </button>
      <nav className="mn-chat__rail" aria-label="功能栏">
        <span className="mn-chat__me" title="我">
          我
        </span>
        {CHAT_RAIL.map((item) => {
          const real = item.view !== undefined
          return (
            <button
              key={item.id}
              type="button"
              className="mn-chat__rail-btn"
              title={real ? item.label : (item.why ?? item.label)}
              aria-label={item.label}
              aria-pressed={real ? view === item.view : undefined}
              disabled={!real}
              onClick={real ? () => onView(item.view as ChatView) : undefined}
            >
              <span className="mn-chat__rail-icon">
                {RAIL_ICONS[item.id]}
                {item.id === 'msg' && unreadSessions > 0 ? (
                  <span className="mn-chat__rail-badge" title={`${unreadSessions} 个会话还没读完`}>
                    {unreadSessions > 99 ? '99+' : unreadSessions}
                  </span>
                ) : null}
              </span>
              <span className="mn-chat__rail-label">{item.label}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        {/* 摸鱼的入口在顶栏 ⋯ 菜单和阅读设置里（用户要求：功能栏上不出现这个功能的字样） */}
        <button
          type="button"
          className="mn-chat__rail-btn"
          title="全屏"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen()
            else void document.documentElement.requestFullscreen()
          }}
        >
          <span className="mn-chat__rail-icon">
            <IconFullscreen className="h-[26px] w-[26px]" />
          </span>
          <span className="mn-chat__rail-label">全屏</span>
        </button>
        <button type="button" className="mn-chat__rail-btn" title="阅读设置" onClick={onOpenSettings}>
          <span className="mn-chat__rail-icon">
            <IconSliders className="h-[26px] w-[26px]" />
          </span>
          <span className="mn-chat__rail-label">设置</span>
        </button>
      </nav>

      <aside className="mn-chat__list" aria-label={CHAT_RAIL.find((item) => item.view === view)?.label}>
        <div className="mn-chat__list-top">
          <label className="mn-chat__search">
            <IconSearch className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={view === 'contacts' ? '搜索联系人' : '搜索'}
              aria-label="搜索"
            />
          </label>
          <button type="button" className="mn-chat__add" title="导入文件" onClick={onImport}>
            <IconPlusThin className="h-5 w-5" />
          </button>
        </div>
        <div className="mn-chat__list-body">
          {books === undefined ? (
            <p className="mn-office__side-hint">正在打开书架…</p>
          ) : (
            <ChatListView
              view={view}
              books={list}
              total={books.length}
              query={query}
              currentBookId={currentBookId}
              chapterIndex={chapterIndex}
              // 窄屏上点完就收起浮层：点一下会话，屏幕该换成那条会话
              onOpenBook={(book) => {
                setNarrowList(false)
                onOpenBook?.(book)
              }}
            />
          )}
        </div>
      </aside>

      <main className="mn-chat__main">{main}</main>
    </div>
  )
}

/** 四种列表视图。全是真数据：按作者、按最后阅读日期、按文件大小 */
function ChatListView({
  view,
  books,
  total,
  query,
  currentBookId,
  chapterIndex,
  onOpenBook,
}: {
  view: ChatView
  books: BookRecord[]
  total: number
  query: string
  currentBookId?: string
  chapterIndex?: number
  onOpenBook?: (book: BookRecord) => void
}) {
  if (total === 0) {
    return <p className="mn-office__side-hint">还没有会话</p>
  }
  if (books.length === 0) {
    return <p className="mn-office__side-hint">没有匹配「{query}」的</p>
  }

  if (view === 'contacts') {
    const byAuthor = new Map<string, BookRecord[]>()
    for (const book of books) {
      const key = book.author.trim() || '佚名'
      const list = byAuthor.get(key) ?? []
      list.push(book)
      byAuthor.set(key, list)
    }
    return (
      <div className="mn-chat__contacts">
        {[...byAuthor.entries()].map(([author, list]) => (
          <div key={author} className="mn-chat__contact">
            <div className="mn-chat__contact-head">
              <span
                className="mn-chat__avatar"
                style={{ ['--mn-avatar-hue' as string]: String(avatarHue(author)) } as CSSProperties}
              >
                {avatarInitial(author)}
              </span>
              <span className="mn-chat__contact-name">{author}</span>
              <span className="mn-chat__contact-count">{list.length}</span>
            </div>
            {list.map((book) => (
              <button
                key={book.id}
                type="button"
                className="mn-chat__contact-book"
                onClick={() => onOpenBook?.(book)}
                title={book.title}
              >
                {book.title}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (view === 'schedule') {
    const day = 24 * 60 * 60 * 1000
    const groups: Array<{ label: string; items: BookRecord[] }> = [
      { label: '今天', items: [] },
      { label: '昨天', items: [] },
      { label: '更早', items: [] },
    ]
    const now = Date.now()
    for (const book of [...books].sort((a, b) => b.lastReadAt - a.lastReadAt)) {
      const days = Math.floor((now - book.lastReadAt) / day)
      if (days <= 0) groups[0].items.push(book)
      else if (days === 1) groups[1].items.push(book)
      else groups[2].items.push(book)
    }
    return (
      <div className="mn-chat__schedule">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.label} className="mn-chat__schedule-group">
              <div className="mn-chat__schedule-head">{group.label}</div>
              {group.items.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  className="mn-chat__schedule-row"
                  onClick={() => onOpenBook?.(book)}
                >
                  <span className="truncate">{book.title}</span>
                  <span className="mn-chat__schedule-time">
                    {formatRelativeTime(book.lastReadAt || book.addedAt)}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </div>
    )
  }

  if (view === 'drive') {
    return (
      <div className="mn-chat__drive">
        {books.map((book) => (
          <button
            key={book.id}
            type="button"
            className="mn-chat__drive-row"
            onClick={() => onOpenBook?.(book)}
            title={`${book.fileName} · ${formatChars(book.totalChars)}`}
          >
            <IconDoc className="h-4 w-4" />
            <span className="truncate">{fileNameFor('doc', book.title)}</span>
            <span className="mn-chat__drive-size">{formatChars(book.totalChars)}</span>
          </button>
        ))}
      </div>
    )
  }

  // 消息（会话列表）：和真企业微信一样排——头像、名字、标签、时间、摘要、未读角标
  return (
    <div className="mn-chat__sessions">
      {books.map((book) => {
        const unread = sessionUnread(book)
        const tag = sessionTag(book, currentBookId)
        return (
          <button
            key={book.id}
            type="button"
            className={cx('mn-chat__session', book.id === currentBookId && 'is-current')}
            onClick={() => onOpenBook?.(book)}
            title={book.title}
          >
            <span
              className="mn-chat__avatar"
              style={
                {
                  ['--mn-avatar-hue' as string]: String(avatarHue(book.author || book.title)),
                } as CSSProperties
              }
            >
              {avatarInitial(book.author || book.title)}
              {unread > 0 ? (
                <span className="mn-chat__avatar-badge" title={`还有 ${unread} 章没读`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </span>
            <span className="mn-chat__session-body">
              <span className="mn-chat__session-top">
                <span className="mn-chat__session-name truncate">{book.title}</span>
                {tag ? <span className="mn-chat__tag">{tag}</span> : null}
                <span className="mn-chat__session-time">
                  {formatRelativeTime(book.lastReadAt || book.addedAt)}
                </span>
              </span>
              <span className="mn-chat__session-preview truncate">
                {book.id === currentBookId && chapterIndex !== undefined
                  ? `第 ${chapterIndex + 1} 章 · 共 ${book.chapterCount} 章`
                  : book.state === 'ready'
                    ? `共 ${book.chapterCount} 章 · ${formatChars(book.totalChars)}`
                    : book.state === 'importing'
                      ? '正在导入…'
                      : '没能解析成功'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 企业微信首页（书架）。
 *
 * 和阅读器共用那副窗口，只是主区里没有人被选中：一句状态 + 最近几个会话，
 * 底下是真的导入按钮。不自动打开某本书——理由和编辑器形态的首页一样
 * （见 docs/SPEC.md 五 5.4 第 5 条）。
 */
export function ChatHome({
  books,
  onOpen,
  onImport,
  onOpenSettings,
  dropping,
  dim,
}: ShelfProps) {
  const [view, setView] = useState<ChatView>('msg')
  return (
    <div className={cx(dropping && 'mn-drop-active')}>
      <ChatFrame
        view={view}
        onView={setView}
        books={books}
        onImport={onImport}
        onOpenSettings={onOpenSettings}
        dim={dim}
        onOpenBook={onOpen}
        main={
          <>
            {/* 无框窗口的按钮条（桌面端非常规主题）：首页的主区没有顶栏，
                三颗窗口钮浮在右上角，上面那 40px 也兼任拖拽区（styles/chat.css） */}
            <div className="mn-chat__winctl" {...chromeDragProps()} data-mn-drag="">
              <WindowControls />
            </div>
            <div className="mn-chat__stage mn-veil">
              <div className="mn-chat__empty">
                <p className="mn-chat__empty-title">选择一个会话</p>
                <p className="mn-chat__empty-hint">
                  {books === undefined
                    ? '正在打开书架…'
                    : books.length === 0
                      ? '还没有会话'
                      : `共 ${books.length} 个会话`}
                </p>
                {books && books.length > 0 ? (
                  <div className="mn-chat__empty-recent">
                    {books.slice(0, 5).map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        className="mn-chat__empty-row"
                        onClick={() => onOpen(book)}
                      >
                        <span className="truncate">{book.title}</span>
                        <span className="mn-chat__empty-meta">
                          {formatRelativeTime(book.lastReadAt || book.addedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mn-chat__empty-actions">
                  <button type="button" className="mn-chat__empty-btn" onClick={onImport}>
                    <IconImport className="h-4 w-4" />
                    导入文件
                  </button>
                </div>
              </div>
            </div>
          </>
        }
      />
    </div>
  )
}
