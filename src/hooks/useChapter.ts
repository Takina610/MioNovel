import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ChapterRecord } from '../db/db'

/**
 * 按需取一章。
 *
 * 章节是按需从 IndexedDB 读的，不是全书常驻内存——所以一本 3000 章的书
 * 和一本 3 章的书占用是一样的。useLiveQuery 保证重新解析后内容会自动刷新。
 */
export function useChapter(
  bookId: string | undefined,
  index: number | null,
): ChapterRecord | null | undefined {
  return useLiveQuery(async () => {
    if (!bookId || index === null) return null
    return (await db.chapters.get([bookId, index])) ?? null
  }, [bookId, index])
}

/**
 * 把邻章读进浏览器的 IndexedDB 页缓存，让「下一章」点下去更快。
 * 这不是缓存副本，只是提前摸一下——读错了也没有正确性风险。
 */
export async function warmNeighbours(
  bookId: string,
  index: number,
  total: number,
): Promise<void> {
  const targets = [index + 1, index - 1].filter((item) => item >= 0 && item < total)
  await Promise.all(targets.map((item) => db.chapters.get([bookId, item])))
}
