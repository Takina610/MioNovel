import Dexie, { type Table } from 'dexie'
import type { BookFormat, TocGroup } from '../parsers/types'

/** 章内进度。滚动模式 = 滚动比例，翻页模式 = 页数比例。
 *  两种模式存的是同一个量，所以切换阅读模式不用迁移数据。 */
export interface ReadingProgress {
  chapterIndex: number
  /** 0-1 */
  ratio: number
  updatedAt: number
}

/** importing 是导入进行中的占位：书架立刻出现卡片并显示进度，
 *  解析失败就转 error（可以重试，原始文件还在 files 表里）。
 *  浏览器崩溃留下的 importing 记录由 cleanupStaleImports() 收尾。 */
export type BookState = 'importing' | 'ready' | 'error'

export interface BookRecord {
  id: string
  state: BookState
  error?: string
  title: string
  author: string
  format: BookFormat
  /** 封面缩略图（≤400px 宽）。没有就由书名生成渐变卡，不存图 */
  cover?: Blob
  addedAt: number
  lastReadAt: number
  totalChars: number
  chapterCount: number
  /** 每章起始位置的非空白字符数前缀和。有它，全书百分比是 O(1) */
  charOffsets: number[]
  /** 卷/部这类「不是章节」的目录分组节点 */
  groups: TocGroup[]
  progress: ReadingProgress | null
  fileName: string
  fileSize: number
  /** name + size + lastModified，用来判断是不是同一本书 */
  signature: string
  /** TXT：解析时用的编码标签 */
  charset?: string
  /** TXT：分章规则（预设 id 或自定义正则）。改完可以原地重新解析，不用重新导入 */
  txtRule?: string
  language?: string
  publisher?: string
  identifier?: string
  /** 给用户看的解析说明 */
  note?: string
}

/** 原始文件，原样存。**单独一张表**：书架列表只读 books，
 *  不会顺手把几十 MB 的书文件反序列化出来。 */
export interface FileRecord {
  bookId: string
  blob: Blob
}

export interface ChapterRecord {
  bookId: string
  index: number
  title: string
  html: string
  charCount: number
  /** 目录层级，抽屉按它缩进 */
  depth: number
}

/**
 * 目录条目的轻量副本：只有标题、层级、字数，没有正文。
 *
 * 为什么要单独一张表，而不是直接读 chapters：目录抽屉需要**全部**章节的标题，
 * 而 chapters 每行都带着那一章的完整 HTML。一本 3000 章的书整表读出来是十几 MB，
 * 只为了拿 3000 个标题。这张表把那份代价压到几百 KB。
 */
export interface TocEntryRecord {
  bookId: string
  index: number
  title: string
  depth: number
  charCount: number
}

/** EPUB 里抽出来的图片等资源。章节 HTML 里是 mnres://<path>，
 *  渲染当前章时才取出来换成 ObjectURL，离开就 revoke——
 *  内存占用只跟当前章有关，跟书有多大无关。 */
export interface ResourceRecord {
  bookId: string
  path: string
  blob: Blob
  type: string
}

export interface BookmarkRecord {
  id?: number
  bookId: string
  chapterIndex: number
  ratio: number
  label: string
  createdAt: number
}

class MioNovelDB extends Dexie {
  books!: Table<BookRecord, string>
  files!: Table<FileRecord, string>
  chapters!: Table<ChapterRecord, [string, number]>
  toc!: Table<TocEntryRecord, [string, number]>
  resources!: Table<ResourceRecord, [string, string]>
  bookmarks!: Table<BookmarkRecord, number>

  constructor() {
    super('mionovel')
    this.version(1).stores({
      // 索引留给「查询和排序真的会用到的字段」。书架本来就整表读，
      // 给 title/author 建索引既救不了子串搜索（那得全文索引），还多一份写入成本。
      books: 'id, state, format, addedAt, lastReadAt, signature',
      files: 'bookId',
      chapters: '[bookId+index], bookId',
      toc: '[bookId+index], bookId',
      resources: '[bookId+path], bookId',
      bookmarks: '++id, bookId, [bookId+chapterIndex]',
    })
  }
}

export const db = new MioNovelDB()
