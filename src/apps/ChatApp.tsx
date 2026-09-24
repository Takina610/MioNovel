import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { BookRecord } from '../db/db'
import { avatarHue, avatarInitial, chatSender } from '../lib/chat'
import { fileNameFor } from '../lib/appdocs'
import { formatChars, formatPercent, formatRelativeTime } from '../lib/format'
import { cx } from '../lib/cx'
import {
  IconChevron,
  IconImport,
  IconMore,
  IconSearch,
  IconSliders,
} from '../components/ui/icons'
import {
  IconCalendar,
  IconChatBubble,
  IconCloud,
  IconContacts,
  IconDoc,
  IconFullscreen,
  IconPhone,
  IconVideo,
} from '../components/ui/app-icons'
import { useHotkeyCombo } from '../store/hotkeys'
import { toggleFullscreen } from '../lib/fullscreen'
import { AppMenu, NavRow } from './OfficeFrame'
import type { AppFrameProps } from './types'
import type { ShelfProps } from './ShelfShell'

/** 功能栏上的四个视图。每一个都是真的：换的是左边那一栏列什么 */
type RailView = 'msg' | 'contacts' | 'schedule' | 'drive'

const RAIL: Array<{ id: RailView; label: string; icon: ReactNode }> = [
  { id: 'msg', label: '消息', icon: <IconChatBubble className="h-5 w-5" /> },
  { id: 'contacts', label: '通讯录', icon: <IconContacts className="h-5 w-5" /> },
  { id: 'schedule', label: '日程', icon: <IconCalendar className="h-5 w-5" /> },
  { id: 'drive', label: '微盘', icon: <IconCloud className="h-5 w-5" /> },
]

/**
 * 企业微信形态。
 *
 * 一本书 = 一个会话，一段正文 = 一条消息（见 lib/chat.ts）。界面照企业微信桌面版来：
 * 最左边一条深灰功能栏（消息 / 通讯录 / 日程 / 微盘 + 设置），中间会话列表，
 * 右边是会话（书名 + 章节 + 消息流 + 输入区）。
 *
 * 三处刻意的取舍：
 *
 * 1. **功能栏那四个视图全是真的**：消息 = 按最近阅读排的会话，通讯录 = 按作者归的
 *    联系人，日程 = 按最后阅读日期分组，微盘 = 按文件列。点了真的换列表内容，
 *    不摆四个点了没反应的图标（见决定记录 27）。
 * 2. **输入区里没有假输入框**。真聊天的输入框能打字，我们的不能——所以那个位置放的
 *    是**这一章的位置**：一条能拖的进度条（长得像输入框），下面一排真的按钮
 *    （导入 / 聊天记录 / 上一章 / 下一章 / 阅读设置），右下角的「发送」位置是
 *    「下一章」——按下去真的翻章。
 * 3. **不编发信人和时间**。发信人是书里的作者（没有就写「书友」），头像色相由名字
 *    哈希出来；时间用的是真的「最近阅读」时间，不编「14:23」。
 */
export function ChatApp(props: AppFrameProps) {
  const { book } = props
  const [recordsOpen, setRecordsOpen] = useState(() => window.innerWidth >= 1024)
  const [view, setView] = useState<RailView>('msg')
  const settingsHotkey = useHotkeyCombo('settings')
  const fullscreenHotkey = useHotkeyCombo('fullscreen')
  const dimHotkey = useHotkeyCombo('dim')

  const sender = chatSender(book.author)
  const hue = avatarHue(sender)

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
      dimOn={props.dimOn}
      onToggleDim={props.onToggleDim}
      onBack={props.onBack}
      main={
        <>
          <header className="mn-chat__head">
            <div className="mn-chat__peer">
              <span className="mn-chat__peer-name" title={book.title}>
                {book.title}
              </span>
              <span className="mn-chat__peer-sub">
                第 {props.chapterIndex + 1}/{props.chapterCount} 章
              </span>
            </div>
            <div className="mn-chat__head-actions">
              <button type="button" className="mn-chat__icon-btn" title="通话（这个外壳里没有）" disabled>
                <IconPhone className="h-4 w-4" />
              </button>
              <button type="button" className="mn-chat__icon-btn" title="视频（这个外壳里没有）" disabled>
                <IconVideo className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cx('mn-chat__icon-btn', recordsOpen && 'is-active')}
                title="聊天记录（= 目录）"
                aria-pressed={recordsOpen}
                onClick={() => setRecordsOpen((open) => !open)}
              >
                <IconChatBubble className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="mn-chat__icon-btn"
                title="阅读设置"
                onClick={props.onOpenSettings}
              >
                <IconSliders className="h-4 w-4" />
              </button>
              <AppMenu
                items={[
                  { label: '阅读设置（主题也在这里）', hint: settingsHotkey, onSelect: props.onOpenSettings },
                  {
                    label: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）',
                    hint: dimHotkey,
                    onSelect: props.onToggleDim,
                  },
                  {
                    label: '全屏',
                    hint: fullscreenHotkey,
                    onSelect: toggleFullscreen,
                  },
                  { label: '回到会话列表', separatorBefore: true, onSelect: props.onBack },
                ]}
              />
            </div>
          </header>

          <div className="mn-chat__stage">
            <div className="mn-chat__scroll mn-veil" style={{ ['--mn-avatar-hue' as string]: String(hue) }}>
              {props.children}
            </div>
            {recordsOpen ? (
              <aside className="mn-chat__records" aria-label="聊天记录">
                <div className="mn-chat__records-head">
                  <span>聊天记录</span>
                  <span className="mn-chat__records-count">{props.chapterCount} 章</span>
                </div>
                <div className="mn-chat__records-list">
                  {props.chapters === undefined ? (
                    <p className="mn-office__side-hint">正在读目录…</p>
                  ) : (
                    props.chapters.map((row) =>
                      row.type === 'group' ? (
                        <div key={`g-${row.index}-${row.label}`} className="mn-nav-group">
                          {row.label}
                        </div>
                      ) : (
                        <NavRow
                          key={row.index}
                          label={row.label}
                          active={row.index === props.chapterIndex}
                          onClick={() => props.onChapter(row.index)}
                        />
                      ),
                    )
                  )}
                </div>
                <div className="mn-chat__records-foot">
                  <div className="mn-doc__progress" aria-hidden>
                    <span style={{ width: `${Math.max(0, Math.min(1, props.percent)) * 100}%` }} />
                  </div>
                  <div className="mn-chat__records-text">
                    <span>本章 {formatChars(props.chapterChars ?? 0)}</span>
                    <span>已读 {formatPercent(props.percent)}</span>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>

          <footer className="mn-chat__compose">
            <div className="mn-chat__box">
              <span className="mn-chat__box-text">
                {props.chapterTitle || `第 ${props.chapterIndex + 1} 章`}
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
            <div className="mn-chat__compose-foot">
              <div className="mn-chat__tools">
                <button type="button" className="mn-chat__tool" title="导入文件" onClick={props.onImport}>
                  <IconImport className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="mn-chat__tool"
                  title="上一章"
                  disabled={props.chapterIndex <= 0}
                  onClick={() => props.onChapter(props.chapterIndex - 1)}
                >
                  <IconChevron className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  className="mn-chat__tool"
                  title="下一章"
                  disabled={props.chapterIndex >= props.chapterCount - 1}
                  onClick={() => props.onChapter(props.chapterIndex + 1)}
                >
                  <IconChevron className="h-4 w-4" />
                </button>
                <button type="button" className="mn-chat__tool" title="回到会话列表" onClick={props.onBack}>
                  <IconChatBubble className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className="mn-chat__send"
                disabled={props.chapterIndex >= props.chapterCount - 1}
                title="下一章（这里是「发送」的位置）"
                onClick={() => props.onChapter(props.chapterIndex + 1)}
              >
                下一章
              </button>
            </div>
          </footer>
        </>
      }
    />
  )
}

/**
 * 会话窗口的框：功能栏 + 列表 + 主区。
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
  dimOn,
  onToggleDim,
  onBack,
  main,
}: {
  view: RailView
  onView: (view: RailView) => void
  books?: BookRecord[]
  currentBookId?: string
  chapterIndex?: number
  onOpenBook?: (book: BookRecord) => void
  onImport?: () => void
  onOpenSettings: () => void
  dim: number
  dimOn: boolean
  onToggleDim: () => void
  onBack?: () => void
  main: ReactNode
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const list = useMemo(() => {
    const all = books ?? []
    if (!needle) return all
    return all.filter(
      (book) =>
        book.title.toLowerCase().includes(needle) || book.author.toLowerCase().includes(needle),
    )
  }, [books, needle])

  /**
   * 窄屏上会话列表是浮层：390px 的宽度里，功能栏 46 + 列表 200 只剩 144 给消息，
   * 那不是聊天窗口，是一条竖着的缝。和编辑器形态的侧栏同一个做法：
   * 窄屏收起来、按钮切换，宽屏一直是常驻的一列。
   */
  const [narrowList, setNarrowList] = useState(false)

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
        {RAIL.map((item) => (
          <button
            key={item.id}
            type="button"
            className="mn-chat__rail-btn"
            title={item.label}
            aria-label={item.label}
            aria-pressed={view === item.id}
            onClick={() => onView(item.id)}
          >
            {item.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          className={cx('mn-chat__rail-btn', dimOn && 'is-active')}
          title={dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）'}
          aria-pressed={dimOn}
          onClick={onToggleDim}
        >
          <span className="mn-chat__rail-glyph">◐</span>
        </button>
        <button
          type="button"
          className="mn-chat__rail-btn"
          title="全屏"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen()
            else void document.documentElement.requestFullscreen()
          }}
        >
          <IconFullscreen className="h-5 w-5" />
        </button>
        <button type="button" className="mn-chat__rail-btn" title="阅读设置" onClick={onOpenSettings}>
          <IconSliders className="h-5 w-5" />
        </button>
      </nav>

      <aside className="mn-chat__list" aria-label={RAIL.find((item) => item.id === view)?.label}>
        <label className="mn-chat__search">
          <IconSearch className="h-3.5 w-3.5" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view === 'contacts' ? '搜索联系人' : '搜索'}
            aria-label="搜索"
          />
        </label>
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
        <div className="mn-chat__list-foot">
          <button type="button" className="mn-chat__list-btn" onClick={onImport}>
            <IconImport className="h-4 w-4" />
            导入文件
          </button>
          {onBack ? (
            <button
              type="button"
              className="mn-chat__list-btn"
              onClick={() => {
                setNarrowList(false)
                onBack()
              }}
            >
              <IconChatBubble className="h-4 w-4" />
              回书架
            </button>
          ) : null}
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
  view: RailView
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

  // 消息（会话列表）：和微信一样排——头像、名字、最后一条的摘要、时间、未读数
  return (
    <div className="mn-chat__sessions">
      {books.map((book) => {
        const read = book.progress ? book.progress.chapterIndex + 1 : 0
        const unread = Math.max(0, book.chapterCount - read)
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
            </span>
            <span className="mn-chat__session-body">
              <span className="mn-chat__session-top">
                <span className="mn-chat__session-name truncate">{book.title}</span>
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
            {unread > 0 && book.state === 'ready' ? (
              <span className="mn-chat__badge" title={`还有 ${unread} 章没读`}>
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 企业微信首页（书架）。
 *
 * 和阅读器共用那副窗口，只是主区里没有人被选中：一条灰底上的「选择一个会话」，
 * 底下写清怎么把书弄进来。不自动打开某本书——理由和编辑器形态的首页一样
 * （见 docs/SPEC.md 五 5.4 第 5 条）。
 */
export function ChatHome({ books, onOpen, onMenu, onImport, onOpenSettings, dropping, dim, dimOn, onToggleDim }: ShelfProps) {
  const [view, setView] = useState<RailView>('msg')
  return (
    <div className={cx(dropping && 'mn-drop-active')}>
      <ChatFrame
        view={view}
        onView={setView}
        books={books}
        onImport={onImport}
        onOpenSettings={onOpenSettings}
        dim={dim}
        dimOn={dimOn}
        onToggleDim={onToggleDim}
        onOpenBook={onOpen}
        main={
          <div className="mn-chat__stage mn-veil">
            <div className="mn-chat__empty">
              <p className="mn-chat__empty-title">选择一个会话</p>
              <p className="mn-chat__empty-hint">
                {books === undefined
                  ? '正在打开书架…'
                  : books.length === 0
                    ? '还没有会话'
                    : '左边是全部会话（= 全部书）。点一个就开始读。'}
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
                {books && books.length > 0 ? (
                  <button
                    type="button"
                    className="mn-chat__empty-btn"
                    onClick={() => onMenu(books[0])}
                  >
                    <IconMore className="h-4 w-4" />
                    第一本的解析设置
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
