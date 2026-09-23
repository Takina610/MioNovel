import { unzipSync } from 'fflate'
import type {
  BookParser,
  FileProbe,
  ParseOptions,
  ParseSink,
  ParsedChapter,
  ParsedHead,
  TocGroup,
} from '../types'
import { transformChapterHtml } from './html'
import { attr, findAll, parseContainer, parseOpf, parseXml, type OpfData } from './opf'
import { dirOf, guessImageType, resolvePath } from './paths'
import { parseNav, parseNcx, type RawTocEntry } from './toc'

/** 字体和音视频一律不解。字体反正会被剥掉，音视频对小说没有意义 */
const SKIP_FILE = /\.(woff2?|ttf|otf|eot|mp[34]|m4[abv]|mov|ogg|oga|webm|wav|flac)$/i

/** 封面缩略图的最大宽度。存的是缩略图不是原图——书架上一屏几十本书 */
const COVER_MAX_WIDTH = 400

class ZipIndex {
  private byLower = new Map<string, string>()

  constructor(private files: Record<string, Uint8Array>) {
    for (const name of Object.keys(files)) this.byLower.set(name.toLowerCase(), name)
  }

  get(path: string): Uint8Array | undefined {
    if (!path) return undefined
    const direct = this.files[path]
    if (direct) return direct
    // 真实 EPUB 里 OPF/TOC 的路径大小写和 zip 条目对不上是常见毛病，
    // 多一次小写查找能救回一批书
    const actual = this.byLower.get(path.toLowerCase())
    return actual ? this.files[actual] : undefined
  }

  has(path: string): boolean {
    return this.get(path) !== undefined
  }

  names(): string[] {
    return Object.keys(this.files)
  }
}

/** 复制出独立的 ArrayBuffer。既躲开 Uint8Array 泛型和 BlobPart 的类型摩擦，
 *  也让 Blob 不再引用 zip 的内存 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(toArrayBuffer(bytes))
}

function detect(head: Uint8Array): boolean {
  // EPUB 就是个 zip（有些书前面有 BOM 或空白，所以在头 64 字节里找签名）
  const limit = Math.min(head.length - 3, 64)
  for (let i = 0; i < limit; i++) {
    if (head[i] === 0x50 && head[i + 1] === 0x4b && head[i + 2] === 0x03 && head[i + 3] === 0x04) {
      return true
    }
  }
  return false
}

async function openEpub(
  file: File,
): Promise<{ zip: ZipIndex; opf: OpfData; toc: RawTocEntry[] }> {
  const buffer = await file.arrayBuffer()

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (entry) => !SKIP_FILE.test(entry.name) && !entry.name.startsWith('__MACOSX/'),
    })
  } catch {
    // fflate 抛的是英文的 "invalid zip data"，直接透出去用户看不懂
    throw new Error('这个文件不是有效的 EPUB：解不开压缩包。可能只是改了后缀，或者文件已经损坏。')
  }
  const zip = new ZipIndex(files)

  const containerBytes = zip.get('META-INF/container.xml')
  let opfPath = containerBytes ? parseContainer(decodeText(containerBytes)) : null
  if (!opfPath || !zip.has(opfPath)) {
    // container.xml 缺失或者指错了，退一步自己找 .opf
    opfPath = zip.names().find((name) => name.toLowerCase().endsWith('.opf')) ?? null
  }
  if (!opfPath) {
    throw new Error('这个 epub 里找不到 .opf 包文档，可能不是标准的 EPUB 文件')
  }

  const opfBytes = zip.get(opfPath)
  if (!opfBytes) throw new Error('EPUB 的包文档读不出来，文件可能已损坏')

  const opf = parseOpf(decodeText(opfBytes), opfPath, fileTitle(file))

  let toc: RawTocEntry[] = []
  const navBytes = opf.navPath ? zip.get(opf.navPath) : undefined
  if (navBytes) toc = parseNav(decodeText(navBytes), opf.navPath)
  if (toc.length === 0 && opf.ncxPath) {
    const ncxBytes = zip.get(opf.ncxPath)
    if (ncxBytes) toc = parseNcx(decodeText(ncxBytes), opf.ncxPath)
  }
  // nav 和 ncx 都没有，就拿 guide 里的 contents 凑一下
  if (toc.length === 0) {
    const contents = opf.guide.find((ref) => ref.type === 'contents')
    const navish = contents ? zip.get(contents.path) : undefined
    if (navish) toc = parseNav(decodeText(navish), contents!.path)
  }

  return { zip, opf, toc }
}

function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').trim() || '未命名'
}

interface ChapterGroup {
  /** spine 里的起止区间 [start, end) */
  start: number
  end: number
  label: string | null
  depth: number
}

/** 目录里没有链接的分组标题（卷/部），挂到它后面最近的章上 */
interface GroupAnchor {
  label: string
  depth: number
  spineIndex: number
}

/** 目录层级太深的话抽屉里缩进会很难看，压到 0-2 */
function clampDepth(depth: number): number {
  return Math.max(0, Math.min(2, depth))
}

/**
 * 章节归并——EPUB 阅读体验的关键一步。
 *
 * 很多 EPUB 把书切成几百个极小的 spine 文档（一个场景一个，甚至一段一个）。
 * 如果按 spine 逐篇成章，目录里会出现 400 个「第 N 章」。
 *
 * 规则：**目录项落在哪个 spine 文档上，那里就是一个章节边界**；
 * 两个目录目标之间的连续文档合并进同一章。
 */
function planChapters(
  opf: OpfData,
  toc: RawTocEntry[],
): { chapters: ChapterGroup[]; anchors: GroupAnchor[] } {
  const spineIndex = new Map<string, number>()
  opf.spinePaths.forEach((path, index) => spineIndex.set(path, index))

  const bySpine = new Map<number, RawTocEntry>()
  const anchors: GroupAnchor[] = []
  // 还没找到归属的分组标题
  let orphans: { label: string; depth: number }[] = []

  for (const entry of toc) {
    const index = entry.path ? spineIndex.get(entry.path) : undefined
    if (index === undefined) {
      // 目录里没有链接的项就是分组标题（nav 里的 <span>、ncx 里的空 content）
      orphans.push({ label: entry.label, depth: entry.depth })
      continue
    }
    // 同一处有多个目录项时保留第一个（通常是层级更靠上的那个）
    if (!bySpine.has(index)) bySpine.set(index, entry)
    for (const orphan of orphans) {
      anchors.push({ label: orphan.label, depth: clampDepth(orphan.depth), spineIndex: index })
    }
    orphans = []
  }

  if (bySpine.size === 0) {
    // 没有可用目录：每篇文档各成一章，标题从文档里的第一个标题取
    return {
      chapters: opf.spinePaths.map((_, index) => ({
        start: index,
        end: index + 1,
        label: null,
        depth: 0,
      })),
      anchors: [],
    }
  }

  const boundaries = [...new Set([0, ...bySpine.keys()])].sort((a, b) => a - b)
  const chapters: ChapterGroup[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : opf.spinePaths.length
    if (end <= start) continue
    const entry = bySpine.get(start)
    chapters.push({
      start,
      end,
      // 目录从 spine[0] 之后才开始时，最前面那截封面/插图/版权页没有目录项。
      // 给它一个像样的名字，而不是落到「第 1 节」
      label: entry?.label ?? (start === 0 ? '卷首' : null),
      depth: clampDepth(entry?.depth ?? 0),
    })
  }
  return { chapters, anchors }
}

/** 封面回退链。真实 EPUB 的封面标注方式五花八门，一条链全试一遍 */
function findCoverPath(zip: ZipIndex, opf: OpfData): string | null {
  const isImage = (path: string) => Boolean(guessImageType(path))

  // 1. EPUB3：manifest 里 properties="cover-image"
  for (const item of opf.manifest.values()) {
    if (item.properties.split(/\s+/).includes('cover-image') && isImage(item.path)) {
      return item.path
    }
  }

  // 2. EPUB2：<meta name="cover" content="id">
  if (opf.coverId) {
    const item = opf.manifest.get(opf.coverId)
    if (item && isImage(item.path)) return item.path
  }

  // 3. guide 里的 cover 页：找到那一页里的第一张图
  const guideCover = opf.guide.find((ref) => ref.type === 'cover')
  if (guideCover) {
    const bytes = zip.get(guideCover.path)
    if (bytes) {
      const doc = parseXml(decodeText(bytes), 'application/xhtml+xml')
      const img = doc ? findAll(doc, 'img')[0] : null
      const src = attr(img, 'src')
      if (src) {
        const path = resolvePath(dirOf(guideCover.path), src)
        if (isImage(path) && zip.has(path)) return path
      }
    }
  }

  // 4. 直接猜文件名
  const guess = zip.names().find((name) => isImage(name) && /cover/i.test(name))
  return guess ?? null
}

/** 缩到书架用的大小。canvas 解不出来的格式（比如 SVG）就原样存，img 也能显示 */
async function makeCoverThumb(bytes: Uint8Array, type: string): Promise<Blob> {
  const raw = new Blob([toArrayBuffer(bytes)], { type })
  try {
    const bitmap = await createImageBitmap(raw)
    const scale = Math.min(1, COVER_MAX_WIDTH / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return raw
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const thumb = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    )
    return thumb ?? raw
  } catch {
    return raw
  }
}

async function parse(file: File, sink: ParseSink, options: ParseOptions): Promise<ParsedHead> {
  const { zip, opf, toc } = await openEpub(file)
  const { chapters: chapterPlan, anchors } = planChapters(opf, toc)

  if (chapterPlan.length === 0) throw new Error('这个 epub 的 spine 是空的，没有可读的正文')

  // path → 章节序号，跨章链接靠它换算
  const chapterOfPath = new Map<string, number>()
  chapterPlan.forEach((group, index) => {
    for (let i = group.start; i < group.end; i++) {
      chapterOfPath.set(opf.spinePaths[i], index)
    }
  })

  const isResource = (path: string) => Boolean(guessImageType(path)) && zip.has(path)

  const charOffsets: number[] = []
  let totalChars = 0
  let emitted = 0

  // 资源只写一次：多章引用同一张图时按路径去重
  const seenResources = new Set<string>()

  for (const group of chapterPlan) {
    if (options.signal?.aborted) throw new Error('已取消')

    let html = ''
    let heading = ''
    const resources = new Set<string>()

    for (let i = group.start; i < group.end; i++) {
      const path = opf.spinePaths[i]
      const bytes = zip.get(path)
      if (!bytes) continue
      const result = transformChapterHtml(decodeText(bytes), {
        chapterPath: path,
        chapterIndexOf: (target) => chapterOfPath.get(target) ?? null,
        isResource,
      })
      html += result.html
      for (const resource of result.resources) resources.add(resource)
      if (!heading && result.heading) heading = result.heading
    }

    const title = group.label ?? heading ?? `第 ${emitted + 1} 节`

    const chapter: ParsedChapter = {
      index: emitted,
      title,
      html,
      charCount: countTextChars(html),
      depth: group.depth,
    }
    await sink.onChapter(chapter)
    charOffsets.push(totalChars)
    totalChars += chapter.charCount

    if (sink.onResource) {
      for (const path of resources) {
        if (seenResources.has(path)) continue
        seenResources.add(path)
        const bytes = zip.get(path)
        const type = guessImageType(path)
        if (!bytes || !type) continue
        await sink.onResource({ path, blob: new Blob([toArrayBuffer(bytes)], { type }), type })
      }
    }

    emitted++
    sink.onProgress(emitted / chapterPlan.length, `正在解析（${emitted}/${chapterPlan.length} 章）`)
  }

  let cover: Blob | undefined
  const coverPath = findCoverPath(zip, opf)
  if (coverPath) {
    const bytes = zip.get(coverPath)
    const type = guessImageType(coverPath)
    if (bytes && type) cover = await makeCoverThumb(bytes, type)
  }

  // 目录里没有链接的分组标题，换算成章节序号
  const groups: TocGroup[] = []
  for (const anchor of anchors) {
    const chapterIndex = chapterOfPath.get(opf.spinePaths[anchor.spineIndex] ?? '')
    if (chapterIndex === undefined) continue
    groups.push({ label: anchor.label, chapterIndex, depth: anchor.depth })
  }

  const notes: string[] = []
  if (toc.length === 0) notes.push('这本书没有可用的目录，已按文档顺序分章')

  return {
    meta: {
      title: opf.metadata.title || fileTitle(file),
      author: opf.metadata.author,
      format: 'epub',
      cover,
      language: opf.metadata.language || undefined,
      publisher: opf.metadata.publisher || undefined,
      identifier: opf.metadata.identifier || undefined,
      note: notes.join(' ') || undefined,
    },
    groups,
    chapterCount: emitted,
    totalChars,
    charOffsets,
  }
}

/** 正文的字符数：去掉标签只数文字 */
function countTextChars(html: string): number {
  const text = html.replace(/<[^>]*>/g, '')
  return text.replace(/\s/g, '').length
}

async function probe(file: File): Promise<FileProbe> {
  try {
    const { toc } = await openEpub(file)
    return {
      format: 'epub',
      titles: toc.slice(0, 5).map((entry) => entry.label),
      warning: toc.length === 0 ? '这本书没有可用的目录，会按文档顺序分章' : undefined,
    }
  } catch (error) {
    return {
      format: 'epub',
      titles: [],
      warning: error instanceof Error ? error.message : '这个 epub 读不出来',
    }
  }
}

export const epubParser: BookParser = {
  format: 'epub',
  detect,
  parse,
  probe,
}
