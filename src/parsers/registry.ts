import type { BookFormat, BookParser, FileProbe, ParseOptions, ParseSink, ParsedHead } from './types'

/**
 * 解析器按需加载。
 *
 * txt / epub 的解析要用到 chardet、fflate、dompurify（加起来上百 KB），
 * 而「打开书架」和「读一本已经导过的书」完全不需要它们。
 * 做成动态 import 之后这些代码只在真的导入文件时才下载——
 * 对离线 PWA 来说，首次加载少一截是实打实的。
 */
const LAZY_PARSERS: Record<BookFormat, () => Promise<BookParser>> = {
  epub: () => import('./epub/parse').then((module) => module.epubParser),
  txt: () => import('./txt/parse').then((module) => module.txtParser),
}

/** 同步注册进来的解析器（未来加自定义格式走这条路）。它们判定优先 */
const eagerParsers: BookParser[] = []
const loaded = new Map<BookFormat, Promise<BookParser>>()

/** 注册新格式。插到最前面：调用方既然带了实现，判定就该先问它 */
export function registerParser(parser: BookParser): void {
  eagerParsers.unshift(parser)
  loaded.set(parser.format, Promise.resolve(parser))
}

export function listFormats(): BookFormat[] {
  const formats = new Set<BookFormat>([...eagerParsers.map((item) => item.format), 'txt', 'epub'])
  return [...formats]
}

/** 读文件头用来判定格式 */
export async function readHead(file: Blob, size = 64): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, size).arrayBuffer())
}

/**
 * 判定格式只看 magic bytes，不看后缀——后缀错的文件比想象中多。
 * EPUB 就是个 zip（有些书前面有 BOM 或空白，所以在头 64 字节里找签名），
 * 剩下的都归 txt：txt 没有 magic bytes，只能这么兜底。
 */
export function detectFormat(head: Uint8Array, fileName: string): BookFormat {
  for (const parser of eagerParsers) {
    if (parser.detect(head, fileName)) return parser.format
  }
  const limit = Math.min(head.length - 3, 64)
  for (let i = 0; i < limit; i++) {
    if (head[i] === 0x50 && head[i + 1] === 0x4b && head[i + 2] === 0x03 && head[i + 3] === 0x04) {
      return 'epub'
    }
  }
  return 'txt'
}

export function loadParser(format: BookFormat): Promise<BookParser> {
  const existing = loaded.get(format)
  if (existing) return existing
  const loader = LAZY_PARSERS[format]
  if (!loader) throw new Error(`没有能处理 ${format} 的解析器`)
  const promise = loader()
  loaded.set(format, promise)
  return promise
}

export async function probeFile(file: File, options: ParseOptions = {}): Promise<FileProbe> {
  const parser = await loadParser(detectFormat(await readHead(file), file.name))
  return parser.probe(file, options)
}

export async function parseFile(
  file: File,
  sink: ParseSink,
  options: ParseOptions = {},
): Promise<ParsedHead> {
  const parser = await loadParser(detectFormat(await readHead(file), file.name))
  return parser.parse(file, sink, options)
}
