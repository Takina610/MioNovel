import { detect as chardetDetect } from 'chardet'
import { isSupportedLabel } from './charsets'

/**
 * TXT 编码检测。
 *
 * 为什么不能只靠 chardet（koodo-reader 的做法就是只靠它，而且没有手动改的入口）：
 *   - 它只看头 4096 字节，短文件或者中文夹西文的文件经常猜错；
 *   - 猜错成 windows-1252 / ISO-8859-x 时**不会报错**——单字节编码对任何字节序列
 *     都能解码成功，于是「解码失败」这个信号根本不存在，页面直接显示一堆乱码；
 *   - 它还会返回 TextDecoder 根本不认识的标签（mbcs / UTF-32 / ISO-2022-CN）。
 *
 * 所以这里的顺序是「先证据、后统计、再降级」：
 *   1. BOM 是硬证据；
 *   2. UTF-8 用 fatal 严格解码试一次——UTF-8 是自校验的，能过基本就是它
 *      （GBK 字节串恰好构成合法 UTF-8 的概率极低）；
 *   3. 交给 chardet，但只信它给出的多字节 CJK 编码（GB18030 / Big5 / EUC-* 等），
 *      这些它有真实的统计模型，比单字节猜测可靠得多；
 *   4. 都对不上就用 GB18030 兜底（GBK/GB2312 的超集，覆盖绝大多数简体老文件），
 *      并明确告诉用户「这是降级结果，不对就手动选」。
 *
 * 最后一步永远存在：导入弹窗里可以手动指定编码。自动检测不可能 100%，
 * 有个能改的入口比把猜测调得更花哨重要。
 */

export type CharsetSource = 'bom' | 'utf8' | 'utf16' | 'chardet' | 'fallback'

export interface EncodingGuess {
  /** TextDecoder 认的标签 */
  charset: string
  source: CharsetSource
  /** 0-1，只有 chardet 来源有意义 */
  confidence: number
  /** 自动检测拿不准时给用户的提醒 */
  warning?: string
}

/** TextDecoder 认不认这个标签。chardet 的返回值不一定能用，必须实测。
 *  实现和候选列表都在 charsets.ts——那边不依赖 chardet，UI 可以安全引用 */
export { charsetLabel, isSupportedLabel, MANUAL_CHARSETS } from './charsets'

export const SAMPLE_BYTES = 8192

/* chardet 的编码名 → TextDecoder 标签。null 表示 TextDecoder 不支持，走降级。 */
const LABEL_MAP: Record<string, string | null> = {
  ASCII: 'utf-8', // ASCII 是 UTF-8 的子集，解出来完全一样
  'UTF-8': 'utf-8',
  UTF8: 'utf-8',
  GB18030: 'gb18030',
  GBK: 'gb18030',
  GB2312: 'gb18030', // GB18030 兼容 GBK/GB2312，用它解更宽容
  Big5: 'big5',
  'UTF-16LE': 'utf-16le',
  'UTF-16BE': 'utf-16be',
  Shift_JIS: 'shift_jis',
  'EUC-JP': 'euc-jp',
  'EUC-KR': 'euc-kr',
  'ISO-2022-JP': 'iso-2022-jp',
  // TextDecoder 不支持 UTF-32 和 ISO-2022-CN/KR；mbcs/sbcs 是 chardet 的「未知」标记
  'UTF-32': null,
  'UTF-32LE': null,
  'UTF-32BE': null,
  'ISO-2022-CN': null,
  'ISO-2022-KR': null,
  mbcs: null,
  sbcs: null,
  ISO_2022: null,
}

function bomCharset(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8'
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  return null
}

/**
 * 没有 BOM 的 UTF-16 靠字节结构判断，而不是靠解码结果。
 *
 * 为什么不能用「UTF-8 能不能严格解出来」来判断 UTF-16：UTF-16LE 里的汉字
 * 是「低位字节 + 0x4E-0x9F」，而这些字节全都在合法 ASCII 范围内，
 * 于是 UTF-16 的中文文本**能**通过 UTF-8 的严格解码，只是解出一堆
 * 看起来像正常 ASCII 的乱码。这个坑很隐蔽——所以结构判断必须排在 UTF-8 之前。
 *
 * 判据一：换行的位置。UTF-16 里换行是 0A 00（小端）或 00 0A（大端），
 * 所以 0x0A 只会落在**同一侧**的字节位置上。而 UTF-8 文本里 0x0A 只来自换行，
 * 奇偶各半。于是「0x0A 几乎全在偶数位」就是小端的强证据。
 * 注意不能只看「0A 后面是不是 00」：汉字「上」是 U+4E0A，低位字节正好是 0x0A，
 * 按那个判据会被算成不配对，实测比例只有 0.7 左右，阈值定不下去。
 *
 * 判据二：高位字节大量为 0（英文等 BMP 低码位的 UTF-16 文本）。
 */
function detectUtf16Structure(bytes: Uint8Array): string | null {
  const length = Math.min(bytes.length, 4096) & ~1
  if (length < 64) return null

  let zerosAtEven = 0
  let zerosAtOdd = 0
  let lineFeedAtEven = 0
  let lineFeedAtOdd = 0

  for (let i = 0; i < length; i += 2) {
    if (bytes[i] === 0) zerosAtEven++
    if (bytes[i + 1] === 0) zerosAtOdd++
    if (bytes[i] === 0x0a) lineFeedAtEven++
    if (bytes[i + 1] === 0x0a) lineFeedAtOdd++
  }

  const pairs = length / 2
  const lineFeeds = lineFeedAtEven + lineFeedAtOdd

  // 要求至少 8 个换行：太少的话「全落在同一侧」可能只是巧合，
  // 8 个换行全部同侧的偶然概率约 0.4%
  if (lineFeeds >= 8) {
    if (lineFeedAtOdd / lineFeeds < 0.05) return 'utf-16le'
    if (lineFeedAtEven / lineFeeds < 0.05) return 'utf-16be'
  }

  if (zerosAtOdd / pairs > 0.3) return 'utf-16le'
  if (zerosAtEven / pairs > 0.3) return 'utf-16be'
  return null
}

/** 严格解码能否通过。UTF-16 的样本长度要削成偶数，否则末尾半个字符会误判成失败 */
function decodesCleanly(bytes: Uint8Array, label: string): boolean {
  try {
    const sample = label.startsWith('utf-16') ? bytes.subarray(0, bytes.length & ~1) : bytes
    new TextDecoder(label, { fatal: true }).decode(sample)
    return true
  } catch {
    return false
  }
}

/**
 * 解码后的文本像不像人话。
 * 用来挡住「字节序猜反了」这种情况：猜反时解出来的全是怪码位，控制字符比例会很高。
 */
function looksLikeText(bytes: Uint8Array, label: string): boolean {
  try {
    const sample = bytes.subarray(0, Math.min(bytes.length, 2048) & ~1)
    const text = new TextDecoder(label).decode(sample)
    if (!text) return false
    let controls = 0
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) controls++
    }
    return controls / text.length < 0.02
  } catch {
    return false
  }
}

/**
 * 这些字节到底能不能当文本读。
 *
 * 判定不通过就别把它收进书架：随便一个二进制文件（损坏的 epub、pdf、图片）
 * 都能被 GB18030 解出一屏乱码，收下来用户只会得到一本读不了的书，
 * 还得自己猜是怎么回事。空文件放行——那是合法输入，后面会给一章「（空文件）」。
 */
export function looksReadableText(bytes: Uint8Array, label: string): boolean {
  if (bytes.length === 0) return true
  return looksLikeText(bytes, label)
}

function normalizeCharset(name: string): string | null {
  const mapped = LABEL_MAP[name] ?? LABEL_MAP[name.toUpperCase()]
  if (mapped === undefined) return null
  if (mapped === null) return null
  return isSupportedLabel(mapped) ? mapped : null
}

/**
 * chardet 只在给出多字节 CJK / 日韩编码时值得信。
 * 它给出单字节编码（windows-125x、ISO-8859-x）而文件又不是 UTF-8 时，
 * 基本就是「没认出来」的意思——中文文件被叫成 windows-1252 是常见误报。
 */
function isTrustworthy(charset: string): boolean {
  return (
    charset === 'gb18030' ||
    charset === 'big5' ||
    charset === 'shift_jis' ||
    charset === 'euc-jp' ||
    charset === 'euc-kr'
  )
}

export function detectEncoding(bytes: Uint8Array): EncodingGuess {
  const bom = bomCharset(bytes)
  if (bom) return { charset: bom, source: 'bom', confidence: 1 }

  const sample = bytes.subarray(0, SAMPLE_BYTES)

  // UTF-16 必须排在 UTF-8 之前：UTF-16 的中文文本能通过 UTF-8 的严格解码
  // （见 detectUtf16Structure 的注释），顺序反了就会把 UTF-16 判成 UTF-8
  const utf16 = detectUtf16Structure(sample)
  if (utf16 && decodesCleanly(sample, utf16) && looksLikeText(sample, utf16)) {
    return { charset: utf16, source: 'utf16', confidence: 0.9 }
  }

  // UTF-8 自校验：能严格解出来就基本可以确定
  if (decodesCleanly(sample, 'utf-8')) {
    return { charset: 'utf-8', source: 'utf8', confidence: 1 }
  }

  let detected: string | null = null
  try {
    detected = chardetDetect(sample)
  } catch {
    detected = null
  }

  if (detected) {
    const charset = normalizeCharset(detected)
    if (charset && isTrustworthy(charset)) {
      return { charset, source: 'chardet', confidence: 0.9 }
    }
  }

  // 到这儿说明「不是 UTF-8，chardet 也没给出可信的多字节编码」。
  // GB18030 是覆盖率最高的兜底，但要如实告诉用户这是猜的。
  const fallback = 'gb18030'
  const detectedLabel = detected ? `检测到「${detected}」` : '未能识别编码'
  return {
    charset: fallback,
    source: 'fallback',
    confidence: 0.4,
    warning: `${detectedLabel}，已按 GB18030 解码。如果正文是乱码，请在下面手动选择编码。`,
  }
}

/** 读文件开头一段做检测，不用把整个文件读进内存 */
export async function readSample(file: Blob, size = SAMPLE_BYTES): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, size).arrayBuffer())
}
