import type {
  BookParser,
  FileProbe,
  ParseOptions,
  ParseSink,
  ParsedChapter,
  ParsedHead,
  TocGroup,
} from '../types'
import {
  AUTO_RULE_ORDER,
  CHUNK_CHARS,
  PREFACE_MIN_CHARS,
  RULE_HIT_THRESHOLD,
  chapterTitleHtml,
  countChars,
  lineToHtml,
  matchTitle,
  ruleName,
  volumeToHtml,
} from './chapters'
import { detectEncoding, looksReadableText, readSample } from './encoding'
import { isSupportedLabel } from './charsets'

/** 每次读一片。256KB 是个折中：解码 + 逐行判定的耗时可忽略，
 *  进度更新够密，而且每片之间天然让出事件循环，界面不会卡住 */
const READ_CHUNK = 256 * 1024

/** 规则探测最多扫这么多字节。8MB 足够遇到几十个章标题了 */
const PROBE_MAX_BYTES = 8 * 1024 * 1024

/** 卷标题之后攒到这么多字，就认为它是独立一章而不是目录分组 */
const VOLUME_AS_CHAPTER_CHARS = 400

/**
 * 已知二进制文件头。TXT 没有 magic bytes，「不是已知二进制」就是文本，
 * 但这个黑名单能挡掉手滑拖进来的 pdf / 图片 / 压缩包。
 */
const BINARY_MAGICS: number[][] = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP / EPUB
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0x47, 0x49, 0x46, 0x38], // GIF8
  [0xff, 0xd8, 0xff], // JPEG
]

function startsWith(head: Uint8Array, magic: number[]): boolean {
  if (head.length < magic.length) return false
  return magic.every((byte, index) => head[index] === byte)
}

function detect(head: Uint8Array): boolean {
  return !BINARY_MAGICS.some((magic) => startsWith(head, magic))
}

/**
 * 把文件按行吐出来。流式解码 + 只留半个行尾，所以峰值内存和文件大小无关。
 * 换行处理：\r\n 和单独的 \r（老 Mac）都算换行。末尾的 \r 可能是被切片截断的 CRLF，
 * 留到下一片再判断，否则每片边界都会多冒出一个空行。
 */
async function* iterateLines(
  file: Blob,
  charset: string,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const decoder = new TextDecoder(charset)
  let pending = ''

  for (let offset = 0; offset < file.size; offset += READ_CHUNK) {
    if (signal?.aborted) return
    const buffer = await file.slice(offset, offset + READ_CHUNK).arrayBuffer()
    const decoded = decoder.decode(new Uint8Array(buffer), { stream: true })
    let text = pending + decoded

    let carry = ''
    if (text.endsWith('\r')) {
      text = text.slice(0, -1)
      carry = '\r'
    }

    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    pending = (lines.pop() ?? '') + carry

    onProgress(Math.min(1, (offset + READ_CHUNK) / file.size))
    yield* lines
  }

  if (signal?.aborted) return
  const rest = pending + decoder.decode()
  if (rest) yield rest.replace(/\r\n?/g, '\n')
  onProgress(1)
}

/** 用什么编码解这个文件。手动指定优先，其次自动检测 */
async function resolveCharset(file: Blob, options: ParseOptions) {
  const sample = await readSample(file)
  if (options.charset) {
    const charset = isSupportedLabel(options.charset) ? options.charset : 'utf-8'
    ensureDecodesToText(sample, charset)
    return { charset, warning: undefined as string | undefined }
  }
  const guess = detectEncoding(sample)
  ensureDecodesToText(sample, guess.charset)
  return { charset: guess.charset, warning: guess.warning }
}

/**
 * 收文件之前先确认它真的能当文本读。
 *
 * 二进制内容（损坏的 epub、pdf、图片）用 GB18030 也能解出东西来，只是全是乱码。
 * 收进书架就是一本书名叫「broken」、翻开一屏怪字的书——用户既不知道发生了什么，
 * 也不知道能做什么。宁可在导入这一步说清楚。后缀不可信，所以看的是内容。
 */
function ensureDecodesToText(sample: Uint8Array, charset: string): void {
  if (looksReadableText(sample, charset)) return
  throw new Error(
    '这个文件读不出文字：内容不像文本，也不是有效的 EPUB。可能已经损坏，或者不是支持的格式。',
  )
}

/**
 * 探测某个规则在这个文件里能不能用：扫到够数就提前收工。
 * 「自动」模式敢每次都试三种规则，就是靠这个——命中时几乎不花时间，
 * 只有全都不命中时才会老实扫一遍（而且扫到 PROBE_MAX_BYTES 就停）。
 */
async function countHits(file: Blob, charset: string, rule: string, need: number): Promise<number> {
  let hits = 0
  let scanned = 0
  for await (const line of iterateLines(file, charset, (ratio) => {
    scanned = ratio * file.size
  })) {
    if (matchTitle(line, rule)) {
      hits++
      if (hits >= need) return hits
    }
    if (scanned > PROBE_MAX_BYTES) break
  }
  return hits
}

/** 自动模式：按 cn → en → num 试，谁先凑够 3 个命中就用谁；都不行按字数分段 */
async function chooseRule(
  file: Blob,
  charset: string,
  requested: string | undefined,
): Promise<string> {
  if (requested && requested !== 'auto') return requested
  for (const rule of AUTO_RULE_ORDER) {
    if ((await countHits(file, charset, rule, RULE_HIT_THRESHOLD)) >= RULE_HIT_THRESHOLD) {
      return rule
    }
  }
  return 'chunk'
}

async function probe(file: File, options: ParseOptions): Promise<FileProbe> {
  const { charset, warning } = await resolveCharset(file, options)
  const rule = await chooseRule(file, charset, options.rule)

  const titles: string[] = []
  if (rule !== 'chunk') {
    for await (const line of iterateLines(file, charset, () => {})) {
      const match = matchTitle(line, rule)
      if (!match) continue
      titles.push(match.title)
      if (titles.length >= 5) break
    }
  }

  return {
    format: 'txt',
    charset,
    rule,
    titles,
    warning:
      warning ??
      (rule === 'chunk'
        ? '没找到章节标记，会按约 3000 字分段。如果这份 txt 其实有章节，可以在下面换个规则。'
        : undefined),
  }
}

async function parse(file: File, sink: ParseSink, options: ParseOptions): Promise<ParsedHead> {
  const { charset, warning } = await resolveCharset(file, options)
  const rule = await chooseRule(file, charset, options.rule)
  const isChunkMode = rule === 'chunk'

  /** 每章起始位置的前缀和 */
  const charOffsets: number[] = []
  /** 卷/部这类分组节点。章标题和层级走 chapters 表，这里只留没有对应章节的分组 */
  const groups: TocGroup[] = []
  let totalChars = 0
  let emitted = 0

  // 当前正在攒的章
  let title = ''
  let body: string[] = []
  let bodyChars = 0

  // 卷标题：先不下结论，看后面跟的是章节标题还是大段正文
  let pendingVolume: { title: string; lines: string[]; chars: number } | null = null
  // 进过卷之后，后面的章在目录里缩进一级
  let chapterDepth = 0

  // 第一个标题之前的内容
  let preface: string[] = []
  let prefaceChars = 0

  const emit = async (chapterTitle: string, lines: string[], textChars: number) => {
    const chapter: ParsedChapter = {
      index: emitted,
      title: chapterTitle,
      html: chapterTitleHtml(chapterTitle) + lines.join(''),
      // 只数正文的字，不数我们自己包上去的 HTML 标签——
      // 否则段数多的书会被系统性高估，进度百分比跟着偏
      charCount: textChars + countChars(chapterTitle),
      depth: chapterDepth,
    }
    await sink.onChapter(chapter)
    charOffsets.push(totalChars)
    totalChars += chapter.charCount
    emitted++
  }

  /** 攒够字数就是独立一章，否则它的内容并进下一个章 */
  const flushPendingVolume = async () => {
    if (!pendingVolume) return [] as string[]
    if (pendingVolume.chars >= VOLUME_AS_CHAPTER_CHARS) {
      await emit(pendingVolume.title, pendingVolume.lines, pendingVolume.chars)
      groups.push({ label: pendingVolume.title, chapterIndex: emitted - 1, depth: 0 })
      pendingVolume = null
      return []
    }
    const lines = pendingVolume.lines
    pendingVolume = null
    return lines
  }

  const closeChapter = async () => {
    if (!title) return
    if (body.length > 0) await emit(title, body, bodyChars)
    title = ''
    body = []
    bodyChars = 0
  }

  const reportProgress = (ratio: number) =>
    sink.onProgress(ratio, `正在分章（${ruleName(rule)}）`)

  for await (const line of iterateLines(file, charset, reportProgress, options.signal)) {
    if (options.signal?.aborted) throw new Error('已取消')

    if (isChunkMode) {
      body.push(lineToHtml(line))
      bodyChars += countChars(line)
      if (bodyChars >= CHUNK_CHARS) {
        title = `第 ${emitted + 1} 节`
        await closeChapter()
      }
      continue
    }

    const match = matchTitle(line, rule)

    if (!match) {
      if (pendingVolume) {
        // 卷标题还没定论，这行先记在它名下
        pendingVolume.lines.push(lineToHtml(line))
        pendingVolume.chars += countChars(line)
      } else if (title) {
        body.push(lineToHtml(line))
        bodyChars += countChars(line)
      } else {
        preface.push(lineToHtml(line))
        prefaceChars += countChars(line)
      }
      continue
    }

    if (match.kind === 'volume') {
      await closeChapter()
      // 连续两个卷标题：把上一个卷的内容带上，别丢字
      const carried = await flushPendingVolume()
      pendingVolume = { title: match.title, lines: [...carried, volumeToHtml(match.title)], chars: 0 }
      chapterDepth = 1
      continue
    }

    // 到这里是真正的章标题。收尾顺序很重要：
    // 1) 开头的前言先落位，否则卷目录项会指到前言那一章上
    // 2) 再把卷的归属定下来
    // 3) 最后关掉上一章、开新章
    const prefixLines: string[] = []
    if (!title && prefaceChars > 0) {
      if (prefaceChars >= PREFACE_MIN_CHARS) {
        await emit('前言', preface, prefaceChars)
      } else {
        // 太短的前言不值得占一章，并进第一章
        prefixLines.push(...preface)
      }
      preface = []
      prefaceChars = 0
    }

    await closeChapter()

    if (pendingVolume) {
      groups.push({ label: pendingVolume.title, chapterIndex: emitted, depth: 0 })
    }
    prefixLines.push(...(await flushPendingVolume()))

    title = match.title
    body = prefixLines
    bodyChars = prefixLines.reduce((sum, html) => sum + countChars(html), 0)
  }

  if (options.signal?.aborted) throw new Error('已取消')

  if (isChunkMode) {
    if (bodyChars > 0) {
      title = `第 ${emitted + 1} 节`
      await closeChapter()
    }
  } else {
    // 文件最后是一个卷标题、或者一直没出现章节标题
    if (pendingVolume && !title) {
      await flushPendingVolume()
    }
    if (!title && prefaceChars > 0) {
      // 文件末尾的短前言不值得单独成章，直接丢掉；真要是全文都没标题，
      // 下面 emitted === 0 的分支会改为按字数分段重来
      if (prefaceChars >= PREFACE_MIN_CHARS) await emit('前言', preface, prefaceChars)
      preface = []
      prefaceChars = 0
    }
    await closeChapter()
  }

  if (emitted === 0) {
    // 规则挑错了（文件里其实一个标题都没有），退到按字数分段重来一遍
    if (!isChunkMode) {
      sink.onProgress(0, '没识别出章节，改为按字数分段')
      return parse(file, sink, { ...options, charset, rule: 'chunk' })
    }
    // 空文件也要给一章，否则阅读器打不开
    await sink.onChapter({ index: 0, title: '（空文件）', html: '<p></p>', charCount: 0, depth: 0 })
    charOffsets.push(0)
    emitted = 1
  }

  return {
    meta: {
      title: fileNameWithoutExtension(file.name),
      author: '',
      format: 'txt',
      charset,
      note: [buildNote(rule, emitted, options.rule), warning].filter(Boolean).join(' ') || undefined,
    },
    groups,
    chapterCount: emitted,
    totalChars,
    charOffsets,
  }
}

function buildNote(rule: string, count: number, requested: string | undefined): string | undefined {
  if (rule === 'chunk') return '未检测到章节标记，已按约 3000 字分段'
  if (count === 1) {
    return `按「${ruleName(rule)}」只识别出 1 章，规则可能不合适，可以换个规则重新解析`
  }
  if (requested && requested !== 'auto') return `按「${ruleName(rule)}」分章，共 ${count} 章`
  return undefined
}

function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || '未命名'
}

export const txtParser: BookParser = {
  format: 'txt',
  detect,
  parse,
  probe,
}
