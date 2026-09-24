import type { BookRecord } from '../db/db'
import type { TocRow } from '../hooks/useToc'
import type { ChatMessage } from './chat'
import { sessionUnread } from './chat'
import { readStateOf } from './appdocs'
import { bookPercent } from './progress'

/**
 * 客服工作台形态（1688 客户工作台）的数据与判断。
 *
 * 映射和别的外壳一样是「一本书 = 那个软件里的一个单位」：
 *
 *   一个买家会话 = 一本书        一条消息 = 一段正文
 *   接待 / 客户 / 客服 / 通知 / 商机  = 会话列表的五种列法
 *   客户详情 = 这本书的档案      订单追踪 = 目录（一行一章）
 *
 * 这里放的全是**纯函数 / 纯数据**：功能栏有哪几格、哪几格是真的、顶上那四个指标
 * 怎么算、右边那一列「已读 / 未读」怎么按阅读位置回执、目录里的每一行读到哪了。
 * 理由和其它外壳一样（见 docs/SPEC.md 决定记录 28）：这些事对着屏幕扫一眼看不出
 * 对错（少一格、某一格悄悄变成能点的、回执标错了一行），但它们是「这个外壳诚不诚实」
 * 的全部依据，所以拉出来交给 `bun run verify:apps` 逐条断言。
 */

/* ==========================================================================
   一、最左边那条功能栏
   ========================================================================== */

/** 会话列表的五种列法。功能栏上那五格各对应一种 */
export type DeskView = 'reception' | 'customer' | 'service' | 'notice' | 'leads'

export interface DeskRailItem {
  id: string
  label: string
  /** 有 view = 这一格真的换列表 */
  view?: DeskView
  /** 底下那几格里的动作：回工作台 / 阅读设置 */
  action?: 'home' | 'settings'
  /** 单独排在底下那三格（工作台 / 应用 / 设置） */
  bottom?: boolean
  /** 灰着的原因（进 title）。没有 view 也没有 action 的格子必须写 */
  why?: string
}

/**
 * 功能栏八格，顺序照 1688 工作台的截图：接待 / 客户 / 客服 / 通知 / 商机，
 * 底下一组是工作台 / 应用 / 设置。
 *
 * **上面五格全是真的**（换的是中间那张列表怎么列）：
 *
 *   接待  全部会话，按最近阅读排（默认那一屏）
 *   客户  按作者分组（作者的档案里挂着他的书）
 *   客服  按读到的进度分组（在读 / 未读 / 已读完）
 *   通知  还有没读完的章节的会话（角标写的就是这些章数合计）
 *   商机  还没打开过的书（新导入的排在前面）
 *
 * 底下三格里「应用」是灰的：1688 的应用中心在这个阅读器里没有对应物。
 * 有 view 的格子不需要 why，灰格子必须有 why——由 verify:apps 盯着。
 */
export const DESK_RAIL: DeskRailItem[] = [
  { id: 'reception', label: '接待', view: 'reception' },
  { id: 'customer', label: '客户', view: 'customer' },
  { id: 'service', label: '客服', view: 'service' },
  { id: 'notice', label: '通知', view: 'notice' },
  { id: 'leads', label: '商机', view: 'leads' },
  { id: 'workbench', label: '工作台', action: 'home', bottom: true },
  { id: 'apps', label: '应用', why: '这个外壳里没有应用中心', bottom: true },
  { id: 'settings', label: '设置', action: 'settings', bottom: true },
]

/* ==========================================================================
   二、顶上那四个指标
   ========================================================================== */

export interface DeskStat {
  label: string
  value: string
  title: string
}

/**
 * 顶部条中间那四格。1688 那一屏写的是「今日接待 / 已下单 / 3min响应率 / 买家满意度」，
 * 我们把同一批位置换成这个阅读器真正算得出来的四个数：
 *
 *   今日读过  今天动过的会话有几个（用的是真实的最近阅读时间）
 *   已读完    读完的会话有几个
 *   平均进度  所有会话的平均阅读进度（一位小数）
 *   本章已读  当前这一章读到哪了（一位小数，正在读的那本才算）
 *
 * `now` 是给断言留的：不算出一个固定的「今天」，头两个数就没法断言。
 * `chapterPercent` 在首页（还没有正在读的书）时传 undefined，那一格显示 `-`。
 */
export function deskStats(
  books: BookRecord[],
  chapterPercent: number | undefined,
  now: number = Date.now(),
): DeskStat[] {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const today = books.filter((book) => book.lastReadAt >= todayStart.getTime()).length
  const done = books.filter((book) => readStateOf(book) === 'done').length
  const avg =
    books.length === 0
      ? 0
      : books.reduce(
          (sum, book) =>
            sum +
            bookPercent(book, book.progress?.chapterIndex ?? 0, book.progress?.ratio ?? 0),
          0,
        ) / books.length

  return [
    {
      label: '今日读过',
      value: String(today),
      title: `今天动过 ${today} 个会话（读的是这台设备现在的日期）`,
    },
    {
      label: '已读完',
      value: String(done),
      title: `已经读完的会话有 ${done} 个`,
    },
    {
      label: '平均进度',
      value: `${(avg * 100).toFixed(1)}%`,
      title: '所有会话的平均阅读进度',
    },
    {
      label: '本章已读',
      value: chapterPercent === undefined ? '-' : (chapterPercent * 100).toFixed(1),
      title:
        chapterPercent === undefined
          ? '还没有正在读的会话'
          : `这一章读到 ${(chapterPercent * 100).toFixed(1)}%`,
    },
  ]
}

/** 功能栏「通知」那一格的角标：所有会话加起来还有多少章没读完 */
export function deskUnreadTotal(books: BookRecord[]): number {
  return books.reduce((sum, book) => sum + sessionUnread(book), 0)
}

/* ==========================================================================
   三、会话列表：五个视图 × 五个筛选
   ========================================================================== */

/** 列表上面那一排页签（1688 是「当前 / 最近 / 好友 / 团队 / 群聊」） */
export type DeskFilter = 'now' | 'recent' | 'friend' | 'team' | 'group'

export interface DeskFilterSpec {
  id: DeskFilter
  label: string
  title: string
}

/**
 * 五个筛选各自是一条真判据（1688 那五个页签在那边是「联系人 / 最近 / 好友…」，
 * 我们照它的位置摆，但每一格都换成这个书架上真的分得出来的东西）：
 *
 *   当前  不筛，按最近阅读排（默认）
 *   最近  最近 7 天动过的
 *   好友  书里写了作者的（没写作者的显示成「佚名」，那是陌生人）
 *   团队  同一个作者名下有 2 本以上的（作者名下有不止一个「人」）
 *   群聊  还有没读完的章节的
 */
export const DESK_FILTERS: ReadonlyArray<DeskFilterSpec> = [
  { id: 'now', label: '当前', title: '全部会话，最近的排在前面' },
  { id: 'recent', label: '最近', title: '最近 7 天动过的会话' },
  { id: 'friend', label: '好友', title: '书里写了作者的会话' },
  { id: 'team', label: '团队', title: '同一个作者名下有 2 本以上的' },
  { id: 'group', label: '群聊', title: '还有没读完的章节的会话' },
]

export interface DeskGroup {
  /** 分组标题（不写就是一条平铺的列表） */
  label?: string
  /** 这一组多长（分组标题右边那个数） */
  hint?: string
  books: BookRecord[]
}

const WEEK = 7 * 24 * 60 * 60 * 1000

/** 作者名。没有作者的书在这儿显示成「佚名」，不是编一个名字出来 */
export function deskAuthorOf(book: BookRecord): string {
  return book.author.trim() || '佚名'
}

function matches(book: BookRecord, needle: string): boolean {
  if (!needle) return true
  return (
    book.title.toLowerCase().includes(needle) ||
    book.author.toLowerCase().includes(needle) ||
    book.fileName.toLowerCase().includes(needle)
  )
}

function passes(book: BookRecord, filter: DeskFilter, now: number): boolean {
  switch (filter) {
    case 'recent':
      return book.lastReadAt > 0 && now - book.lastReadAt <= WEEK
    case 'friend':
      return book.author.trim().length > 0
    case 'team': {
      // 「团队」= 这个作者名下有不止一本。判断要跨整本书架，所以由 deskRows 先算好
      // （见下面的 teamAuthors），这里只是占位，永远不放行
      return false
    }
    case 'group':
      return sessionUnread(book) > 0
    default:
      return true
  }
}

/** 按最近阅读倒序（没读过的按导入时间算），同一个时间按书名兜底保持稳定 */
function byRecent(books: BookRecord[]): BookRecord[] {
  return [...books].sort(
    (a, b) =>
      (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt) ||
      a.title.localeCompare(b.title, 'zh'),
  )
}

/**
 * 当前该列哪几本书、怎么分组。
 *
 * 五个视图各是一件事（见 DESK_RAIL 的注释），筛选是它们之上的第二层。
 * 分组只在需要的视图里出现：客户按作者、客服按进度，其余三个是一条平铺的列表。
 */
export function deskRows(
  books: BookRecord[],
  view: DeskView,
  options: { filter?: DeskFilter; query?: string; now?: number } = {},
): DeskGroup[] {
  const now = options.now ?? Date.now()
  const filter = options.filter ?? 'now'
  const needle = (options.query ?? '').trim().toLowerCase()

  // 「团队」要看整个书架里每个作者有几本，所以先数一遍（筛选之前数，
  // 不然筛掉几本之后「同一个作者两本以上」会跟着变，那个筛法就不稳定了）
  const teamAuthors = new Set<string>()
  if (filter === 'team') {
    const counts = new Map<string, number>()
    for (const book of books) {
      const author = deskAuthorOf(book)
      counts.set(author, (counts.get(author) ?? 0) + 1)
    }
    for (const [author, count] of counts) if (count >= 2) teamAuthors.add(author)
  }

  const pool = books.filter(
    (book) =>
      matches(book, needle) &&
      (filter === 'team' ? teamAuthors.has(deskAuthorOf(book)) : passes(book, filter, now)),
  )

  if (view === 'customer') {
    const groups = new Map<string, BookRecord[]>()
    for (const book of pool) {
      const author = deskAuthorOf(book)
      groups.set(author, [...(groups.get(author) ?? []), book])
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'zh'))
      .map(([author, list]) => ({
        label: author,
        hint: `${list.length} 本`,
        books: byRecent(list),
      }))
  }

  if (view === 'service') {
    // 按读到的进度分三档（和「筛选」「状态标签」用的是同一个判断：readStateOf）
    const buckets: Array<{ key: 'reading' | 'todo' | 'done'; label: string }> = [
      { key: 'reading', label: '在读' },
      { key: 'todo', label: '未读' },
      { key: 'done', label: '已读完' },
    ]
    return buckets
      .map((bucket) => {
        const list = byRecent(pool.filter((book) => readStateOf(book) === bucket.key))
        return { label: bucket.label, hint: `${list.length} 本`, books: list }
      })
      .filter((group) => group.books.length > 0)
  }

  if (view === 'notice') {
    // 还有没读完的章：未读章数多的排前面（和角标里数的是同一个数）
    const list = [...pool]
      .filter((book) => sessionUnread(book) > 0)
      .sort(
        (a, b) =>
          sessionUnread(b) - sessionUnread(a) ||
          (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt),
      )
    return [{ label: '未读完的会话', hint: `${list.length} 个`, books: list }]
  }

  if (view === 'leads') {
    // 还没打开过的书：新导入的排前面
    const list = [...pool]
      .filter((book) => book.state === 'ready' && book.progress === null)
      .sort((a, b) => b.addedAt - a.addedAt)
    return [{ label: '还没打开过的', hint: `${list.length} 本`, books: list }]
  }

  return [{ books: byRecent(pool) }]
}

/**
 * 这一屏空着的时候写什么。
 *
 * 五个视图空掉的原因不一样（接待是真的没有会话，通知是都读完了，商机是都打开过了），
 * 所以不能一律写「还没有会话」——那句话在通知那一屏上是不对的。
 */
export function deskEmptyText(view: DeskView): string {
  switch (view) {
    case 'notice':
      return '都读完了'
    case 'leads':
      return '都打开过了'
    case 'service':
      return '这一档里还没有会话'
    default:
      return '还没有会话'
  }
}

/** 列表顶上那行小字：这一屏现在列的是什么 */
export function deskViewTitle(view: DeskView, filter: DeskFilter): string {
  const spec = DESK_FILTERS.find((item) => item.id === filter)
  const head: Record<DeskView, string> = {
    reception: '全部会话',
    customer: '按作者分组',
    service: '按读到的进度分组',
    notice: '还有没读完的章节',
    leads: '还没打开过的书',
  }
  return spec && filter !== 'now' ? `${head[view]} · ${spec.label}` : head[view]
}

/* ==========================================================================
   三之二、右边那块面板上的四个页签
   ========================================================================== */

export type DeskPanelTab = 'detail' | 'orders' | 'goods' | 'quote'

export interface DeskPanelTabSpec {
  id: DeskPanelTab
  label: string
  /** 这一页没有东西可列时的说法（和飞书的「与我共享」同一处理：老实说，不换个标题重复一遍） */
  why?: string
}

/**
 * 1688 右侧那四个页签，位置照搬，里面换成这本书真有的东西：
 *
 *   detail  客户详情   这本书的档案（身份 / 关系 / 阅读情况 / 章节情况 / 文件信息 / 标签 / 备注）
 *   orders  客户订单   整本书的目录，一行一章（点一下跳过去）
 *   goods   店铺商品   这个书架上的全部书（点一下换一本书）
 *   quote   物流报价   这个外壳里没有（本地文件没有运费可报），老实说一句
 */
export const DESK_PANEL_TABS: ReadonlyArray<DeskPanelTabSpec> = [
  { id: 'detail', label: '客户详情' },
  { id: 'orders', label: '客户订单' },
  { id: 'goods', label: '店铺商品' },
  {
    id: 'quote',
    label: '物流报价',
    why: '这个外壳里没有物流报价（本地的书没有运费可报）',
  },
]

/* ==========================================================================
   四、右边那一列「已读 / 未读」
   ========================================================================== */

export interface DeskReceipt {
  /** 这一条在读者已经读到的地方之前（那几条就是「已读」） */
  read: boolean
  /** 读者此刻停在这一条上（那一条上写真实的最近阅读时间） */
  at: boolean
}

/**
 * 一条消息读没读过，**按阅读位置算**。
 *
 * 1688 里右侧每条消息底下写着「已读 / 未读」，那是对方读没读。我们这儿只有一个
 * 读者，所以这一列回执说的是**你自己读到哪了**：一条消息的结尾落在当前进度之前
 * = 已读，之后 = 未读。这样「未读」是真的未读，不是编出来的状态——翻到章末再回来看，
 * 整列就都变成「已读」了。
 *
 * 字数是按块算的（`chapterMessages` 给的那份），跨消息累加，
 * 所以双语书里原文那几条（排在右边）也算在进度里。
 */
export function deskReceipts(messages: ChatMessage[], chapterPercent: number): DeskReceipt[] {
  const total = messages.reduce((sum, message) => sum + message.chars, 0)
  if (total <= 0) return messages.map(() => ({ read: false, at: false }))
  let acc = 0
  let atIndex = -1
  const receipts = messages.map((message, index) => {
    acc += message.chars
    const read = acc / total <= chapterPercent + 1e-9
    if (!read && atIndex < 0) atIndex = index
    return { read, at: false }
  })
  // 停在一条上：读者正读到的那一条（第一条还没读完的）。
  // 整章都读完时停在最后一条上——那一刻读者确实在章末，不在别处。
  if (atIndex < 0) atIndex = messages.length - 1
  if (atIndex >= 0) receipts[atIndex] = { read: receipts[atIndex].read, at: true }
  return receipts
}

/* ==========================================================================
   五、目录：一行一章（右侧「订单追踪 / 客户订单」）
   ========================================================================== */

export type DeskChapterState = 'read' | 'reading' | 'unread'

export interface DeskChapterRow {
  index: number
  label: string
  chars?: number
  state: DeskChapterState
  /** 这一章读了多少（0-1）。没读到的那几章没有值 */
  percent?: number
}

/**
 * 目录里那一行。
 *
 * 一行一章，读没读过按**书里的进度**判（当前章之前 = 已读完、当前章 = 在读、
 * 之后 = 未读），章名取目录里的标题，字数是目录表里那个真值。
 * 这在 1688 那边是「订单追踪」的一行（编号 + 商品 + 金额），在这儿就是一章的
 * 序号 + 章名 + 字数——位置一样，里面的数全是真的。
 */
export function deskChapterRows(
  chapters: TocRow[] | undefined,
  progress: { chapterIndex: number; ratio: number } | null,
  chapterCount: number,
): DeskChapterRow[] {
  const current = progress?.chapterIndex ?? 0
  const ratio = progress?.ratio ?? 0
  const rows: DeskChapterRow[] = (chapters ?? [])
    .filter((row) => row.type === 'chapter')
    .map((row) => {
      const state: DeskChapterState =
        row.index < current ? 'read' : row.index === current ? 'reading' : 'unread'
      return {
        index: row.index,
        label: row.label,
        chars: row.charCount,
        state,
        percent: state === 'read' ? 1 : state === 'reading' ? ratio : undefined,
      }
    })
  if (rows.length > 0) return rows
  // 目录还没读出来（刚进书那一拍）：至少把章数用上，别摆一片空白
  return Array.from({ length: chapterCount }, (_, index) => ({
    index,
    label: `第 ${index + 1} 章`,
    state: index < current ? 'read' : index === current ? 'reading' : 'unread',
    percent: index < current ? 1 : index === current ? ratio : undefined,
  }))
}

/** 这一行现在是什么状态（右侧「订单追踪」那一列的字） */
export function deskChapterStateText(state: DeskChapterState): string {
  return state === 'read' ? '已读完' : state === 'reading' ? '在读' : '未读'
}

/** 一行右边那个「实付」位置上的字：读到多少 / 还没读 */
export function deskChapterPayText(row: DeskChapterRow): string {
  return row.percent === undefined ? '未读' : `已读 ${Math.round(row.percent * 100)}%`
}

/** 章节汇总：读完几章、总共几章（右侧档案里「章节情况」那一行） */
export function deskChapterSummary(rows: DeskChapterRow[]): {
  done: number
  total: number
  avg: number
  longest: number
  shortest: number
} {
  const withChars = rows.filter((row) => typeof row.chars === 'number' && row.chars > 0)
  const total = rows.length
  const done = rows.filter((row) => row.state === 'read').length
  if (withChars.length === 0) return { done, total, avg: 0, longest: 0, shortest: 0 }
  const chars = withChars.map((row) => row.chars as number)
  const sum = chars.reduce((acc, value) => acc + value, 0)
  return {
    done,
    total,
    avg: Math.round(sum / chars.length),
    longest: Math.max(...chars),
    shortest: Math.min(...chars),
  }
}

/* ==========================================================================
   六、几处文案与时间（都在下面这几支里，组件不再自己拼）
   ========================================================================== */

/** 会话列表右边那个时间：今天写时刻、昨天写「昨天」、今年写月日、跨年带年份 */
export function deskListTime(timestamp: number, now: number = Date.now()): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (value: number) => value.toString().padStart(2, '0')
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((dayStart(new Date(now)) - dayStart(date)) / 86_400_000)
  if (days <= 0) return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (days === 1) return '昨天'
  if (date.getFullYear() === new Date(now).getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** 消息行上那一行小字的时间（1688 写的是 `2026-9-23 19:02:09`，我们也带秒） */
export function deskStampText(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`
}

/** 消息行上「店名 : 客服」那一半。我们写的是这本书的来源：书名 : 作者 */
export function deskPeerText(title: string, author: string): string {
  return `${title}:${author.trim() || '我'}`
}

/**
 * 「未读天数 N 天」——上次阅读到现在隔了几天。
 *
 * 没读过的书不写这个数（那时候该说的是「还没开始读」），所以返回 undefined。
 */
export function deskIdleDays(book: BookRecord, now: number = Date.now()): number | undefined {
  if (!book.lastReadAt) return undefined
  return Math.max(0, Math.floor((now - book.lastReadAt) / 86_400_000))
}

/** 读到的位置：右侧档案里那一行「全书 X%」 */
export function deskPercentText(book: BookRecord): string {
  const percent = bookPercent(
    book,
    book.progress?.chapterIndex ?? 0,
    book.progress?.ratio ?? 0,
  )
  return `${(percent * 100).toFixed(1)}%`
}
