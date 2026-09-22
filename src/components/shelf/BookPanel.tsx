import { useEffect, useState } from 'react'
import { deleteBook, exportBook, reparseBook, renameBook } from '../../db/books'
import type { BookRecord } from '../../db/db'
import { formatBytes, formatChars, formatPercent, formatReadingTime } from '../../lib/format'
import { bookPercent } from '../../lib/progress'
import { MANUAL_CHARSETS, charsetLabel } from '../../parsers/txt/charsets'
import { TXT_RULES } from '../../parsers/txt/chapters'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
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

  // 换书时重置面板里的临时状态
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
  }, [book])

  if (!book) return null

  const isTxt = book.format === 'txt'
  const percent = book.progress ? bookPercent(book, book.progress.chapterIndex, book.progress.ratio) : 0

  const handleReparse = async () => {
    setRunning(true)
    setError('')
    try {
      await reparseBook(
        book.id,
        {
          charset: charset === 'auto' ? undefined : charset,
          rule: rule === 'custom' ? customRegex : rule,
        },
        (update) => setProgress(update.ratio),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新解析失败')
    } finally {
      setRunning(false)
    }
  }

  const handleRename = async () => {
    await renameBook(book.id, title)
    setEditingTitle(false)
  }

  const handleDelete = async () => {
    await deleteBook(book.id)
    onDeleted()
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      side="right"
      header={
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-fg">{book.title}</h2>
            <p className="mt-0.5 text-[12px] text-fg-faint">
              {book.author ? `${book.author} · ` : ''}
              {book.format.toUpperCase()} · {formatBytes(book.fileSize)}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-4">
        {book.state === 'ready' ? (
          <div className="space-y-3">
            <Button variant="solid" size="lg" className="w-full" onClick={() => onRead(book)}>
              {book.progress ? `继续阅读 · ${formatPercent(percent)}` : '开始阅读'}
            </Button>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
              <Info label="章节" value={`${book.chapterCount} 章`} />
              <Info label="字数" value={formatChars(book.totalChars)} />
              <Info label="全文读完约" value={formatReadingTime(book.totalChars)} />
              <Info label="剩余约" value={formatReadingTime(Math.round(book.totalChars * (1 - percent)))} />
            </dl>
          </div>
        ) : null}

        {book.state === 'error' ? (
          <p className="rounded-lg bg-surface-2 p-3 text-[12.5px] text-danger">
            {book.error ?? '解析失败'}
          </p>
        ) : null}

        {book.note ? (
          <p className="rounded-lg bg-surface-2 p-3 text-[12.5px] leading-relaxed text-fg-muted">
            {book.note}
          </p>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-[13px] font-medium text-fg">格式</h3>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-fg-muted">书名</span>
            {editingTitle ? (
              <span className="flex items-center gap-1.5">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-40 rounded-md border border-border bg-bg px-2 py-1 text-right"
                />
                <Button size="sm" variant="solid" onClick={handleRename}>
                  存
                </Button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="max-w-[60%] truncate text-accent"
              >
                {book.title} <span className="text-fg-faint">改</span>
              </button>
            )}
          </div>
        </section>

        {isTxt ? (
          <section className="space-y-4">
            <h3 className="text-[13px] font-medium text-fg">解析设置</h3>

            <label className="block">
              <span className="text-[12.5px] text-fg-muted">编码</span>
              <select
                value={charset}
                onChange={(event) => setCharset(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px]"
              >
                <option value="auto">自动检测（当前：{charsetLabel(book.charset)}）</option>
                {MANUAL_CHARSETS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12.5px] text-fg-muted">分章规则</span>
              <select
                value={rule}
                onChange={(event) => setRule(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px]"
              >
                {TXT_RULES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} —— {item.hint}
                  </option>
                ))}
              </select>
            </label>

            {rule === 'custom' ? (
              <label className="block">
                <span className="text-[12.5px] text-fg-muted">自定义正则（整行匹配）</span>
                <input
                  value={customRegex}
                  onChange={(event) => setCustomRegex(event.target.value)}
                  placeholder="^第[0-9]+章"
                  className="mt-1.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-[12.5px]"
                />
              </label>
            ) : null}

            {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}

            <Button variant="outline" className="w-full" disabled={running} onClick={handleReparse}>
              {running ? `正在重新解析 ${Math.round(progress * 100)}%` : '按这个设置重新解析'}
            </Button>
            <p className="text-[11.5px] leading-relaxed text-fg-faint">
              重新解析用的是已经存下来的原始文件，不用再拖一次。分章结果不对时改规则就行，
              顺便也会把阅读进度清掉——章节索引变了，旧进度没有意义。
            </p>
          </section>
        ) : null}

        <section className="space-y-3 border-t border-border pt-4">
          <Switch
            label="这本书用独立的阅读设置"
            description="字号、行距、主题只对这本书生效"
            checked={perBook[book.id]?.enabled ?? false}
            onChange={(enabled) => setPerBookEnabled(book.id, enabled)}
          />
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <Button variant="outline" className="w-full" onClick={() => void exportBook(book.id)}>
            导出原始文件
          </Button>
          {confirmDelete ? (
            <div className="flex gap-2">
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
          <p className="text-[11.5px] text-fg-faint">
            删除会同时清掉原始文件、章节缓存和封面，不留残留。
          </p>
        </section>
      </div>
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
