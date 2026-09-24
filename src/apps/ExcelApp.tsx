import { useMemo, useState } from 'react'
import { chapterBlocks } from '../lib/blocks'
import { activeRowOf, chapterRows, rowsTotal } from '../lib/sheet'
import { avatarOf, fileNameFor, sheetNameOf } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevron, IconMore } from '../components/ui/icons'
import {
  IconBrush,
  IconCopy,
  IconFill,
  IconFontColor,
  IconFunnel,
  IconGrid,
  IconLineSpacing,
  IconMerge,
  IconPaste,
  IconRedo,
  IconScissors,
  IconSortAZ,
  IconUndo,
  IconWrapText,
} from '../components/ui/app-icons'
import {
  CommentButton,
  OfficeFrame,
  StatusButton,
  StatusText,
  fullscreenButton,
  type RibbonTab,
} from './OfficeFrame'
import type { AppFrameProps } from './types'

/**
 * Excel 形态。
 *
 * 一章 = 一个工作表，一段 = 一行（见 lib/sheet.ts）。界面照 Excel 来：
 * 标题栏、页签、功能区、编辑栏、网格（行号 + A/B/C 列）、底部的工作表标签、
 * 状态栏上「就绪 · 计数 · 缩放 100%」。
 *
 * 三处真东西：
 *
 * 1. **编辑栏与名称框跟着视口走**。名称框写的是「现在正看着的那一行」的地址
 *    （A57），编辑栏里是那一行的原文。Excel 的这两个框认的是「选中的单元格」，
 *    我们没有光标——所以它们的含义明写成「当前行」（见决定记录 27）。
 * 2. **工作表标签就是章**：点标签换章，左下角那对箭头跳第一张 / 上一张 / 下一张 /
 *    最后一张，和 Excel 的行为一样。这个工作簿里不能新建工作表（没有可新建的东西），
 *    所以 + 是灰的，title 里说清楚。
 * 3. **冻结首行**是真的：冻结时表头一直贴着顶端，取消就跟着滚。
 *
 * 功能区的规矩和 Word 一样：会响的按下去屏幕真的变（复制、字体名、自动换行、
 * 排序、筛选入口），只读文档里本就该灰的（粘贴、格式刷、填充、条件格式）是灰的。
 */
export function ExcelApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  const [frozen, setFrozen] = useState(true)
  const [showTabs, setShowTabs] = useState(true)

  const rows = useMemo(
    () =>
      chapterRows(
        chapterBlocks(props.chapterHtml ?? '', {
          media: 'reference',
          resolve: props.resolveMedia,
        }),
        props.chapterTitle,
      ),
    [props.chapterHtml, props.resolveMedia, props.chapterTitle],
  )
  const total = useMemo(() => rowsTotal(rows), [rows])
  const activeRow = activeRowOf(rows, props.chapterPercent)
  const active = rows.find((row) => row.row === activeRow)

  const chapters = props.chapters
  const sheetTabs = useMemo(
    () =>
      (chapters ?? [])
        .filter((row) => row.type === 'chapter')
        .map((row) => ({ index: row.index, name: sheetNameOf(row.label, row.index) })),
    [chapters],
  )

  const copyActive = () => {
    if (active) void navigator.clipboard.writeText(active.text)
  }

  const homeGroups = useMemo(
    () => [
      {
        label: '剪贴板',
        buttons: [
          { id: 'paste', icon: <IconPaste className="h-5 w-5" />, title: '粘贴（只读，没有可粘贴的位置）', disabled: true },
          { id: 'cut', icon: <IconScissors className="h-5 w-5" />, title: '剪切（只读）', disabled: true },
          {
            id: 'copy',
            icon: <IconCopy className="h-5 w-5" />,
            title: `复制当前行的文字（${active?.address ?? 'A1'}）`,
            disabled: !active,
            onClick: copyActive,
          },
          { id: 'brush', icon: <IconBrush className="h-5 w-5" />, title: '格式刷（只读）', disabled: true },
        ],
      },
      {
        label: '字体',
        buttons: [
          {
            id: 'grow',
            icon: 'A⁺',
            title: '增大字号',
            disabled: settings.fontSize >= 34,
            onClick: () => onSettingsChange({ fontSize: Math.min(34, settings.fontSize + 1) }),
          },
          {
            id: 'shrink',
            icon: 'A⁻',
            title: '缩小字号',
            disabled: settings.fontSize <= 10,
            onClick: () => onSettingsChange({ fontSize: Math.max(10, settings.fontSize - 1) }),
          },
          { id: 'bold', icon: 'B', title: '加粗（表格里没有第二个字号体系）', disabled: true },
          { id: 'italic', icon: 'I', title: '斜体（只读）', disabled: true },
          { id: 'color', icon: <IconFontColor className="h-5 w-5" />, title: '字体颜色（只读）', disabled: true },
          { id: 'fill', icon: <IconFill className="h-5 w-5" />, title: '填充颜色（只读）', disabled: true },
        ],
      },
      {
        label: '对齐方式',
        buttons: [
          { id: 'merge', icon: <IconMerge className="h-5 w-5" />, title: '合并后居中（只读）', disabled: true },
          { id: 'wrap', icon: <IconWrapText className="h-5 w-5" />, title: '自动换行（表格本来就换行）', disabled: true },
          {
            id: 'spacing',
            icon: <IconLineSpacing className="h-5 w-5" />,
            title: `行距：${settings.lineHeight.toFixed(2)}（点一下换下一档）`,
            onClick: () => {
              const steps = [1.0, 1.15, 1.3, 1.45, 1.7]
              const next = steps.find((step) => step > settings.lineHeight + 0.01) ?? steps[0]
              onSettingsChange({ lineHeight: next })
            },
          },
          {
            id: 'left',
            icon: '左',
            title: '左对齐',
            active: settings.align === 'left',
            onClick: () => onSettingsChange({ align: 'left' }),
          },
          {
            id: 'justify',
            icon: '两',
            title: '两端对齐',
            active: settings.align === 'justify',
            onClick: () => onSettingsChange({ align: 'justify' }),
          },
        ],
      },
      {
        label: '数字',
        buttons: [
          { id: 'currency', icon: '¥', title: '货币（只读）', disabled: true },
          { id: 'percent', icon: '%', title: '百分比（只读）', disabled: true },
          { id: 'comma', icon: ',', title: '千位分隔符（只读）', disabled: true },
        ],
      },
      {
        label: '编辑',
        buttons: [
          { id: 'sum', icon: 'Σ', title: `这一列的和：${total} 字`, disabled: true },
          { id: 'sort', icon: <IconSortAZ className="h-5 w-5" />, title: '排序（书籍列表在开始屏幕里排）', disabled: true },
          { id: 'filter', icon: <IconFunnel className="h-5 w-5" />, title: '筛选（这个外壳里没有）', disabled: true },
          { id: 'grid', icon: <IconGrid className="h-5 w-5" />, title: '边框（网格线本来就是画的）', disabled: true },
          { id: 'undo', icon: <IconUndo className="h-5 w-5" />, title: '撤销（没有可撤销的操作）', disabled: true },
          { id: 'redo', icon: <IconRedo className="h-5 w-5" />, title: '重做（没有可重做的操作）', disabled: true },
        ],
      },
    ],
    // 这几个按钮的可用状态和文案跟着当前行 / 设置走
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, total, settings.align, settings.fontSize, settings.lineHeight],
  )

  const viewGroups = useMemo(
    () => [
      {
        label: '工作簿视图',
        buttons: [
          {
            id: 'freeze',
            icon: '冻结',
            title: frozen ? '取消冻结首行' : '冻结首行（表头一直看得见）',
            active: frozen,
            onClick: () => setFrozen((on) => !on),
          },
          {
            id: 'tabs',
            icon: '标签',
            title: showTabs ? '隐藏工作表标签' : '显示工作表标签',
            active: showTabs,
            onClick: () => setShowTabs((on) => !on),
          },
        ],
      },
      {
        label: '显示',
        buttons: [
          {
            id: 'compact',
            icon: '窄',
            title: '窄栏（把正文列收窄，一屏看得更多）',
            active: settings.contentWidth <= 40,
            onClick: () => onSettingsChange({ contentWidth: settings.contentWidth <= 40 ? 64 : 40 }),
          },
          { id: 'formula', icon: 'fx', title: '编辑栏（一直在）', active: true, onClick: () => undefined },
        ],
      },
      {
        label: '窗口',
        buttons: [
          fullscreenButton(),
          {
            id: 'dim',
            icon: '◐',
            title: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗网格）',
            active: props.dimOn,
            onClick: props.onToggleDim,
          },
        ],
      },
      { label: '批注', buttons: [CommentButton] },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frozen, showTabs, props.dimOn, props.onToggleDim, settings.contentWidth],
  )

  const tabs: RibbonTab[] = [
    { id: 'home', label: '开始', groups: homeGroups },
    { id: 'insert', label: '插入', disabled: true },
    { id: 'layout', label: '页面布局', disabled: true },
    { id: 'formulas', label: '公式', disabled: true },
    { id: 'data', label: '数据', disabled: true },
    { id: 'review', label: '审阅', disabled: true },
    { id: 'view', label: '视图', groups: viewGroups },
  ]

  return (
    <OfficeFrame
      fileName={fileNameFor('sheet', book.title)}
      savedHint="已保存到这台设备"
      avatar={avatarOf(book.author)}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      onBack={props.onBack}
      band={
        <div className="mn-formula">
          <span className="mn-formula__name" title="当前行的单元格地址">
            {active?.address ?? `A${3}`}
          </span>
          <span className="mn-formula__fx" aria-hidden>
            fx
          </span>
          <span className="mn-formula__box" title={active?.text ?? ''}>
            {active?.text ?? ''}
          </span>
        </div>
      }
      footBand={
        showTabs ? (
          <div className="mn-tabsbar">
            <div className="mn-tabsbar__nav">
              <button
                type="button"
                title="第一张工作表"
                disabled={props.chapterIndex <= 0}
                onClick={() => props.onChapter(0)}
              >
                <IconChevron className="h-3 w-3 rotate-180" />
                <IconChevron className="h-3 w-3 rotate-180 -ml-1.5" />
              </button>
              <button
                type="button"
                title="上一张工作表"
                disabled={props.chapterIndex <= 0}
                onClick={() => props.onChapter(props.chapterIndex - 1)}
              >
                <IconChevron className="h-3 w-3 rotate-180" />
              </button>
              <button
                type="button"
                title="下一张工作表"
                disabled={props.chapterIndex >= props.chapterCount - 1}
                onClick={() => props.onChapter(props.chapterIndex + 1)}
              >
                <IconChevron className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="最后一张工作表"
                disabled={props.chapterIndex >= props.chapterCount - 1}
                onClick={() => props.onChapter(props.chapterCount - 1)}
              >
                <IconChevron className="h-3 w-3" />
                <IconChevron className="h-3 w-3 -ml-1.5" />
              </button>
            </div>
            <div className="mn-tabsbar__list">
              {sheetTabs.length === 0 ? (
                <span className="mn-tabsbar__empty">
                  {chapters === undefined ? '正在读目录…' : '这张工作簿只有一章'}
                </span>
              ) : (
                sheetTabs.map((sheet) => (
                  <button
                    key={sheet.index}
                    type="button"
                    className={cx('mn-sheet-tab', sheet.index === props.chapterIndex && 'is-active')}
                    title={sheet.name}
                    aria-current={sheet.index === props.chapterIndex}
                    onClick={() => props.onChapter(sheet.index)}
                  >
                    {sheet.name}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              className="mn-tabsbar__new"
              title="这个工作簿里加不出新的工作表——一章就是一张"
              disabled
            >
              ＋
            </button>
          </div>
        ) : null
      }
      statusLeft={
        <>
          <StatusText>就绪</StatusText>
          <StatusText title={`这一列共 ${rows.length} 行`}>计数: {rows.length}</StatusText>
          <StatusText title={`这一列的和：${total} 字`}>求和: {formatChars(total)}</StatusText>
          <StatusText className="max-sm:hidden" title="一章就是一张工作表">
            工作表 {props.chapterIndex + 1}/{props.chapterCount}
          </StatusText>
        </>
      }
      statusRight={
        <>
          <StatusText title="已读">{formatPercent(props.percent)}</StatusText>
          <StatusButton title="打开阅读设置" onClick={props.onOpenSettings}>
            <IconMore className="h-3.5 w-3.5" />
          </StatusButton>
        </>
      }
      zoom={settings.fontSize}
      zoomRange={[10, 34]}
      onZoom={(value) => onSettingsChange({ fontSize: value })}
      onOpenSettings={props.onOpenSettings}
      dim={props.dim}
      dimOn={props.dimOn}
      onToggleDim={props.onToggleDim}
    >
      {/* 正文（网格）由 ReaderView 渲染——它管着滚动容器和进度，外壳只画框。
          「冻结首行」落成这里的一个 data 属性：表头贴着顶端还是跟着滚由 CSS 决定
          （见 apps.css 里 .mn-excel__body[data-frozen] 那条）。两块共用同一份
          chapterBlocks / chapterRows 结果——纯函数，算两遍结果也一样 */}
      <div className="mn-excel__body" data-frozen={frozen ? 'true' : 'false'}>
        {props.children}
      </div>
    </OfficeFrame>
  )
}
