import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chapterBlocks } from '../lib/blocks'
import { clearFinds, markFinds, revealFind } from '../lib/find'
import { activeRowOf, chapterRows, rowsTotal } from '../lib/sheet'
import { EXCEL_TABS, avatarOf, fileNameFor, sheetNameOf } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { toggleFullscreen } from '../lib/fullscreen'
import { cx } from '../lib/cx'
import { IconChevron, IconClose, IconSearch } from '../components/ui/icons'
import {
  IconAddinGrid,
  IconAdvFilter,
  IconAiHelper,
  IconAlignBottom,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignMiddle,
  IconAlignRight,
  IconAlignTop,
  IconBatchDelete,
  IconBorders,
  IconBrush,
  IconCellDelete,
  IconCellFormat,
  IconCellInsert,
  IconCellStyles,
  IconClearAll,
  IconComment,
  IconCondFormat,
  IconCopy,
  IconCurrency,
  IconCustomViews,
  IconDecimalDown,
  IconDecimalUp,
  IconExcelMark,
  IconFill,
  IconFillDown,
  IconFindEntry,
  IconFocus,
  IconFontColor,
  IconFontGrow,
  IconFontShrink,
  IconFormulaBar,
  IconFreezePanes,
  IconFullscreen,
  IconGridLines,
  IconImageToText,
  IconIndentLeft,
  IconIndentRight,
  IconMerge,
  IconNormalView,
  IconOrientation,
  IconPageBreakView,
  IconPageLayoutView,
  IconPaste,
  IconPdfConvert,
  IconPhoneticGuide,
  IconRedo,
  IconSaveFloppy,
  IconScissors,
  IconShare,
  IconSheetHeaders,
  IconSheetTab,
  IconSortFilter,
  IconSplitMerge,
  IconTableBeautify,
  IconTableStyle,
  IconTemplateDoc,
  IconTextExtract,
  IconUndo,
  IconVlookup,
  IconWrapAb,
  IconZoom100,
} from '../components/ui/app-icons'
import {
  AppMenu,
  OfficeFrame,
  StatusText,
  type RibbonGroup,
  type RibbonItem,
  type RibbonTab,
} from './OfficeFrame'
import type { AppFrameProps } from './types'

/** 字体栈在功能区里的显示名：Excel 的字体框里写的是字体名，这里照做 */
const FONT_LABELS: Record<string, string> = {
  sans: '等线',
  serif: '宋体',
  kai: '楷体',
  mono: 'Consolas',
}
const FONT_ORDER = ['sans', 'serif', 'kai', 'mono']
/** 字号框里给得出来的那几档（和设置面板同一个区间） */
const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 34]
/** 数字格式那几档（Excel 的下拉里有十来项，这里给常用的一半） */
const NUMBER_FORMATS = ['常规', '数值', '货币', '会计专用', '短日期', '长日期', '百分比', '分数', '文本']
/** 缩放下拉里给得出来的那几档字号（百分比 = 字号 ÷ 16，和三件套同一个口径） */
const ZOOM_STEPS = [14, 16, 20, 24, 28, 32]

/**
 * Excel 形态。
 *
 * 一章 = 一个工作表，一段 = 一行（见 lib/sheet.ts）。界面照桌面版 Excel 摆：
 * 标题栏（自动保存 + 快速访问工具栏 + 搜索框 + 升级计划）、一排页签（右端是
 * 批注与共享）、十组格子的功能区、编辑栏（名称框 + ✕ ✓ fx + 编辑栏本体）、
 * 网格（A/B/C 列标题 + 行号）、底部的工作表标签条、状态栏。
 *
 * 尺寸和颜色是照着 2026-09-24 那两张截图量的（1917×1006 的工作簿与
 * 1920×1079 的开始屏幕），数都写在 styles/excel.css 开头的注释里。
 *
 * 四处真东西（沿用决定记录 27 划的那条线）：
 *
 * 1. **编辑栏与名称框跟着视口走**。名称框写的是「现在正看着的那一行」的地址
 *    （A57），编辑栏里是那一行的原文。Excel 的这两个框认的是「选中的单元格」，
 *    我们没有光标——所以它们的含义明写成「当前行」。✕ 与 ✓ 在真 Excel 里是
 *    「取消 / 输入」这一次编辑，这里没有可编辑的东西，所以它们灰着。
 * 2. **工作表标签就是章**：点标签换章，左下角那对箭头跳上一张 / 下一张，
 *    右边那个 ⋮ 列出全部工作表（几百章的书里一格一格翻不是办法）。这个工作簿里
 *    加不出新的工作表（一章就是一张），所以 ＋ 是灰的，title 里说清楚。
 * 3. **网格线 / 编辑栏 / 行列标题 / 标签条 / 冻结首行 / 编辑栏展开都是真开关**
 *    （视图页签里那几个），按下去屏幕上真的少一条东西。
 * 4. **标题栏那个搜索框真的能搜**：在本工作表里找，命中的格子套一层标记
 *    （lib/find.ts，和 Word 那个搜索框同一份实现）。
 *
 * 功能区的规矩和 Word 一样：会响的按下去屏幕真的变（复制、字体、字号、行距、
 * 对齐、缩进、冻结、标签、全屏、摸鱼、查找），只读工作簿里本就该灰的
 * （粘贴、剪切、加粗、条件格式、筛选、六格便捷工具、三个加载项……）一律
 * disabled + title 说清为什么。
 */
export function ExcelApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  const [frozen, setFrozen] = useState(true)
  const [showTabs, setShowTabs] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showBar, setShowBar] = useState(true)
  const [showHead, setShowHead] = useState(true)
  /** 编辑栏是否摊成三行（真 Excel 里那个 ˅ 记号和 Ctrl+Shift+U 干的就是这件事） */
  const [barTall, setBarTall] = useState(false)
  /** 数字格式框里显示的那一项。它**不是**设置：这一层改不了真正的数字格式 */
  const [numberFormat, setNumberFormat] = useState(NUMBER_FORMATS[0])

  // ---- 查找：标题栏那个搜索框与编辑组里的「查找和选择」共用同一份状态 ----
  const bodyRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLElement[]>([])
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState({ total: 0, at: 0 })
  /** 当前落在第几处（1 起）。和 hit 并行一份 ref：翻上/下一处要读到「现在这一处」 */
  const hitRef = useRef(0)

  useEffect(() => {
    const root = bodyRef.current?.querySelector<HTMLElement>('.mn-sheet')
    if (!root) return
    let cancelled = false
    let timer = 0
    let attempts = 0
    const apply = () => {
      if (cancelled) return
      // 换章时网格要晚一拍才换上来（ReaderView 在等图片资源）。还是空的就再等
      if (query.trim() && !root.textContent?.trim() && attempts < 10) {
        attempts++
        timer = window.setTimeout(apply, 120)
        return
      }
      const marks = markFinds(root, query)
      marksRef.current = marks
      hitRef.current = marks.length ? 1 : 0
      setHit({ total: marks.length, at: hitRef.current })
      marks.forEach((mark, index) => revealFind(mark, index === 0))
    }
    timer = window.setTimeout(apply, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, props.chapterIndex, props.chapterHtml])

  const stepHit = (delta: number) => {
    const marks = marksRef.current
    if (marks.length === 0) return
    const at = ((hitRef.current - 1 + delta + marks.length) % marks.length) + 1
    hitRef.current = at
    marks.forEach((mark, index) => revealFind(mark, index === at - 1))
    setHit({ total: marks.length, at })
  }

  // 离开这个外壳（换主题）时把标记清干净：正文那块 DOM 是 React 的，换外壳时
  // **可能被下一个外壳接着用**（html 字符串没变，React 不重写 innerHTML），
  // 那样搜索框没了、标记还留在网格里。和 WordApp 同一处理（见决定记录 34）
  useEffect(() => {
    const body = bodyRef.current
    return () => {
      const sheet = body?.querySelector<HTMLElement>('.mn-sheet')
      if (sheet) clearFinds(sheet)
    }
  }, [])

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

  const nudgeFont = (delta: number) =>
    onSettingsChange({ fontSize: Math.max(10, Math.min(34, settings.fontSize + delta)) })

  const nudgeIndent = (delta: number) =>
    onSettingsChange({ indent: Math.max(0, Math.min(3, settings.indent + delta)) })

  /* ---- 开始页签上那十组格子。顺序照截图：剪贴板 / 字体 / 对齐方式 / 数字 /
     OfficePLUS / 样式 / 单元格 / 编辑 / 便捷工具 / 加载项 ---- */
  const homeGroups = useMemo<RibbonGroup[]>(() => {
    /** Excel 的「小格子」：图标 + 可选的字 + 右边一个小三角（一半格子长这样） */
    const cell = (
      id: string,
      icon: ReactNode,
      title: string,
      extra: Partial<RibbonItem> = {},
    ): RibbonItem => ({ id, kind: 'small', dense: true, icon, title, ...extra })
    /** 图标在上、字在下的大格子（OfficePLUS 与样式组那一排） */
    const tile = (
      id: string,
      icon: ReactNode,
      label: ReactNode,
      title: string,
      extra: Partial<RibbonItem> = {},
    ): RibbonItem => ({ id, kind: 'big', icon, label, title, ...extra })
    const shared = (id: string, icon: ReactNode, label: ReactNode, title: string): RibbonItem => ({
      id,
      kind: 'small',
      dense: true,
      icon,
      label,
      title,
      disabled: true,
    })

    const fontLabel = FONT_LABELS[settings.fontFamily] ?? settings.fontFamily

    return [
      {
        label: '剪贴板',
        launcher: true,
        rows: [
          [
            {
              id: 'paste',
              kind: 'big',
              icon: <IconPaste />,
              label: '粘贴',
              menu: true,
              disabled: true,
              title: '粘贴（只读工作簿，没有可粘贴的位置）',
            },
            {
              id: 'clip',
              kind: 'column',
              items: [
                cell('cut', <IconScissors />, '剪切（只读）', { menu: true, disabled: true }),
                cell('copy', <IconCopy />, `复制当前行的文字（${active?.address ?? 'A1'}）`, {
                  menu: true,
                  disabled: !active,
                  onClick: copyActive,
                }),
                cell('brush', <IconBrush />, '格式刷（只读）', { menu: true, disabled: true }),
              ],
            },
          ],
        ],
      },
      {
        label: '字体',
        launcher: true,
        rows: [
          [
            {
              id: 'font',
              kind: 'node',
              node: (
                <AppMenu
                  label={`字体：${fontLabel}`}
                  trigger={
                    <span className="mn-xc mn-xc--font">
                      <span className="mn-xc__value">{fontLabel}</span>
                      <IconChevron className="mn-xc__caret" />
                    </span>
                  }
                  items={FONT_ORDER.map((id) => ({
                    label: FONT_LABELS[id],
                    checked: settings.fontFamily === id,
                    onSelect: () => onSettingsChange({ fontFamily: id }),
                  }))}
                />
              ),
            },
            {
              id: 'size',
              kind: 'node',
              node: (
                <AppMenu
                  label="字号"
                  trigger={
                    <span className="mn-xc mn-xc--size" title={`字号：${settings.fontSize}`}>
                      <span className="mn-xc__value">{settings.fontSize}</span>
                      <IconChevron className="mn-xc__caret" />
                    </span>
                  }
                  items={FONT_SIZES.map((size) => ({
                    label: String(size),
                    checked: settings.fontSize === size,
                    onSelect: () => onSettingsChange({ fontSize: size }),
                  }))}
                />
              ),
            },
            cell('grow', <IconFontGrow />, '增大字号', {
              disabled: settings.fontSize >= 34,
              onClick: () => nudgeFont(1),
            }),
            cell('shrink', <IconFontShrink />, '缩小字号', {
              disabled: settings.fontSize <= 10,
              onClick: () => nudgeFont(-1),
            }),
          ],
          [
            { id: 'bold', kind: 'text', icon: 'B', dense: true, title: '加粗（正文的粗细不归读者调）', disabled: true },
            { id: 'italic', kind: 'text', icon: 'I', dense: true, title: '斜体（只读）', disabled: true },
            { id: 'underline', kind: 'text', icon: 'U', dense: true, menu: true, title: '下划线（只读）', disabled: true },
            { id: 'f1', kind: 'rule' },
            cell('border', <IconBorders />, '边框（只读）', { menu: true, disabled: true }),
            { id: 'f2', kind: 'rule' },
            cell('paint', <IconFill />, '填充颜色（只读）', { menu: true, disabled: true }),
            { id: 'f3', kind: 'rule' },
            cell('color', <IconFontColor />, '字体颜色（只读）', { menu: true, disabled: true }),
            { id: 'f4', kind: 'rule' },
            cell('phonetic', <IconPhoneticGuide />, '拼音指南（只读）', { menu: true, disabled: true }),
          ],
        ],
      },
      {
        label: '对齐方式',
        launcher: true,
        rows: [
          [
            cell('align-left', <IconAlignLeft />, '左对齐', {
              kind: 'icon',
              active: settings.align === 'left',
              onClick: () => onSettingsChange({ align: 'left' }),
            }),
            // 居中与右对齐灰着：这个阅读器只有左对齐与两端对齐两种（设置面板里也是）
            {
              id: 'align-center',
              kind: 'icon',
              dense: true,
              icon: <IconAlignCenter />,
              disabled: true,
              title: '居中（正文只有左对齐与两端对齐）',
            },
            {
              id: 'align-right',
              kind: 'icon',
              dense: true,
              icon: <IconAlignRight />,
              disabled: true,
              title: '右对齐（正文只有左对齐与两端对齐）',
            },
            cell('orientation', <IconOrientation />, '文字方向（只读）', { menu: true, disabled: true }),
            { id: 'a1', kind: 'rule' },
            cell('wrap', <IconWrapAb />, '自动换行（表格本来就换行）', { menu: true, disabled: true }),
            // 「两端对齐」这一格**故意没有**：真 Excel 的开始页签里也没有它
            // （它在「设置单元格格式 → 对齐」里）。这一屏的左对齐按真实的
            // settings.align 点亮/熄灭，所以选了「两端对齐」时这里没有一格是亮的——
            // 那是实话：Excel 那一排只认左 / 中 / 右。要换它去阅读设置（⋯），
            // Word 那一屏的功能区里也有这一格
          ],
          [
            { id: 'align-top', kind: 'icon', dense: true, icon: <IconAlignTop />, disabled: true, title: '顶端对齐（格子的对齐归表格）' },
            { id: 'align-middle', kind: 'icon', dense: true, icon: <IconAlignMiddle />, disabled: true, title: '垂直居中（格子的对齐归表格）' },
            { id: 'align-bottom', kind: 'icon', dense: true, icon: <IconAlignBottom />, disabled: true, title: '底端对齐（格子的对齐归表格）' },
            { id: 'a2', kind: 'rule' },
            cell('indent-cut', <IconIndentLeft />, `减少首行缩进（现在 ${settings.indent} 字符）`, {
              kind: 'icon',
              disabled: settings.indent <= 0,
              onClick: () => nudgeIndent(-0.5),
            }),
            cell('indent-add', <IconIndentRight />, `增加首行缩进（现在 ${settings.indent} 字符）`, {
              kind: 'icon',
              disabled: settings.indent >= 3,
              onClick: () => nudgeIndent(0.5),
            }),
            { id: 'a3', kind: 'rule' },
            cell('merge', <IconMerge />, '合并后居中（只读）', { menu: true, disabled: true }),
          ],
        ],
      },
      {
        label: '数字',
        launcher: true,
        rows: [
          [
            {
              id: 'number-format',
              kind: 'node',
              node: (
                <AppMenu
                  label="数字格式"
                  trigger={
                    <span className="mn-xc mn-xc--format">
                      <span className="mn-xc__value">{numberFormat}</span>
                      <IconChevron className="mn-xc__caret" />
                    </span>
                  }
                  items={NUMBER_FORMATS.map((format) => ({
                    label: format,
                    checked: numberFormat === format,
                    onSelect: () => setNumberFormat(format),
                  }))}
                />
              ),
            },
          ],
          [
            cell('currency', <IconCurrency />, '货币（只读）', { menu: true, disabled: true }),
            { id: 'percent', kind: 'text', icon: '%', dense: true, disabled: true, title: '百分比（只读）' },
            { id: 'comma', kind: 'text', icon: ',', dense: true, disabled: true, title: '千位分隔符（只读）' },
            cell('dec-more', <IconDecimalUp />, '增加小数位数（只读）', { disabled: true }),
            cell('dec-less', <IconDecimalDown />, '减少小数位数（只读）', { disabled: true }),
          ],
        ],
      },
      {
        label: 'OfficePLUS',
        rows: [
          [
            tile('ai', <IconAiHelper />, 'AI 助手', 'AI 助手（这个外壳里没有）', { disabled: true }),
            tile('tpl', <IconTemplateDoc />, '模板', '模板（这个外壳里没有）', { disabled: true }),
            tile('beautify', <IconTableBeautify />, '表格美化', '表格美化（这个外壳里没有）', { disabled: true }),
          ],
        ],
      },
      {
        label: '样式',
        launcher: true,
        rows: [
          [
            tile('cond', <IconCondFormat />, '条件格式', '条件格式（只读）', { menu: true, disabled: true }),
            tile(
              'table-style',
              <IconTableStyle />,
              <>
                套用
                <br />
                表格格式
              </>,
              '套用表格格式（只读）',
              { menu: true, disabled: true },
            ),
            tile('cell-style', <IconCellStyles />, '单元格样式', '单元格样式（只读）', { menu: true, disabled: true }),
          ],
        ],
      },
      {
        label: '单元格',
        rows: [
          [
            {
              id: 'cell-ops',
              kind: 'column',
              items: [
                cell('insert-cell', <IconCellInsert />, '插入单元格（只读）', { label: '插入', menu: true, disabled: true }),
                cell('delete-cell', <IconCellDelete />, '删除单元格（只读）', { label: '删除', menu: true, disabled: true }),
                cell('format-cell', <IconCellFormat />, '单元格格式（只读）', { label: '格式', menu: true, disabled: true }),
              ],
            },
          ],
        ],
      },
      {
        label: '编辑',
        rows: [
          [
            {
              id: 'edit-ops',
              kind: 'column',
              items: [
                {
                  id: 'sum',
                  kind: 'text',
                  icon: 'Σ',
                  dense: true,
                  menu: true,
                  disabled: true,
                  title: `自动求和（这一列 ${formatChars(total)}；只读工作簿里插不进公式）`,
                },
                cell('fill', <IconFillDown />, '填充（只读）', { menu: true, disabled: true }),
                cell('clear', <IconClearAll />, '清除（只读）', { menu: true, disabled: true }),
              ],
            },
            cell('sort-filter', <IconSortFilter />, '排序和筛选（书籍列表在开始屏幕里排）', {
              label: '排序和筛选',
              menu: true,
              disabled: true,
            }),
            cell('find-select', <IconSearch />, '查找（在本工作表里找）', {
              label: '查找和选择',
              menu: true,
              onClick: () => searchRef.current?.focus(),
            }),
          ],
        ],
      },
      {
        label: '便捷工具',
        rows: [
          [
            /* 这三列各自成摞（第一列三格、第二列两格、第三列一格），
               摞与摞在行里居中——截图里就是这么摆的 */
            {
              id: 'tools-ops',
              kind: 'column',
              items: [
                shared('adv-filter', <IconAdvFilter />, '高级筛选', '高级筛选（加载项，这个外壳里没有）'),
                shared('text-extract', <IconTextExtract />, '文本提取', '文本提取（加载项，这个外壳里没有）'),
                shared('batch-del', <IconBatchDelete />, '批量删除', '批量删除（加载项，这个外壳里没有）'),
              ],
            },
            {
              id: 'tools-find',
              kind: 'column',
              items: [
                {
                  id: 'find-entry',
                  kind: 'small',
                  dense: true,
                  icon: <IconFindEntry />,
                  label: '查找录入',
                  menu: true,
                  disabled: true,
                  title: '查找录入（加载项，这个外壳里没有）',
                },
                shared('vlookup', <IconVlookup />, 'VLOOKUP', 'VLOOKUP（加载项，这个外壳里没有）'),
              ],
            },
            {
              id: 'tools-split',
              kind: 'column',
              items: [
                {
                  id: 'split-merge',
                  kind: 'small',
                  dense: true,
                  icon: <IconSplitMerge />,
                  label: (
                    <>
                      拆分合并
                      <br />
                      表格
                    </>
                  ),
                  menu: true,
                  disabled: true,
                  title: '拆分合并表格（加载项，这个外壳里没有）',
                },
              ],
            },
          ],
        ],
      },
      {
        label: '加载项',
        rows: [
          [
            tile(
              'addin',
              <IconAddinGrid />,
              <>
                加
                <br />
                载项
              </>,
              '加载项（这个外壳里没有）',
              { disabled: true },
            ),
          ],
        ],
      },
      {
        label: 'OfficePLUS',
        rows: [
          [
            tile(
              'img2text',
              <IconImageToText />,
              <>
                图片转
                <br />
                文字
              </>,
              '图片转文字（这个外壳里没有）',
              { menu: true, disabled: true },
            ),
            tile('pdf', <IconPdfConvert />, 'PDF转换', 'PDF转换（这个外壳里没有）', { menu: true, disabled: true }),
          ],
        ],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    total,
    numberFormat,
    settings.align,
    settings.fontSize,
    settings.fontFamily,
    settings.indent,
  ])

  /**
   * 视图页签。四组照桌面版 Excel 的截图摆：工作簿视图 / 显示 / 显示比例 / 窗口。
   *
   * 哪几格是真的：网格线、编辑栏、行列标题、工作表标签、冻结窗格（五个都是
   * 真开关，按下去屏幕上真的少一条东西）、缩放下拉与 100%、全屏、摸鱼模式。
   * 灰的是页面布局 / 分页预览 / 自定义视图——表格形态里没有「纸」，也没有
   * 存下来的视图。
   */
  const viewGroups = useMemo<RibbonGroup[]>(() => {
    const pct = Math.round((settings.fontSize / 16) * 100)
    const toggle = (
      id: string,
      icon: ReactNode,
      label: string,
      on: boolean,
      flip: () => void,
      onTitle: string,
      offTitle: string,
    ): RibbonItem => ({
      id,
      kind: 'stack',
      icon,
      label,
      active: on,
      title: on ? onTitle : offTitle,
      onClick: flip,
    })

    return [
      {
        label: '工作簿视图',
        rows: [
          [
            {
              id: 'normal',
              kind: 'stack',
              icon: <IconNormalView />,
              label: '普通',
              active: true,
              title: '普通视图（一章就是一张工作表）',
              onClick: () => undefined,
            },
            { id: 'layout-view', kind: 'stack', icon: <IconPageLayoutView />, label: '页面布局', disabled: true, title: '页面布局（表格形态里没有纸）' },
            { id: 'break-view', kind: 'stack', icon: <IconPageBreakView />, label: '分页预览', disabled: true, title: '分页预览（表格形态里不分页）' },
            { id: 'custom-view', kind: 'stack', icon: <IconCustomViews />, label: '自定义视图', disabled: true, title: '自定义视图（这个外壳里没有）' },
          ],
        ],
      },
      {
        label: '显示',
        rows: [
          [
            toggle('gridlines', <IconGridLines />, '网格线', showGrid, () => setShowGrid((on) => !on), '隐藏网格线', '显示网格线'),
            toggle('formula-bar', <IconFormulaBar />, '编辑栏', showBar, () => setShowBar((on) => !on), '隐藏编辑栏', '显示编辑栏'),
            toggle('headers', <IconSheetHeaders />, '标题', showHead, () => setShowHead((on) => !on), '隐藏行列标题', '显示行列标题'),
            toggle('sheet-tabs', <IconSheetTab />, '标签', showTabs, () => setShowTabs((on) => !on), '隐藏工作表标签', '显示工作表标签'),
            { id: 'v1', kind: 'rule' },
            toggle('freeze', <IconFreezePanes />, '冻结窗格', frozen, () => setFrozen((on) => !on), '取消冻结首行', '冻结首行（表头一直看得见）'),
          ],
        ],
      },
      {
        label: '显示比例',
        rows: [
          [
            {
              id: 'zoom-label',
              kind: 'node',
              node: (
                <span className="mn-rb__static" aria-hidden>
                  <span className="mn-rb__label">缩放:</span>
                </span>
              ),
            },
            {
              id: 'zoom',
              kind: 'node',
              node: (
                <AppMenu
                  label="缩放"
                  trigger={
                    <span className="mn-xc mn-xc--zoom" title={`缩放：${pct}%`}>
                      <span className="mn-xc__value">{pct}%</span>
                      <IconChevron className="mn-xc__caret" />
                    </span>
                  }
                  items={ZOOM_STEPS.map((step) => ({
                    label: `${Math.round((step / 16) * 100)}%`,
                    checked: settings.fontSize === step,
                    onSelect: () => onSettingsChange({ fontSize: step }),
                  }))}
                />
              ),
            },
            {
              id: 'zoom-100',
              kind: 'stack',
              icon: <IconZoom100 />,
              label: '100%',
              disabled: settings.fontSize === 16,
              title: '缩放到 100%（正文字号 16）',
              onClick: () => onSettingsChange({ fontSize: 16 }),
            },
          ],
        ],
      },
      {
        label: '窗口',
        rows: [
          [
            {
              id: 'fullscreen',
              kind: 'stack',
              icon: <IconFullscreen />,
              label: '全屏',
              title: '全屏',
              onClick: toggleFullscreen,
            },
            {
              // 摸鱼不露字（用户要求：外壳的屏幕上不出现这几个字，它只在下拉和
              // 设置弹窗里露面）。这里留一颗纯图标：点一下调暗网格，悬停有说明
              id: 'dim',
              kind: 'icon',
              icon: <IconFocus />,
              active: props.dimOn,
              title: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗网格）',
              onClick: props.onToggleDim,
            },
          ],
        ],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGrid, showBar, showHead, showTabs, frozen, props.dimOn, props.onToggleDim, settings.fontSize])

  const tabs: RibbonTab[] = EXCEL_TABS.map((item) =>
    item.id === 'home'
      ? { id: item.id, label: item.label, groups: homeGroups }
      : item.id === 'view'
        ? { id: item.id, label: item.label, groups: viewGroups }
        : { id: item.id, label: item.label, disabled: item.disabled },
  )

  return (
    <OfficeFrame
      fileName={`${fileNameFor('sheet', book.title)} - Excel`}
      savedHint="已保存到这台设备"
      avatar={avatarOf(book.author)}
      brand={<IconExcelMark className="mn-office__brand-icon" />}
      titleTools={
        <>
          {/* 本地文件的改动本来就落在这台设备上，没有要同步的云——所以这个开关
              是灰的，而且停在「关」：截图里的 Excel 也是关着的 */}
          <span className="mn-office__autosave" title="自动保存（本地文件不上云，没有要同步的东西）">
            自动保存
            <span className="mn-office__switch" aria-hidden>
              <span className="mn-office__switch-knob" />
              关
            </span>
          </span>
          <button type="button" className="mn-office__title-btn" disabled title="保存（只读工作簿，没有要保存的改动）">
            <IconSaveFloppy className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="撤销（没有可撤销的操作）">
            <IconUndo className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="重做（没有可重做的操作）">
            <IconRedo className="h-[18px] w-[18px]" />
          </button>
        </>
      }
      titleCenter={
        <div className="mn-xsearch">
          <IconSearch className="mn-xsearch__icon" />
          <input
            ref={searchRef}
            value={query}
            placeholder="搜索"
            aria-label="在本工作表里查找"
            title="在本工作表里查找"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                stepHit(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') {
                setQuery('')
                searchRef.current?.blur()
              }
            }}
          />
          {query.trim() ? (
            <>
              <span className="mn-xsearch__count">
                {hit.total ? `${hit.at}/${hit.total}` : '没有匹配'}
              </span>
              <button
                type="button"
                className="mn-xsearch__btn"
                disabled={hit.total === 0}
                title="上一处"
                onClick={() => stepHit(-1)}
              >
                <IconChevron className="h-3.5 w-3.5 rotate-180" />
              </button>
              <button
                type="button"
                className="mn-xsearch__btn"
                disabled={hit.total === 0}
                title="下一处"
                onClick={() => stepHit(1)}
              >
                <IconChevron className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="mn-xsearch__btn" title="清空" onClick={() => setQuery('')}>
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      }
      titleAlert={
        <button type="button" className="mn-office__alert" disabled title="升级计划（本地文件用不上云服务）">
          <span aria-hidden>◇</span>
          升级计划
        </button>
      }
      tabActions={
        <>
          <button type="button" className="mn-office__tabbtn" disabled title="批注（这个外壳里没有）">
            <IconComment className="h-4 w-4" />
            批注
          </button>
          <button type="button" className="mn-office__share" disabled title="本地文件没有分享这回事">
            <IconShare className="h-4 w-4" />
            共享
            <IconChevron className="h-3 w-3" />
          </button>
        </>
      }
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      onBack={props.onBack}
      band={
        showBar ? (
          <div className={cx('mn-xbar', barTall && 'is-tall')}>
            <span className="mn-xbar__name">
              <span className="mn-xbar__name-value">{active?.address ?? 'A1'}</span>
              {/* 名称框右边那个小三角在真 Excel 里是「已定义名称」的下拉：
                  我们没有定义过名字，所以它灰着 */}
              <button type="button" className="mn-xbar__name-caret" disabled title="已定义名称（这个工作簿里没有）">
                <IconChevron className="mn-xbar__icon" />
              </button>
            </span>
            <span className="mn-xbar__tools">
              <button type="button" disabled title="取消（编辑栏是只读的，没有正在输入的内容）">
                <IconClose className="mn-xbar__icon" />
              </button>
              <button type="button" disabled title="输入（编辑栏是只读的，改不了格子里的字）">
                <span className="mn-xbar__tick">✓</span>
              </button>
              <span className="mn-xbar__fx" aria-hidden>
                fx
              </span>
            </span>
            <span className="mn-xbar__box" title={active?.text ?? ''}>
              {active?.text ?? ''}
            </span>
            <button
              type="button"
              className={cx('mn-xbar__fold', barTall && 'is-open')}
              aria-expanded={barTall}
              title={barTall ? '收起编辑栏' : '展开编辑栏（三行）'}
              onClick={() => setBarTall((on) => !on)}
            >
              <IconChevron className="mn-xbar__icon" />
            </button>
          </div>
        ) : null
      }
      footBand={
        showTabs ? (
          <div className="mn-tabsbar">
            <div className="mn-tabsbar__nav">
              <button
                type="button"
                title="上一张工作表"
                disabled={props.chapterIndex <= 0}
                onClick={() => props.onChapter(props.chapterIndex - 1)}
              >
                <IconChevron className="h-3.5 w-3.5 rotate-90" />
              </button>
              <button
                type="button"
                title="下一张工作表"
                disabled={props.chapterIndex >= props.chapterCount - 1}
                onClick={() => props.onChapter(props.chapterIndex + 1)}
              >
                <IconChevron className="h-3.5 w-3.5 -rotate-90" />
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
            {/* 几百章的书里，一格一格翻不是办法：这一个 ⋮ 列出全部工作表 */}
            <span className="mn-tabsbar__all">
              <AppMenu
                label="全部工作表"
                items={
                  sheetTabs.length === 0
                    ? [
                        {
                          label: chapters === undefined ? '正在读目录…' : '只有一张工作表',
                          onSelect: () => undefined,
                        },
                      ]
                    : sheetTabs.map((sheet) => ({
                        label: sheet.name,
                        checked: sheet.index === props.chapterIndex,
                        onSelect: () => props.onChapter(sheet.index),
                      }))
                }
              />
            </span>
          </div>
        ) : null
      }
      statusLeft={
        <>
          <StatusText>就绪</StatusText>
          <StatusText title={`这一列共 ${rows.length} 行`}>计数: {rows.length}</StatusText>
          <StatusText className="max-sm:hidden" title={`这一列的和：${total} 字`}>
            求和: {formatChars(total)}
          </StatusText>
          <StatusText className="max-sm:hidden" title="一章就是一张工作表">
            工作表 {props.chapterIndex + 1}/{props.chapterCount}
          </StatusText>
        </>
      }
      statusRight={
        <>
          <StatusText title="已读">{formatPercent(props.percent)}</StatusText>
          <StatusText className="max-sm:hidden" title="当前行的单元格地址">
            {active?.address ?? 'A1'}
          </StatusText>
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
          「冻结首行」写成这里的一个 data 属性：表头贴着顶端还是跟着滚由 CSS 决定；
          网格线 / 行列标题在不在也是（视图页签里那三个开关）。
          mn-veil：摸鱼模式的黑纱盖在网格上（标签行与状态栏不动） */}
      <div
        ref={bodyRef}
        className="mn-excel__body mn-veil"
        data-frozen={frozen ? 'true' : 'false'}
        data-grid={showGrid ? 'true' : 'false'}
        data-head={showHead ? 'true' : 'false'}
      >
        {props.children}
      </div>
    </OfficeFrame>
  )
}
