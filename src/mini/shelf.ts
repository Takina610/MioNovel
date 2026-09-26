import type { BookRecord } from '../db/db'

/**
 * 小窗书架的清单（纯函数，verify-apps 会断言它）。
 *
 * 只列**导入成功**的书：importing / error 是半成品，点进去也没有正文可读——
 * 「小窗模式下书架只显示导入的书本」说的就是这个。顺序是最近读过在最上面
 * （没读过的按加入时间排后面）：小窗里没有排序控件，默认顺序就得是
 * 「接着读哪本」的顺序。
 */
export function miniShelfBooks(books: BookRecord[]): BookRecord[] {
  return books
    .filter((book) => book.state === 'ready')
    .sort((a, b) => (b.progress?.updatedAt ?? b.addedAt) - (a.progress?.updatedAt ?? a.addedAt))
}
