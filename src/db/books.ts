import { detectFormat, loadParser, readHead } from '../parsers/registry'
import type {
  BookParser,
  ChapterResource,
  ParseOptions,
  ParseSink,
  ParsedChapter,
} from '../parsers/types'
import { db, type BookRecord, type ChapterRecord, type ReadingProgress, type TocEntryRecord } from './db'
/** 章节批量写入的批大小。50 章一批既让进度更新得够勤，又不会把小书拆成几十次事务 */
const CHAPTER_BATCH = 50

/** 图片同理。EPUB 里的插图通常不多，20 张一批足够 */
const RESOURCE_BATCH = 20

export interface ImportProgress {
  ratio: number
  note?: string
}

export type ImportReporter = (progress: ImportProgress) => void

/** 同一份文件重复导入时抛这个，让调用方把「已经有了」和「导入失败」分开提示 */
export class DuplicateBookError extends Error {
  constructor(public existing: BookRecord) {
    super(`《${existing.title}》已经在书架上了`)
    this.name = 'DuplicateBookError'
  }
}

/** 生成书 id。调用方先拿到 id 再导入，这样书架能立刻显示这张卡片的进度 */
export function newBookId(): string {
  // 客户端生成 id：章节要在 books 记录落定之后就把 bookId 用上，
  // 而且导入失败时我们要能干净地清掉半成品，不能依赖自增主键
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function signatureOf(file: File): Promise<string> {
  return `${file.name}|${file.size}|${file.lastModified}`
}

/** 正在导入中的书 id。用来区别「浏览器上次崩溃留下的」和「这次正在跑的」 */
const inFlight = new Set<string>()

export function isImporting(bookId: string): boolean {
  return inFlight.has(bookId)
}

/** ParseSink 加上一个收尾方法。写在接口外，免得让解析器知道存储层的事 */
interface ImportSink extends ParseSink {
  flush: () => Promise<void>
}

function makeSink(bookId: string, report: ImportReporter): ImportSink {
  let chapters: ChapterRecord[] = []
  let tocEntries: TocEntryRecord[] = []
  let resources: ChapterResource[] = []

  const flush = async () => {
    if (chapters.length > 0) {
      const batch = chapters
      chapters = []
      await db.chapters.bulkAdd(batch)
    }
    if (tocEntries.length > 0) {
      const batch = tocEntries
      tocEntries = []
      await db.toc.bulkAdd(batch)
    }
    if (resources.length > 0) {
      const batch = resources
      resources = []
      await db.resources.bulkPut(
        batch.map((item) => ({
          bookId,
          path: item.path,
          blob: item.blob,
          type: item.type,
        })),
      )
    }
  }

  return {
    // 解析占进度的 0-95%，收尾留 5%
    onProgress: (ratio, note) => report({ ratio: ratio * 0.95, note }),
    onChapter: async (chapter: ParsedChapter) => {
      chapters.push({
        bookId,
        index: chapter.index,
        title: chapter.title,
        html: chapter.html,
        charCount: chapter.charCount,
        depth: chapter.depth,
      })
      // 目录条目一起写：抽屉只读这张轻量表，不碰章节正文
      tocEntries.push({
        bookId,
        index: chapter.index,
        title: chapter.title,
        depth: chapter.depth,
        charCount: chapter.charCount,
      })
      if (chapters.length >= CHAPTER_BATCH) await flush()
    },
    onResource: async (resource: ChapterResource) => {
      resources.push(resource)
      if (resources.length >= RESOURCE_BATCH) await flush()
    },
    flush,
  }
}

/**
 * 导入一个文件。流程刻意做成「先落盘、再解析」：
 * 中途失败或崩溃都不会丢原始文件，用户可以重试或重新解析，不用再拖一次文件。
 *
 * 没有导入前的确认弹窗：识别结果（编码、分章规则）会写进书里，
 * 书架上直接显示解析后的样子，觉得不对就在「解析设置」里改，改完原地重新解析——
 * 比让用户在没看到结果之前先确认编码要合理。
 */
export async function importFile(
  file: File,
  bookId: string,
  report: ImportReporter,
  options: ParseOptions = {},
): Promise<string> {
  const signature = await signatureOf(file)
  const existing = await db.books.where('signature').equals(signature).first()
  if (existing) throw new DuplicateBookError(existing)

  const format = detectFormat(await readHead(file), file.name)
  const parser = await loadParser(format)
  if (!parser) throw new Error('这个格式还不支持，目前能读 txt 和 epub')

  report({ ratio: 0, note: '正在识别文件' })
  const probe = await parser.probe(file, options)

  const id = bookId
  const now = Date.now()
  const placeholder: BookRecord = {
    id,
    state: 'importing',
    title: file.name.replace(/\.[^.]+$/, '').trim() || '未命名',
    author: '',
    format: parser.format,
    addedAt: now,
    lastReadAt: now,
    totalChars: 0,
    chapterCount: 0,
    charOffsets: [],
    groups: [],
    progress: null,
    fileName: file.name,
    fileSize: file.size,
    signature,
    charset: probe.charset,
    txtRule: probe.rule,
    note: probe.warning,
  }

  await db.transaction('rw', db.books, db.files, async () => {
    await db.books.add(placeholder)
    await db.files.add({ bookId: id, blob: file })
  })

  inFlight.add(id)
  try {
    await runParse(id, parser, file, { ...options, charset: probe.charset, rule: probe.rule }, report)
  } finally {
    inFlight.delete(id)
  }
  return id
}

/** 重新解析：原始文件还在 files 表里，所以不用重新导入 */
export async function reparseBook(
  bookId: string,
  options: ParseOptions,
  report: ImportReporter,
): Promise<void> {
  const book = await db.books.get(bookId)
  if (!book) throw new Error('这本书不在了')
  const stored = await db.files.get(bookId)
  if (!stored) throw new Error('原始文件不在了，没法重新解析')

  const file = new File([stored.blob], book.fileName, { type: stored.blob.type })
  const format = detectFormat(await readHead(file), file.name)
  const parser = await loadParser(format)

  await db.transaction('rw', [db.chapters, db.toc, db.resources, db.books], async () => {
    await db.chapters.where('bookId').equals(bookId).delete()
    await db.toc.where('bookId').equals(bookId).delete()
    await db.resources.where('bookId').equals(bookId).delete()
    await db.books.update(bookId, {
      state: 'importing',
      error: undefined,
      chapterCount: 0,
      totalChars: 0,
      charOffsets: [],
      groups: [],
      progress: null,
    })
  })

  inFlight.add(bookId)
  try {
    const probe = await parser.probe(file, options)
    await runParse(
      bookId,
      parser,
      file,
      { charset: options.charset ?? probe.charset, rule: options.rule ?? probe.rule },
      report,
    )
    await db.books.update(bookId, { charset: probe.charset, txtRule: probe.rule, note: probe.warning })
  } finally {
    inFlight.delete(bookId)
  }
}

async function runParse(
  bookId: string,
  parser: BookParser,
  file: File,
  options: ParseOptions,
  report: ImportReporter,
): Promise<void> {
  const sink = makeSink(bookId, report)
  try {
    const head = await parser.parse(file, sink, options)
    await sink.flush()
    report({ ratio: 0.98, note: '正在收尾' })
    await db.books.update(bookId, {
      state: 'ready',
      error: undefined,
      title: head.meta.title,
      author: head.meta.author,
      cover: head.meta.cover,
      language: head.meta.language,
      publisher: head.meta.publisher,
      identifier: head.meta.identifier,
      charset: head.meta.charset ?? options.charset,
      chapterCount: head.chapterCount,
      totalChars: head.totalChars,
      charOffsets: head.charOffsets,
      groups: head.groups,
      note: head.meta.note,
    })
    report({ ratio: 1, note: '完成' })
  } catch (error) {
    // 写了一半的章节清掉；书记录留成 error，原始文件还在，可以重试
    await sink.flush().catch(() => {})
    await db.chapters.where('bookId').equals(bookId).delete()
    await db.toc.where('bookId').equals(bookId).delete()
    await db.resources.where('bookId').equals(bookId).delete()
    await db.books.update(bookId, {
      state: 'error',
      error: error instanceof Error ? error.message : '解析失败',
    })
    throw error
  }
}

export async function getBook(bookId: string): Promise<BookRecord | undefined> {
  return db.books.get(bookId)
}

export async function getChapter(
  bookId: string,
  index: number,
): Promise<ChapterRecord | undefined> {
  return db.chapters.get([bookId, index])
}

export async function saveProgress(bookId: string, progress: ReadingProgress): Promise<void> {
  await db.books.update(bookId, { progress, lastReadAt: progress.updatedAt })
}

export async function renameBook(bookId: string, title: string): Promise<void> {
  await db.books.update(bookId, { title: title.trim() || '未命名' })
}

export async function deleteBook(bookId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.files, db.chapters, db.toc, db.resources, db.bookmarks],
    async () => {
      await db.books.delete(bookId)
      await db.files.delete(bookId)
      await db.chapters.where('bookId').equals(bookId).delete()
      await db.toc.where('bookId').equals(bookId).delete()
      await db.resources.where('bookId').equals(bookId).delete()
      await db.bookmarks.where('bookId').equals(bookId).delete()
    },
  )
}

/** 导出原始文件。存进去什么样，导出来什么样 */
export async function exportBook(bookId: string): Promise<void> {
  const book = await db.books.get(bookId)
  const stored = await db.files.get(bookId)
  if (!book || !stored) throw new Error('原始文件不在了')
  const url = URL.createObjectURL(stored.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = book.fileName
  anchor.click()
  // 立刻 revoke 会让某些浏览器来不及开始下载，给一拍
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * 上一轮浏览器崩溃 / 关标签页留下的 importing 记录，启动时收尾成 error。
 * 靠 inFlight 区分：不在 inFlight 里的 importing 一定是残留。
 */
export async function cleanupStaleImports(): Promise<number> {
  const importing = await db.books.where('state').equals('importing').toArray()
  let cleaned = 0
  for (const book of importing) {
    if (isImporting(book.id)) continue
    await db.chapters.where('bookId').equals(book.id).delete()
    await db.toc.where('bookId').equals(book.id).delete()
    await db.resources.where('bookId').equals(book.id).delete()
    await db.books.update(book.id, {
      state: 'error',
      error: '上次导入没有完成（浏览器被关掉了？），可以重新解析',
    })
    cleaned++
  }
  return cleaned
}

/** 当前章引用到的图片：path → ObjectURL。调用方负责用完 revoke */
export async function loadResourceUrls(
  bookId: string,
  paths: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (paths.length === 0) return urls
  const keys = paths.map((path) => [bookId, path] as [string, string])
  const records = await db.resources.bulkGet(keys)
  records.forEach((record, index) => {
    if (!record) return
    urls.set(paths[index], URL.createObjectURL(record.blob))
  })
  return urls
}

let persistRequested = false

/**
 * 申请持久化存储。不申请的话，浏览器在存储紧张时可以把整个书库清掉——
 * 对一个「本地就是唯一副本」的应用来说这是灾难性的。
 * 只在第一次导入时问一次，重复调用没有意义。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistRequested) return true
  persistRequested = true
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface StorageUsage {
  usage: number
  quota: number
  persisted: boolean
}

export async function storageUsage(): Promise<StorageUsage> {
  const estimate = (await navigator.storage?.estimate?.()) ?? {}
  const persisted = (await navigator.storage?.persisted?.()) ?? false
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted }
}
