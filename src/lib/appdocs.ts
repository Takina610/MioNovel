import type { BookRecord } from '../db/db'
import type { ThemeChrome } from '../themes/types'
import { formatChars, formatBytes, formatDateTime } from './format'
import { bookPercent } from './progress'

/**
 * 办公外壳的「文件」。
 *
 * 五个形态里，四个软件都有自己的文件单位，而我们的书只有书名和章节。
 * 映射是固定的、每个形态一份：
 *
 *   doc    一篇云文档 = 一本书，文档里的大标题 = 章（大纲里逐个列出来）
 *   chat   一个会话 = 一本书，聊天记录 = 章
 *   page   一个文档  = 一本书（书名.docx），页 = 章
 *   sheet  一个工作簿 = 一本书（书名.xlsx），工作表 = 章
 *   slide  一个演示文稿 = 一本书（书名.pptx），节 = 章
 *
 * 文件名、工作表名这些**不是随便截一下**：它们会出现在标题栏、标签和状态栏上，
 * 各自有各自的长度与字符限制（Excel 的工作表名连冒号都不许有）。
 */

export type OfficeChrome = 'doc' | 'chat' | 'page' | 'sheet' | 'slide'

/** 文件名/工作表名里不能出现的字符（Windows 与 Excel 的限制取并集） */
const UNSAFE_NAME = /[\\/:*?"<>|\n\r\t[\]]/g

export function safeName(title: string, fallback: string): string {
  const cleaned = title.replace(UNSAFE_NAME, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || fallback
}

/** 书名 → 文件名。Office 那三套带自己的后缀 */
export function fileNameFor(chrome: OfficeChrome, bookTitle: string): string {
  const base = safeName(bookTitle, '未命名')
  switch (chrome) {
    case 'page':
      return `${base}.docx`
    case 'sheet':
      return `${base}.xlsx`
    case 'slide':
      return `${base}.pptx`
    default:
      return base
  }
}

/** 扩展名（列表里单独一列显示用）。没有后缀的形态给个说法 */
export function fileKindLabel(chrome: OfficeChrome): string {
  switch (chrome) {
    case 'page':
      return 'Word 文档'
    case 'sheet':
      return 'Excel 工作簿'
    case 'slide':
      return 'PowerPoint 演示文稿'
    case 'doc':
      return '云文档'
    default:
      return '会话'
  }
}

/** 应用名。标题栏、开始屏幕、状态栏都要用同一个 */
export function appName(chrome: OfficeChrome): string {
  switch (chrome) {
    case 'page':
      return 'Word'
    case 'sheet':
      return 'Excel'
    case 'slide':
      return 'PowerPoint'
    case 'doc':
      return '飞书文档'
    default:
      return '企业微信'
  }
}

/**
 * 章标题 → Excel 工作表名。
 * Excel 的硬限制：不超过 31 个字符，且不能含 : \ / ? * [ ]（UNSAFE_NAME 已经挡掉）。
 * 截断时留一个省略号，好让人看出这名字被截过。
 */
export function sheetNameOf(title: string, index: number): string {
  const base = safeName(title, `第 ${index + 1} 章`)
  return base.length > 31 ? `${base.slice(0, 30)}…` : base
}

/** 章标题 → 节名（PPT）。节名没有长度硬限制，但太长在缩略图栏里看不清 */
export function sectionNameOf(title: string, index: number): string {
  const base = safeName(title, `第 ${index + 1} 章`)
  return base.length > 40 ? `${base.slice(0, 39)}…` : base
}

/** 章标题 → 幻灯片上的标题（文档形态的 H1、Word 的标题也用同一份截断规则） */
export function headingOf(title: string, index: number): string {
  const base = safeName(title, `第 ${index + 1} 章`)
  return base.length > 60 ? `${base.slice(0, 59)}…` : base
}

/** 章节标题取不到时（目录还没读出来）的兜底名字 */
export function chapterLabel(title: string | undefined, index: number): string {
  return title && title.trim() ? title.trim() : `第 ${index + 1} 章`
}

/**
 * 标题栏上那个头像里的字。
 * 用的是书里的作者名（真数据）——没有作者就写「我」，
 * 不编一个名字出来（那样每次换书都会冒出一个假同事）。
 */
export function avatarOf(author: string): string {
  const name = author.trim()
  if (!name) return '我'
  return /^[\x00-\x7F]/.test(name) ? name[0].toUpperCase() : name[0]
}

/** 字数、大小、时间：开始屏幕那一列列的东西，全都是真数据 */
export function sizeText(bytes: number): string {
  return formatBytes(bytes)
}

export function countText(chars: number): string {
  return formatChars(chars)
}

export function dateText(timestamp: number): string {
  return formatDateTime(timestamp)
}

/** 这个形态的文件单位叫什么（用于「最近 3 个」这类文案） */
export function unitLabel(chrome: ThemeChrome, count: number): string {
  const names: Partial<Record<ThemeChrome, string>> = {
    page: '个文档',
    sheet: '个工作簿',
    slide: '个演示文稿',
    doc: '篇文档',
    chat: '个会话',
  }
  return `${count} ${names[chrome] ?? '本'}`
}

/* ==========================================================================
   云文档首页（飞书形态的书架）
   --------------------------------------------------------------------------
   首页上那一条页签、一个筛选、一列排序箭头，落到数据上其实只有一件事：
   「把哪几本书、按什么顺序摆出来」。这些判断不看屏幕是发现不了的（排错了、
   筛丢了，眼睛扫一遍列表未必看得出来），所以按老规矩拉成纯函数，交给
   `bun run verify:apps` 逐条断言——组件那边只负责画。
   ========================================================================== */

/** 首页上的四个页签 */
export type DocTab = 'recent' | 'mine' | 'shared' | 'starred'

/** 「筛选」里那几档：按读到哪儿分 */
export type DocFilter = 'all' | 'reading' | 'todo' | 'done'

/** 表头上那个箭头排的是哪一列 */
export type DocSortKey = 'recent' | 'created'

export const DOC_TABS: ReadonlyArray<{ id: DocTab; label: string }> = [
  { id: 'recent', label: '最近访问' },
  { id: 'mine', label: '归我所有' },
  { id: 'shared', label: '与我共享' },
  { id: 'starred', label: '收藏' },
]

export const DOC_FILTERS: ReadonlyArray<{ id: DocFilter; label: string }> = [
  { id: 'all', label: '全部文档' },
  { id: 'reading', label: '在读' },
  { id: 'todo', label: '未读' },
  { id: 'done', label: '已读完' },
]

/**
 * 这本书读到哪儿了。三个档次对应「筛选」里那三项。
 *
 * 「读完」按全书百分比算（和阅读器、状态栏同一个数），不按章节序号——
 * 最后一章只读了一半的书不该出现在「已读完」里。没有进度的书是「未读」，
 * 进度恰好为 0 的也算未读（打开过但停在第一行，和没打开过是一回事）。
 */
export function readStateOf(book: BookRecord): 'reading' | 'todo' | 'done' {
  if (!book.progress) return 'todo'
  const percent = bookPercent(book, book.progress.chapterIndex, book.progress.ratio)
  if (percent >= 1) return 'done'
  return percent > 0 ? 'reading' : 'todo'
}

/** 两位数补零，时间里的时和分要用 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

/** 那一天零点的时间戳，用来算「隔了几天」 */
function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * 列表里那一列时间。今天的写「今天 09:09」、昨天的写「昨天 21:40」、
 * 今年的写「4月15日 09:07」、跨年的补上年份——飞书那一列就是这么写的。
 *
 * `now` 是给验收脚本留的：不算出一个固定的「今天」，这条规则就没法断言。
 * 不传就是此刻。
 */
export function docTimeText(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp)
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  const days = Math.round((dayStart(new Date(now)) - dayStart(date)) / 86_400_000)
  if (days <= 0) return `今天 ${clock}`
  if (days === 1) return `昨天 ${clock}`
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return sameYear ? `${monthDay} ${clock}` : `${date.getFullYear()}年${monthDay} ${clock}`
}

/** 列表里「位置」那一列。我们只有一个空间，所有人的文档都在这里 */
export const DOC_LOCATION = '我的空间'

/** 列表里「所有者」那一列。书里的作者名是真数据，没有就写「我」 */
export function docOwnerOf(book: BookRecord): string {
  return book.author.trim() || '我'
}

/**
 * 首页当前该显示哪几行、按什么顺序。
 *
 * 四个页签里只有两个有对应的数据源：**最近访问**（按最近阅读）和
 * **归我所有**（按加入时间）。另外两个在这个应用里没有东西可列——
 * 本地文件不上传，「与我共享」里永远是空的；收藏更是一个我们没有的功能。
 * 所以它们**老实返回空数组**，由外壳写一句说明，而不是把同一批书
 * 换个标题再列一遍。
 */
export function homeRows(
  books: BookRecord[],
  view: { tab: DocTab; filter: DocFilter; sortKey: DocSortKey; direction: 'asc' | 'desc' },
): BookRecord[] {
  if (view.tab === 'shared' || view.tab === 'starred') return []
  const rows = books.filter((book) => view.filter === 'all' || readStateOf(book) === view.filter)
  const key = (book: BookRecord): number =>
    view.sortKey === 'created' ? book.addedAt : book.lastReadAt || book.addedAt
  const sign = view.direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => sign * (key(a) - key(b)) || a.title.localeCompare(b.title, 'zh'))
}

/**
 * 「置顶文档」那一行：最近读的那本。
 *
 * 真飞书的置顶是用户自己钉的，我们没有钉这个动作——但「最近在读的那本」
 * 是这个位置唯一说得通的真数据（它就在列表最上面）。一本书都没有时返回
 * undefined，外壳那边不摆这一行。
 */
export function pinnedBook(books: BookRecord[]): BookRecord | undefined {
  return books.reduce<BookRecord | undefined>(
    (best, book) => (!best || book.lastReadAt > best.lastReadAt ? book : best),
    undefined,
  )
}
