import { useState, type ReactNode } from 'react'
import { avatarOf } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevron } from '../components/ui/icons'
import {
  IconAlignJustify,
  IconAlignLeft,
  IconBullets,
  IconCheckbox,
  IconComment,
  IconDivider,
  IconFontColor,
  IconHighlight,
  IconLink,
  IconOutline,
  IconPicture,
  IconRedo,
  IconTable,
  IconThumbUp,
  IconUndo,
} from '../components/ui/app-icons'
import { useHotkeyCombo } from '../store/hotkeys'
import { toggleFullscreen } from '../lib/fullscreen'
import { AppMenu, NavRow } from './OfficeFrame'
import type { AppFrameProps } from './types'

const FONT_LABELS: Record<string, string> = {
  sans: '系统默认',
  serif: '宋体',
  kai: '楷体',
  mono: '等宽',
}
const FONT_ORDER = ['sans', 'serif', 'kai', 'mono']

/**
 * 飞书文档形态。
 *
 * 一本书 = 一篇云文档，一章 = 文档里的一个大标题；左侧「大纲」把全部标题列出来，
 * 点一下就换章——这和在一篇长文档里用大纲跳转是同一件事（见 lib/appdocs.ts）。
 *
 * 界面照飞书文档来：顶部一条白栏（左侧返回箭头、中间文档名、右侧「已读」、
 * 大纲开关、评论、分享、头像），下面一条格式工具条，正文是白底上居中一列字。
 * 飞书没有状态栏，所以进度放在大纲面板底部那条细线上——它必须在（那是我们自己
 * 的阅读器），但可以不显眼。
 *
 * 工具条的规矩和 Office 那三套一致：**会响的**是字体、字号、对齐、行距、
 * 首行缩进（飞书里叫「段落」），其余是只读文档里本就该灰着的（加粗、高亮、
 * 颜色、列表、待办、链接、图片、表格、评论），其中「复制」和「点赞」是真的能用。
 */
export function DocApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [outlineOpen, setOutlineOpen] = useState(() => window.innerWidth >= 900)
  const settingsHotkey = useHotkeyCombo('settings')
  const fullscreenHotkey = useHotkeyCombo('fullscreen')
  const dimHotkey = useHotkeyCombo('dim')

  const cycleFont = () => {
    const index = FONT_ORDER.indexOf(settings.fontFamily)
    onSettingsChange({ fontFamily: FONT_ORDER[(index + 1) % FONT_ORDER.length] })
  }
  const nudgeFont = (delta: number) =>
    onSettingsChange({ fontSize: Math.max(14, Math.min(34, settings.fontSize + delta)) })
  const nudgeIndent = (delta: number) =>
    onSettingsChange({ indent: Math.max(0, Math.min(6, settings.indent + delta)) })
  const cycleSpacing = () => {
    const steps = [1.4, 1.6, 1.8, 2.0]
    const next = steps.find((step) => step > settings.lineHeight + 0.01) ?? steps[0]
    onSettingsChange({ lineHeight: next })
  }

  const chapters = props.chapters

  const toolbar: Array<{ id: string; title: string; icon?: string; active?: boolean; disabled?: boolean; onClick?: () => void }> = [
    { id: 'undo', title: '撤销（没有可撤销的操作）', disabled: true },
    { id: 'redo', title: '重做（没有可重做的操作）', disabled: true },
    { id: 'font', title: `字体：${FONT_LABELS[settings.fontFamily] ?? settings.fontFamily}（点一下换一种）`, icon: FONT_LABELS[settings.fontFamily] ?? settings.fontFamily, onClick: cycleFont },
    { id: 'shrink', title: '缩小字号', icon: 'A⁻', disabled: settings.fontSize <= 14, onClick: () => nudgeFont(-1) },
    { id: 'grow', title: '增大字号', icon: 'A⁺', disabled: settings.fontSize >= 34, onClick: () => nudgeFont(1) },
    { id: 'bold', title: '加粗（正文的粗细不归读者调）', icon: 'B', disabled: true },
    { id: 'italic', title: '斜体（只读）', icon: 'I', disabled: true },
    { id: 'underline', title: '下划线（只读）', icon: 'U', disabled: true },
    { id: 'strike', title: '删除线（只读）', icon: 'S', disabled: true },
    { id: 'highlight', title: '高亮（只读）', disabled: true },
    { id: 'color', title: '字体颜色（只读）', disabled: true },
    { id: 'align-left', title: '左对齐', active: settings.align === 'left', onClick: () => onSettingsChange({ align: 'left' }) },
    { id: 'align-justify', title: '两端对齐', active: settings.align === 'justify', onClick: () => onSettingsChange({ align: 'justify' }) },
    { id: 'spacing', title: `行距：${settings.lineHeight.toFixed(2)}（点一下换下一档）`, icon: '≡', onClick: cycleSpacing },
    { id: 'indent', title: `首行缩进：${settings.indent} 字符（点一下加半格）`, icon: '⇥', disabled: settings.indent >= 6, onClick: () => nudgeIndent(0.5) },
    { id: 'outdent', title: '取消首行缩进', icon: '⇤', disabled: settings.indent <= 0, onClick: () => onSettingsChange({ indent: 0 }) },
    { id: 'bullets', title: '项目符号（只读）', disabled: true },
    { id: 'todo', title: '待办（只读）', disabled: true },
    { id: 'divider', title: '分隔线（只读）', disabled: true },
    { id: 'link', title: '链接（只读）', disabled: true },
    { id: 'image', title: '图片（只读）', disabled: true },
    { id: 'table', title: '表格（只读）', disabled: true },
  ]
  const toolbarIcons: Record<string, ReactNode> = {
    undo: <IconUndo className="h-4 w-4" />,
    redo: <IconRedo className="h-4 w-4" />,
    highlight: <IconHighlight className="h-4 w-4" />,
    color: <IconFontColor className="h-4 w-4" />,
    'align-left': <IconAlignLeft className="h-4 w-4" />,
    'align-justify': <IconAlignJustify className="h-4 w-4" />,
    bullets: <IconBullets className="h-4 w-4" />,
    todo: <IconCheckbox className="h-4 w-4" />,
    divider: <IconDivider className="h-4 w-4" />,
    link: <IconLink className="h-4 w-4" />,
    image: <IconPicture className="h-4 w-4" />,
    table: <IconTable className="h-4 w-4" />,
  }

  return (
    <div className="mn-doc" style={{ ['--mn-dim' as string]: String(props.dim) }}>
      <header className="mn-doc__bar">
        <button
          type="button"
          className="mn-doc__icon-btn"
          title="回到云文档首页"
          aria-label="回到云文档首页"
          onClick={props.onBack}
        >
          {/* 返回箭头：chevron 画的是「向下」，顺时针转 90° 才是「向左」。
              原来写的是 rotate-180，屏幕上是一个朝上的箭头（2026-09-24 修） */}
          <IconChevron className="h-5 w-5 rotate-90" />
        </button>
        <div className="mn-doc__name" title={book.title}>
          {book.title}
        </div>
        <div className="mn-doc__bar-right">
          <span className="mn-doc__chip" title="已读">
            已读 {formatPercent(props.percent)}
          </span>
          <button
            type="button"
            className={cx('mn-doc__icon-btn', outlineOpen && 'is-active')}
            title="大纲"
            aria-pressed={outlineOpen}
            onClick={() => setOutlineOpen((open) => !open)}
          >
            <IconOutline className="h-4 w-4" />
          </button>
          <button type="button" className="mn-doc__icon-btn" title="评论（这个外壳里没有）" disabled>
            <IconComment className="h-4 w-4" />
          </button>
          <button type="button" className="mn-doc__share" title="本地文件，分享不出去" disabled>
            分享
          </button>
          <span className="mn-doc__avatar" title={`作者：${book.author || '未知'}`}>
            {avatarOf(book.author)}
          </span>
          <AppMenu
            items={[
              { label: '阅读设置（主题也在这里）', hint: settingsHotkey, onSelect: props.onOpenSettings },
              {
                label: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗正文）',
                hint: dimHotkey,
                onSelect: props.onToggleDim,
              },
              { label: '全屏', hint: fullscreenHotkey, onSelect: toggleFullscreen },
              { label: '回到云文档首页', separatorBefore: true, onSelect: props.onBack },
            ]}
          />
        </div>
      </header>

      <div className="mn-doc__body">
        {outlineOpen ? (
          <aside className="mn-doc__outline" aria-label="大纲">
            <div className="mn-doc__outline-head">
              <span>大纲</span>
              <span className="mn-doc__outline-count">{props.chapterCount} 章</span>
            </div>
            <div className="mn-doc__outline-list">
              {chapters === undefined ? (
                <p className="mn-office__side-hint">正在读目录…</p>
              ) : (
                chapters.map((row) =>
                  row.type === 'group' ? (
                    <div
                      key={`g-${row.index}-${row.label}`}
                      className="mn-nav-group"
                      style={{ paddingLeft: 14 + row.depth * 12 }}
                    >
                      {row.label}
                    </div>
                  ) : (
                    <NavRow
                      key={row.index}
                      label={row.label}
                      hint={row.charCount ? formatChars(row.charCount) : undefined}
                      active={row.index === props.chapterIndex}
                      onClick={() => props.onChapter(row.index)}
                      className={cx(row.depth > 0 && 'is-sub')}
                    />
                  ),
                )
              )}
            </div>
            <div className="mn-doc__outline-foot">
              <div className="mn-doc__progress" aria-hidden>
                <span style={{ width: `${Math.max(0, Math.min(1, props.percent)) * 100}%` }} />
              </div>
              <div className="mn-doc__progress-text">
                <span>
                  第 {props.chapterIndex + 1}/{props.chapterCount} 章
                </span>
                <span>{formatPercent(props.percent)}</span>
              </div>
              <div className="mn-doc__progress-text">
                <span>本章 {formatChars(props.chapterChars ?? 0)}</span>
                <span>全书 {formatChars(book.totalChars)}</span>
              </div>
            </div>
          </aside>
        ) : null}

        <main className="mn-doc__main">
          <div className="mn-doc__toolbar" role="toolbar" aria-label="格式工具条">
            {toolbar.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(
                  'mn-doc__tool',
                  !toolbarIcons[item.id] && 'mn-doc__tool--text',
                  item.active && 'is-active',
                )}
                title={item.title}
                aria-label={item.title}
                aria-pressed={item.active}
                disabled={item.disabled}
                onClick={item.onClick}
              >
                {toolbarIcons[item.id] ?? <span className="mn-doc__tool-glyph">{item.icon ?? '·'}</span>}
              </button>
            ))}
            <span className="mn-doc__toolbar-gap" />
            <button type="button" className="mn-doc__tool" title="评论（这个外壳里没有）" disabled>
              <IconComment className="h-4 w-4" />
            </button>
            <button type="button" className="mn-doc__tool" title="点赞（这个外壳里没有）" disabled>
              <IconThumbUp className="h-4 w-4" />
            </button>
          </div>
          <div className="mn-doc__canvas mn-veil">{props.children}</div>
        </main>
      </div>
    </div>
  )
}
