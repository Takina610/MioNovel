import { useMemo, useState } from 'react'
import { chapterBlocks } from '../lib/blocks'
import { avatarOf, fileNameFor } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevron, IconClose } from '../components/ui/icons'
import {
  IconAlignJustify,
  IconAlignLeft,
  IconBrush,
  IconBullets,
  IconCopy,
  IconFindReplace,
  IconFontColor,
  IconHighlight,
  IconIndentLeft,
  IconIndentRight,
  IconLineSpacing,
  IconNavPane,
  IconNumbering,
  IconPageView,
  IconPaste,
  IconReadView,
  IconRedo,
  IconRuler,
  IconScissors,
  IconUndo,
} from '../components/ui/app-icons'
import {
  CommentButton,
  NavRow,
  OfficeFrame,
  StatusText,
  fullscreenButton,
  type RibbonTab,
} from './OfficeFrame'
import type { AppFrameProps } from './types'

/** 字体栈在功能区里的显示名：Word 的字号框里写的是字体名，这里照做 */
const FONT_LABELS: Record<string, string> = {
  sans: '等线',
  serif: '宋体',
  kai: '楷体',
  mono: 'Consolas',
}

const FONT_ORDER = ['sans', 'serif', 'kai', 'mono']

/**
 * Word 形态。
 *
 * 版式照 Word 来：标题栏（文件名 + 已保存到这台设备）、页签、功能区、标尺、
 * 灰底上一张白纸、状态栏上「页面 3/12 · 字数 1,234」。白纸和页边距是
 * styles/office.css 里对 .mn-word 的几条规则（`.mn-content` 自己就是那张纸）。
 *
 * 功能区的处理是这套外壳里最花心思的地方，也是决定记录 27 的主题：
 *
 * - **真的会响的**：复制本章文字、字体、增大/缩小字号、行距、首行缩进、两种对齐、
 *   导航窗格、标尺、阅读视图、全屏、摸鱼模式。这些恰好就是 Word 最常用的命令，
 *   也恰好都是这个阅读器本来就有的设置——按下去字真的会变。
 * - **灰着的**：粘贴、剪切、格式刷、加粗、斜体、下划线、删除线、字体颜色、高亮、
 *   项目符号、编号、查找替换、评论。真实的只读文档里它们本来就是灰的，
 *   所以我们**不给它们功能，也不假装能用**。
 * - 「文件」页签 = 回开始屏幕；插入 / 设计 / 布局 / 引用 / 审阅 / 帮助 一律 disabled，
 *   title 里说明这个外壳里只有「开始」和「视图」两页。
 */
export function WordApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth >= 900)
  const [ruler, setRuler] = useState(true)
  const [immersive, setImmersive] = useState(false)

  const copyChapter = () => {
    // 复制的是这一章的正文，纯文本。剪贴板要给就真给，不弹个「已复制」了事
    const text = chapterBlocks(props.chapterHtml ?? '')
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n')
    if (text) void navigator.clipboard.writeText(text)
  }

  const cycleFont = () => {
    const index = FONT_ORDER.indexOf(settings.fontFamily)
    onSettingsChange({ fontFamily: FONT_ORDER[(index + 1) % FONT_ORDER.length] })
  }
  const nudgeFont = (delta: number) =>
    onSettingsChange({ fontSize: Math.max(14, Math.min(34, settings.fontSize + delta)) })
  const cycleSpacing = () => {
    const steps = [1.0, 1.15, 1.5, 2.0, 2.5]
    const next = steps.find((step) => step > settings.lineHeight + 0.01) ?? steps[0]
    onSettingsChange({ lineHeight: next })
  }
  const nudgeIndent = (delta: number) =>
    onSettingsChange({ indent: Math.max(0, Math.min(6, settings.indent + delta)) })

  const homeGroups = useMemo(
    () => [
      {
        label: '剪贴板',
        buttons: [
          { id: 'paste', icon: <IconPaste className="h-5 w-5" />, title: '粘贴（只读文档，没有可粘贴的位置）', disabled: true },
          { id: 'cut', icon: <IconScissors className="h-5 w-5" />, title: '剪切（只读）', disabled: true },
          { id: 'copy', icon: <IconCopy className="h-5 w-5" />, title: '复制这一章的正文', onClick: copyChapter },
          { id: 'brush', icon: <IconBrush className="h-5 w-5" />, title: '格式刷（只读）', disabled: true },
        ],
      },
      {
        label: '字体',
        buttons: [
          {
            id: 'font',
            icon: FONT_LABELS[settings.fontFamily] ?? settings.fontFamily,
            title: `字体：${FONT_LABELS[settings.fontFamily] ?? settings.fontFamily}（点一下换一种）`,
            onClick: cycleFont,
          },
          { id: 'shrink', icon: 'A⁻', title: '缩小字号', disabled: settings.fontSize <= 14, onClick: () => nudgeFont(-1) },
          { id: 'grow', icon: 'A⁺', title: '增大字号', disabled: settings.fontSize >= 34, onClick: () => nudgeFont(1) },
          { id: 'bold', icon: 'B', title: '加粗（正文的粗细不归读者调）', disabled: true },
          { id: 'italic', icon: 'I', title: '斜体（只读）', disabled: true },
          { id: 'underline', icon: 'U', title: '下划线（只读）', disabled: true },
          { id: 'strike', icon: 'S', title: '删除线（只读）', disabled: true },
          { id: 'color', icon: <IconFontColor className="h-5 w-5" />, title: '字体颜色（只读）', disabled: true },
          { id: 'highlight', icon: <IconHighlight className="h-5 w-5" />, title: '文本突出显示颜色（只读）', disabled: true },
        ],
      },
      {
        label: '段落',
        buttons: [
          { id: 'bullets', icon: <IconBullets className="h-5 w-5" />, title: '项目符号（只读）', disabled: true },
          { id: 'numbering', icon: <IconNumbering className="h-5 w-5" />, title: '编号（只读）', disabled: true },
          {
            id: 'outdent',
            icon: <IconIndentLeft className="h-5 w-5" />,
            title: `减少首行缩进（当前 ${settings.indent} 字符）`,
            disabled: settings.indent <= 0,
            onClick: () => nudgeIndent(-0.5),
          },
          {
            id: 'indent',
            icon: <IconIndentRight className="h-5 w-5" />,
            title: `增加首行缩进（当前 ${settings.indent} 字符）`,
            disabled: settings.indent >= 6,
            onClick: () => nudgeIndent(0.5),
          },
          {
            id: 'spacing',
            icon: <IconLineSpacing className="h-5 w-5" />,
            title: `行距：${settings.lineHeight.toFixed(2)}`,
            onClick: cycleSpacing,
          },
          {
            id: 'align-left',
            icon: <IconAlignLeft className="h-5 w-5" />,
            title: '左对齐',
            active: settings.align === 'left',
            onClick: () => onSettingsChange({ align: 'left' }),
          },
          {
            id: 'align-justify',
            icon: <IconAlignJustify className="h-5 w-5" />,
            title: '两端对齐',
            active: settings.align === 'justify',
            onClick: () => onSettingsChange({ align: 'justify' }),
          },
          { id: 'find', icon: <IconFindReplace className="h-5 w-5" />, title: '查找替换（这个外壳里没有）', disabled: true },
        ],
      },
      {
        label: '样式',
        buttons: [
          { id: 'style-body', icon: '正文', title: '样式：正文（文字的比例由阅读设置管）', disabled: true },
          { id: 'style-h1', icon: '标题 1', title: '样式：标题（只读）', disabled: true },
          { id: 'undo', icon: <IconUndo className="h-5 w-5" />, title: '撤销（没有可撤销的操作）', disabled: true },
          { id: 'redo', icon: <IconRedo className="h-5 w-5" />, title: '重做（没有可重做的操作）', disabled: true },
        ],
      },
    ],
    // 这几个按钮的可用状态跟着设置走，设置变了要重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.fontFamily, settings.fontSize, settings.indent, settings.lineHeight, settings.align],
  )

  const viewGroups = useMemo(
    () => [
      {
        label: '视图',
        buttons: [
          {
            id: 'read-view',
            icon: <IconReadView className="h-5 w-5" />,
            title: '阅读视图（收起功能区，按 Esc 回来）',
            active: immersive,
            onClick: () => setImmersive((on) => !on),
          },
          { id: 'page-view', icon: <IconPageView className="h-5 w-5" />, title: '页面视图（当前就是）', active: true, onClick: () => undefined },
        ],
      },
      {
        label: '显示',
        buttons: [
          { id: 'nav-pane', icon: <IconNavPane className="h-5 w-5" />, title: '导航窗格', active: sideOpen, onClick: () => setSideOpen((open) => !open) },
          { id: 'ruler', icon: <IconRuler className="h-5 w-5" />, title: '标尺', active: ruler, onClick: () => setRuler((on) => !on) },
        ],
      },
      {
        label: '窗口',
        buttons: [
          fullscreenButton(),
          {
            id: 'dim',
            icon: '◐',
            title: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗正文区）',
            active: props.dimOn,
            onClick: props.onToggleDim,
          },
        ],
      },
      { label: '批注', buttons: [CommentButton] },
    ],
    [immersive, props.dimOn, props.onToggleDim, ruler, sideOpen],
  )

  const tabs: RibbonTab[] = [
    { id: 'home', label: '开始', groups: homeGroups },
    { id: 'insert', label: '插入', disabled: true },
    { id: 'design', label: '设计', disabled: true },
    { id: 'layout', label: '布局', disabled: true },
    { id: 'refs', label: '引用', disabled: true },
    { id: 'review', label: '审阅', disabled: true },
    { id: 'view', label: '视图', groups: viewGroups },
    { id: 'help', label: '帮助', disabled: true },
  ]

  const chapters = props.chapters
  const side = (
    <div className="mn-office__side-inner">
      <div className="mn-office__side-head">
        <span>导航</span>
        <span className="mn-office__side-sub">
          {props.chapterIndex + 1}/{props.chapterCount} 页
        </span>
      </div>
      <div className="mn-office__side-list">
        {chapters === undefined ? (
          <p className="mn-office__side-hint">正在读目录…</p>
        ) : chapters.length === 0 ? (
          <p className="mn-office__side-hint">这本书没有目录</p>
        ) : (
          chapters.map((row) =>
            row.type === 'group' ? (
              <div
                key={`g-${row.index}-${row.label}`}
                className="mn-nav-group"
                style={{ paddingLeft: 10 + row.depth * 12 }}
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
      <div className="mn-office__side-foot">
        <button
          type="button"
          className="mn-office__side-nav"
          disabled={props.chapterIndex <= 0}
          title="上一章"
          onClick={() => props.onChapter(props.chapterIndex - 1)}
        >
          <IconChevron className="h-4 w-4 rotate-180" />
          上一页
        </button>
        <button
          type="button"
          className="mn-office__side-nav"
          disabled={props.chapterIndex >= props.chapterCount - 1}
          title="下一章"
          onClick={() => props.onChapter(props.chapterIndex + 1)}
        >
          下一页
          <IconChevron className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <OfficeFrame
      fileName={fileNameFor('page', book.title)}
      savedHint="已保存到这台设备"
      avatar={avatarOf(book.author)}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      onBack={props.onBack}
      immersive={immersive}
      band={
        ruler ? (
          <div className="mn-word__ruler-wrap">
            <div className="mn-word__ruler" aria-hidden>
              <span className="mn-word__ruler-margin mn-word__ruler-margin--left" />
              <span className="mn-word__ruler-margin mn-word__ruler-margin--right" />
            </div>
          </div>
        ) : null
      }
      side={side}
      sideOpen={sideOpen}
      statusLeft={
        <>
          <StatusText title="一章就是一页：我们一次只读一章">
            页面 {props.chapterIndex + 1}/{props.chapterCount}
          </StatusText>
          <StatusText title="本章字数 / 全书字数">
            字数 {formatChars(props.chapterChars ?? 0)}/{formatChars(book.totalChars)}
          </StatusText>
          <StatusText>中文(中国)</StatusText>
        </>
      }
      statusRight={
        <>
          <StatusText title="已读">{formatPercent(props.percent)}</StatusText>
        </>
      }
      zoom={settings.fontSize}
      zoomRange={[14, 34]}
      onZoom={(value) => onSettingsChange({ fontSize: value })}
      onOpenSettings={props.onOpenSettings}
      dim={props.dim}
      dimOn={props.dimOn}
      onToggleDim={props.onToggleDim}
    >
      <div className={cx('mn-word__body', immersive && 'is-immersive')}>
        {props.children}
        {immersive ? (
          <>
            <button
              type="button"
              className="mn-word__exit"
              onClick={() => setImmersive(false)}
              title="退出阅读视图（Esc）"
            >
              <IconClose className="h-4 w-4" />
              关闭
            </button>
            <button
              type="button"
              className="mn-word__immersive-nav mn-word__immersive-nav--prev"
              disabled={props.chapterIndex <= 0}
              onClick={() => props.onChapter(props.chapterIndex - 1)}
              title="上一章"
            >
              <IconChevron className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              className="mn-word__immersive-nav mn-word__immersive-nav--next"
              disabled={props.chapterIndex >= props.chapterCount - 1}
              onClick={() => props.onChapter(props.chapterIndex + 1)}
              title="下一章"
            >
              <IconChevron className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
    </OfficeFrame>
  )
}
