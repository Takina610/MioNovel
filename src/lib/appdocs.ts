import type { ThemeChrome } from '../themes/types'
import { formatChars, formatBytes, formatDateTime } from './format'

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
