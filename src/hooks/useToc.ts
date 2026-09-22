import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { TocGroup } from '../parsers/types'

/** 目录抽屉里的一行：可能是章节，也可能是卷/部这类没有正文的分组标题 */
export interface TocRow {
  type: 'chapter' | 'group'
  label: string
  index: number
  depth: number
  charCount?: number
}

/**
 * 目录。读的是 toc 表（只有标题和字数），不是 chapters 表——
 * 一本 3000 章的书，后者要连正文一起读出来，只为了拿标题。
 * 卷/部这类分组节点存在 books.groups 里，这里按位置插回列表。
 */
export function useToc(
  bookId: string | undefined,
  groups: TocGroup[] | undefined,
): TocRow[] | undefined {
  return useLiveQuery(async () => {
    if (!bookId) return []
    const entries = await db.toc.where('bookId').equals(bookId).sortBy('index')

    const pending = [...(groups ?? [])].sort((a, b) => a.chapterIndex - b.chapterIndex)
    const rows: TocRow[] = []
    let cursor = 0

    for (const entry of entries) {
      // 分组标题挂在它下面第一章之前
      while (cursor < pending.length && pending[cursor].chapterIndex <= entry.index) {
        const group = pending[cursor]
        rows.push({
          type: 'group',
          label: group.label,
          index: group.chapterIndex,
          depth: group.depth,
        })
        cursor++
      }
      rows.push({
        type: 'chapter',
        label: entry.title,
        index: entry.index,
        depth: entry.depth,
        charCount: entry.charCount,
      })
    }

    // 落在最后一章之后的分组（理论上不该有）也得显示出来，不能悄悄丢
    while (cursor < pending.length) {
      const group = pending[cursor]
      rows.push({ type: 'group', label: group.label, index: group.chapterIndex, depth: group.depth })
      cursor++
    }

    return rows
  }, [bookId, groups])
}
