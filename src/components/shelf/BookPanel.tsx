import { useEffect, useRef, useState } from 'react'
import { deleteBook, exportBook, reparseBook, renameBook } from '../../db/books'
import type { BookRecord } from '../../db/db'
import { formatBytes, formatChars, formatPercent, formatReadingTime, bookInitial, coverGradient } from '../../lib/format'
import { bookPercent } from '../../lib/progress'
import { MANUAL_CHARSETS, charsetLabel } from '../../parsers/txt/charsets'
import { TXT_RULES } from '../../parsers/txt/chapters'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { IconClose } from '../ui/icons'
import { useCoverUrl } from '../../hooks/useCoverUrl'
import { useChrome } from '../../hooks/useTheme'
import { decoyFolderName } from '../../lib/decoy'
import { useDecoy } from '../../store/decoy'
import { useSettings } from '../../store/settings'

interface BookPanelProps {
  book: BookRecord | null
  open: boolean
  onClose: () => void
  onRead: (book: BookRecord) => void
  onDeleted: () => void
}

/**
 * 书详情 + 操作 + 解析设置，一个面板全放下。
 *
 * 把这几个功能合并到一个面板而不是拆成「右键菜单 + 设置弹窗」：
 * 导入是「先落盘再解析」，识别结果可能不对，所以「看解析结果」和「改解析规则」
 * 天然该在同一屏里——用户看到章节数不对，下一步就是改规则重新解析。
 */
export function BookPanel({ book, open, onClose, onRead, onDeleted }: BookPanelProps) {
  const chrome = useChrome()
  const decoy = useDecoy((state) => state.enabled)
  const decoyId = useDecoy((state) => state.preset)
  const [charset, setCharset] = useState('auto')
  const [rule, setRule] = useState('auto')
  const [customRegex, setCustomRegex] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const perBook = useSettings((state) => state.perBook)
  const setPerBookEnabled = useSettings((state) => state.setPerBookEnabled)
  const coverUrl = useCoverUrl(book?.cover)

  // 换书时重置面板里的临时状态。
  // 依赖是「书的 id」而不是整条记录：重新解析会连着改几次记录（先 importing、
  // 再 ready），跟着记录重置就会把「正在重新解析 42%」这个状态一起清掉。
  useEffect(() => {
    if (!book) return
    setCharset(book.charset ?? 'auto')
    const stored = book.txtRule ?? 'auto'
    const isPreset = TXT_RULES.some((item) => item.id === stored)
    setRule(isPreset ? stored : 'custom')
    setCustomRegex(isPreset ? '' : stored)
    setTitle(book.title)
    setEditingTitle(false)
    setConfirmDelete(false)
    setError('')
    setProgress(0)
    setRunning(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id])

  /**
   * 面板要一直挂在 DOM 里，才有「从右边滑进来」可言。
   *
   * 原来的写法是「没书就 return null」，于是点 ⋯ 的那一刻整棵子树才第一次渲染，
   * 而它一出现就已经是打开状态——CSS 过渡需要「先有静止的元素、再改它的属性」，
   * 凭空挂载一个 translate-x-0 的元素不会有任何动画（这也是目录和设置面板有动画、
   * 唯独书详情面板「啪」地出现的原因）。
   *
   * lastBook 是为了退场：点关闭时上层把 book 置空，直接照 book 渲染的话内容会先
   * 消失、面板再滑出去。用 ref 而不是 state——它必须在同一拍里就有值。
   */
  const lastBook = useRef<BookRecord | null>(null)
  if (book) lastBook.current = book
  const shown = book ?? lastBook.current

  const isTxt = shown?.format === 'txt'
  const percent =
    shown?.progress ? bookPercent(shown, shown.progress.chapterIndex, shown.progress.ratio) : 0
  const runningPercent = Math.round(progress * 100)
  const [coverFrom, coverTo] = coverGradient(shown?.title ?? '')

  const handleReparse = async () => {
    if (!shown) return
    setRunning(true)
    setError('')
    try {
      // EPUB 没有可调项：重新解析只是拿同一份原始文件重跑一遍当前解析器
      await reparseBook(
        shown.id,
        isTxt
          ? {
              charset: charset === 'auto' ? undefined : charset,
              rule: rule === 'custom' ? customRegex : rule,
            }
          : {},
        (update) => setProgress(update.ratio),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新解析失败')
    } finally {
      setRunning(false)
    }
  }

  const handleRename = async () => {
    if (!shown) return
    await renameBook(shown.id, title)
    setEditingTitle(false)
  }

  const handleDelete = async () => {
    if (!shown) return
    await deleteBook(shown.id)
    onDeleted()
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      side="right"
      header={
        shown ? (
          <div className="flex items-start gap-3 border-b border-border p-4">
            {/* 编辑器形态下不摆封面：整个形态的约定就是「没有图，只有文字」，
                这一个小缩略图破了它反而显眼 */}
            {chrome === 'code' ? null : (
              <div className="h-[68px] w-[51px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  // 没有封面（txt 基本都是）就用书架同一套确定性渐变，别留一个空盒子
                  <span
                    className="grid h-full w-full place-items-center text-[19px] font-medium text-white/85 select-none"
                    style={{ backgroundImage: `linear-gradient(150deg, ${coverFrom}, ${coverTo})` }}
                  >
                    {bookInitial(shown.title)}
                  </span>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold text-fg">
                {chrome === 'code' && decoy ? decoyFolderName(decoyId, shown.id) : shown.title}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-faint">
                {shown.author ? `${shown.author} · ` : ''}
                {shown.format.toUpperCase()} · {formatBytes(shown.fileSize)}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="px-2" onClick={onClose} aria-label="关闭">
              <IconClose className="h-4 w-4" />
            </Button>
          </div>
        ) : undefined
      }
    >
      {shown ? (
        <div className="space-y-6 p-4">
          {shown.state === 'ready' ? (
            <div className="space-y-3">
              <Button variant="solid" size="lg" className="w-full" onClick={() => onRead(shown)}>
                {shown.progress ? `继续阅读 · ${formatPercent(percent)}` : '开始阅读'}
              </Button>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-surface-2/60 p-3 text-[12.5px]">
                <Info label="章节" value={`${shown.chapterCount} 章`} />
                <Info label="字数" value={formatChars(shown.totalChars)} />
                <Info label="全文读完约" value={formatReadingTime(shown.totalChars)} />
                <Info
                  label="剩余约"
                  value={formatReadingTime(Math.round(shown.totalChars * (1 - percent)))}
                />
              </dl>
            </div>
          ) : null}

          {shown.state === 'error' ? (
            <p className="mn-rise rounded-xl bg-surface-2 p-3 text-[12.5px] text-danger">
              {shown.error ?? '解析失败'}
            </p>
          ) : null}

          {shown.note ? (
            <p className="rounded-xl bg-surface-2 p-3 text-[12.5px] leading-relaxed text-fg-muted">
              {shown.note}
            </p>
          ) : null}

        <section className="space-y-3">
          <h3 className="text-[13px] font-medium text-fg">格式</h3>
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="shrink-0 text-fg-muted">书名</span>
            {editingTitle ? (
              <span className="mn-fade flex min-w-0 flex-1 items-center justify-end gap-1.5">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleRename()
                    if (event.key === 'Escape') setEditingTitle(false)
                  }}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 text-right text-[13px] focus:border-accent focus:outline-none"
                />
                <Button size="sm" variant="solid" onClick={handleRename}>
                  存
                </Button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="max-w-[60%] truncate text-accent transition-opacity hover:opacity-75"
              >
                {shown.title} <span className="text-fg-faint">改</span>
              </button>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[13px] font-medium text-fg">解析设置</h3>
          {isTxt ? (
            <>
              <div>
                <span className="text-[12.5px] text-fg-muted">编码</span>
                <Select
                  className="mt-1.5"
                  ariaLabel="文本编码"
                  value={charset}
                  onChange={setCharset}
                  options={[
                    {
                      value: 'auto',
                      label: '自动检测',
                      hint: `当前识别为 ${charsetLabel(shown.charset)}`,
                    },
                    ...MANUAL_CHARSETS.map((item) => ({ value: item.value, label: item.label })),
                  ]}
                />
              </div>

              <div>
                <span className="text-[12.5px] text-fg-muted">分章规则</span>
                <Select
                  className="mt-1.5"
                  ariaLabel="分章规则"
                  value={rule}
                  onChange={setRule}
                  options={TXT_RULES.map((item) => ({
                    value: item.id,
                    label: item.name,
                    hint: item.hint,
                  }))}
                />
              </div>

              {rule === 'custom' ? (
                <label className="mn-fade block">
                  <span className="text-[12.5px] text-fg-muted">自定义正则（整行匹配）</span>
                  <input
                    value={customRegex}
                    onChange={(event) => setCustomRegex(event.target.value)}
                    placeholder="^第[0-9]+章"
                    className="mt-1.5 w-full rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-[12.5px] focus:border-accent focus:outline-none"
                  />
                </label>
              ) : null}
            </>
          ) : null}

          {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}

          <Button variant="outline" className="w-full" disabled={running} onClick={handleReparse}>
            {running
              ? `正在重新解析 ${runningPercent}%`
              : isTxt
                ? '按这个设置重新解析'
                : '重新解析这本书'}
          </Button>
          {running ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-[var(--mn-ease)]"
                style={{ width: `${runningPercent}%` }}
              />
            </div>
          ) : null}
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            {isTxt
              ? '用存着的原始文件重跑，不用再拖一次。章节重新划分后，阅读进度会清零。'
              : '用存着的原始文件重跑，不用再拖一次。跑完阅读进度会清零。'}
          </p>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <Switch
            label="这本书用独立的阅读设置"
            description="字号、行距、主题只对这本书生效"
            checked={perBook[shown.id]?.enabled ?? false}
            onChange={(enabled) => setPerBookEnabled(shown.id, enabled)}
          />
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <Button variant="outline" className="w-full" onClick={() => void exportBook(shown.id)}>
            导出原始文件
          </Button>
          {confirmDelete ? (
            <div className="mn-pop flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => void handleDelete()}>
                确认删除
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
              删除这本书
            </Button>
          )}
          <p className="text-[11.5px] text-fg-faint">原始文件、章节缓存和封面会一起删掉。</p>
        </section>
        </div>
      ) : null}
    </Panel>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fg-faint">{label}</dt>
      <dd className="mt-0.5 text-fg">{value}</dd>
    </div>
  )
}
