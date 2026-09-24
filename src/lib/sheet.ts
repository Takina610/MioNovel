import type { Block, LineKind } from './blocks'

/**
 * 段 → 工作表（Excel 形态）。
 *
 * 一章 = 一个工作表，一行 = 一段。三列，全是真数据或者原文：
 *
 *   A 列：正文（原文）。图片在这一列里写成 `![](./路径)`——单元格装不下图，
 *         而这个形态的约定和编辑器一样：这里原本有一张图，这行是它的地址。
 *   B 列：这一段的字数（等于「计数」函数的结果）。
 *   C 列：这一段的类型（正文 / 对话 / 标题 / 注释 / 图片）——分类器认出来的，
 *         和编辑器贴的那些 token 类名是同一个判断（见 lib/blocks.ts）。
 *
 * 行号从 1 开始，而且前两行是表的一部分：
 *
 *   第 1 行：章标题（A1，横着占满能看见的几列）——真表格里也常这么写
 *   第 2 行：字段名（正文 / 字数 / 类型）
 *   第 3 行起：正文
 *
 * 单元格地址按 Excel 的写法（A3、A4……），编辑栏和名称框都要它。
 */

/** 行号 → Excel 列名（1 → A，27 → AA）。列不多，但公式不该只对前 26 列成立 */
export function columnName(index: number): string {
  let n = index
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

export const KIND_LABELS: Record<LineKind, string> = {
  text: '正文',
  string: '对话',
  comment: '注释',
  keyword: '标题',
  number: '数字',
  type: '类型',
  fn: '函数',
  prop: '属性',
  image: '图片',
}

export interface SheetRow {
  /** Excel 行号（1 是章标题行、2 是字段名行） */
  row: number
  /** 单元格地址，如 A3 */
  address: string
  text: string
  chars: number
  kind: LineKind
  kindLabel: string
  alt: boolean
}

/** 表头：第 2 行那三个字段名 */
export const SHEET_HEAD = ['正文', '字数', '类型'] as const

/**
 * 三列各叫什么（A / B / C）。
 *
 * 表头那一行（Excel 里那一排字母）和单元格地址都取自这里：正文在 A 列，
 * 字数 B、类型 C。**一处定义**——字母序列和字段名的顺序必须一一对上，
 * 分开写两边就会各说各话（`verify:apps` 里对着这条断言）。
 */
export const SHEET_COLUMNS: ReadonlyArray<string> = SHEET_HEAD.map((_, index) => columnName(index + 1))

/** 正文从第几行开始。标题行 + 字段名行之后 */
export const SHEET_FIRST_ROW = 3

/**
 * 一段 = 一行。
 *
 * 空行（TXT 的段落间隔段）不占行：表格里一行空白只会让人以为数据缺了。
 * 开头那个章标题也不占行——它已经在第 1 行的 A1 里了（见 Content.tsx 的 SheetGrid），
 * 再排一行就是同一句话出现两遍。
 */
export function chapterRows(blocks: Block[], title = ''): SheetRow[] {
  const target = title.trim()
  const rows: SheetRow[] = []
  for (const block of blocks) {
    if (block.text.length === 0 && block.kind !== 'image') continue
    const leading = rows.length === 0
    if (leading && block.kind === 'keyword' && target && block.text.trim() === target) continue
    const row = rows.length + SHEET_FIRST_ROW
    rows.push({
      row,
      address: `A${row}`,
      text: block.text,
      chars: block.chars,
      kind: block.kind,
      kindLabel: KIND_LABELS[block.kind],
      alt: block.alt,
    })
  }
  return rows
}

/** 行号 → 「现在正看着第几行」。视口比例换算，没有真光标（见 ExcelApp 的说明） */
export function activeRowOf(rows: SheetRow[], ratio: number): number {
  if (rows.length === 0) return SHEET_FIRST_ROW
  const index = Math.min(rows.length - 1, Math.max(0, Math.floor(ratio * rows.length)))
  return rows[index].row
}

/** 章的字数合计——状态栏上的「计数」。等于这一列字数的和 */
export function rowsTotal(rows: SheetRow[]): number {
  return rows.reduce((sum, row) => sum + row.chars, 0)
}
