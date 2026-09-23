import { useMemo, useRef } from 'react'
import { cx } from '../../lib/cx'
import type { CodeLine, LineKind } from '../../lib/code'

/**
 * 缩略图。
 *
 * 写的是**真实的内容**：把每一行的文字用 3px 字号排出来，长行按缩略图宽度折行，
 * 所以它看起来就是正文压扁之后的样子（编辑器里的缩略图也是这么来的）。
 * 早先的版本是按字数画条柱——远看像进度条，不像文件。
 *
 * 数字是刻意选过的：3px 的等宽字，一行大概放得下 24 个字符，于是「折行」
 * 和正文里的折行对得上——缩略图的高度因此和正文高度成比例，视窗框的位置才有意义。
 * 行数太多时（长章节）按步长抽稀：缩略图上多画那几行也看不出差别，只白费 DOM；
 * 抽稀之后每行的文字会超出那一点高度被裁掉，于是退化成细线——这是能接受的退化，
 * 而不是画错。
 */

/** 缩略图里最多排多少「视觉行」。再多就抽稀 */
const MAX_ROWS = 600
/** 缩略图一行放得下几个字。等宽字体下汉字是 1 个字号宽，与 3px 的字号对得上 */
const CHARS_PER_ROW = 24
/** 单行最多留多少字给缩略图。折行要按这个切，不能直接 slice 文本的前 30 个 */
const MAX_LINE_CHARS = 600

const LINE_COLOR: Record<LineKind, string> = {
  text: 'color-mix(in srgb, var(--mn-reader-fg) 52%, transparent)',
  string: 'var(--mn-code-string)',
  comment: 'var(--mn-code-comment)',
  keyword: 'var(--mn-code-keyword)',
  number: 'var(--mn-code-number)',
  type: 'var(--mn-code-type)',
  fn: 'var(--mn-code-fn)',
  prop: 'var(--mn-code-prop)',
  image: 'var(--mn-code-image)',
}

interface MinimapProps {
  lines: CodeLine[]
  /**
   * 当前读到本章的哪个位置，0-1。
   * 两种阅读模式的约定不完全一样（滚动模式报的是顶边，翻页模式报的是已读列数），
   * 所以视窗框按「中心落在 ratio 上」画，别的一律不管——一行的差别看不出来。
   */
  ratio: number
  onSeek: (ratio: number) => void
}

export function Minimap({ lines, ratio, onSeek }: MinimapProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const expanded: Array<{ text: string; kind: LineKind }> = []
    for (const line of lines) {
      const text = line.text.slice(0, MAX_LINE_CHARS)
      if (text.length === 0) {
        // 空行在缩略图上也要占一格，否则它和上一行会挤在一起
        expanded.push({ text: '', kind: line.kind })
        continue
      }
      for (let index = 0; index < text.length; index += CHARS_PER_ROW) {
        expanded.push({ text: text.slice(index, index + CHARS_PER_ROW), kind: line.kind })
      }
    }
    if (expanded.length <= MAX_ROWS) return expanded
    // 太长就隔几行取一行：缩略图上那一行不到一个像素高，全画出来也看不见
    const step = Math.ceil(expanded.length / MAX_ROWS)
    return expanded.filter((_, index) => index % step === 0)
  }, [lines])

  // 视窗框：表示「正文里现在看得见的那一段」。高度固定——它会随字号变，
  // 而一个跟着变的框会让人以为能拖
  const boxHeight = 0.1
  const boxTop = Math.min(Math.max(0, ratio - boxHeight / 2), 1 - boxHeight)

  const seekFromPointer = (clientY: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || box.height === 0) return
    onSeek((clientY - box.top) / box.height)
  }

  return (
    <div
      ref={ref}
      className="mn-code__minimap"
      aria-hidden
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        seekFromPointer(event.clientY)
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return
        seekFromPointer(event.clientY)
      }}
    >
      <div className="mn-code__minimap-lines">
        {rows.map((row, index) => (
          <span
            key={index}
            className={cx('mn-code__minimap-line', row.kind !== 'text' && `mn-tok-${row.kind}`)}
            style={{ top: `${(index / rows.length) * 100}%`, color: LINE_COLOR[row.kind] }}
          >
            {row.text || ' '}
          </span>
        ))}
      </div>
      <span
        className="mn-code__minimap-view"
        style={{ top: `${boxTop * 100}%`, height: `${boxHeight * 100}%` }}
      />
    </div>
  )
}
