import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BookRecord } from '../db/db'

/**
 * 书架数据。
 *
 * 用 useLiveQuery 而不是自己管加载状态：导入、改名、删除、进度变化
 * 都会自动反映到界面上，不需要在任何地方手动 invalidate。
 * 返回值 undefined 表示还在加载，空数组表示书架是空的——这两个状态要分清楚。
 */
export function useBooks(): BookRecord[] | undefined {
  return useLiveQuery(() => db.books.orderBy('addedAt').reverse().toArray(), [])
}

/** 单本书。null 表示查过了但不存在，undefined 表示还在加载 */
export function useBook(bookId: string | undefined): BookRecord | null | undefined {
  return useLiveQuery(async () => {
    if (!bookId) return null
    return (await db.books.get(bookId)) ?? null
  }, [bookId])
}
