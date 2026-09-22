import type { BookRecord } from '../db/db'

/**
 * 全书阅读百分比。
 *
 * 靠导入时算好的前缀和 charOffsets 做到 O(1)：
 *   已读字数 = 本章之前的总字数 + 本章字数 × 章内进度
 * 这个模型对 txt 和 epub、对滚动和翻页都一样，所以切换格式或阅读模式
 * 都不会让进度跳变，也不需要为不同格式维护不同的进度字段。
 */
export function bookPercent(book: BookRecord, chapterIndex: number, ratio: number): number {
  if (book.totalChars <= 0) return 0
  const offsets = book.charOffsets
  const start = offsets[chapterIndex] ?? 0
  const next = offsets[chapterIndex + 1] ?? book.totalChars
  const chapterChars = Math.max(0, next - start)
  const read = start + chapterChars * clamp01(ratio)
  return clamp01(read / book.totalChars)
}

/** 还剩多少字没读，用来估阅读时间 */
export function remainingChars(book: BookRecord, chapterIndex: number, ratio: number): number {
  const percent = bookPercent(book, chapterIndex, ratio)
  return Math.max(0, Math.round(book.totalChars * (1 - percent)))
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * 从「上一章之前的累计字数 + 章内进度」反推出该跳到哪一章。
 * 拖动进度条跳转时用：先按字数定位章节，再算章内比例。
 */
export function locateByPercent(
  book: BookRecord,
  percent: number,
): { chapterIndex: number; ratio: number } {
  const target = clamp01(percent) * book.totalChars
  const offsets = book.charOffsets
  if (offsets.length === 0) return { chapterIndex: 0, ratio: 0 }

  let low = 0
  let high = offsets.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (offsets[mid] <= target) low = mid
    else high = mid - 1
  }

  const start = offsets[low]
  const next = offsets[low + 1] ?? book.totalChars
  const span = next - start
  return { chapterIndex: low, ratio: span > 0 ? clamp01((target - start) / span) : 0 }
}
