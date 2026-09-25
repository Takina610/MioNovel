import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chapterBlocks } from '../lib/blocks'
import {
  WORD_NAV_TABS,
  WORD_STYLES,
  WORD_TABS,
  avatarOf,
  fileNameFor,
  type WordNavTab,
} from '../lib/appdocs'
import { clearFinds, markFinds, revealFind } from '../lib/find'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { IconBack, IconChevron, IconClose, IconSearch } from '../components/ui/icons'
import {
  IconAddinGrid,
  IconAiHelper,
  IconAlignDistribute,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconBorders,
  IconBrush,
  IconBullets,
  IconCharBorder,
  IconCharShading,
  IconCircledChar,
  IconClearFormat,
  IconComment,
  IconCopy,
  IconDupeCheck,
  IconEditPencil,
  IconFindReplace,
  IconFocus,
  IconFontColor,
  IconFontGrow,
  IconFontLibrary,
  IconFontShrink,
  IconDarkMode,
  IconEndnoteMark,
  IconFootnoteMark,
  IconHeaderFooter,
  IconImmersiveReader,
  IconNavRows,
  IconZoom100,
  IconZoomIn,
  IconHighlight,
  IconIndentLeft,
  IconIndentRight,
  IconLineSpacing,
  IconMultilevelList,
  IconNumbering,
  IconPageView,
  IconPageZoom,
  IconParagraphMark,
  IconPaste,
  IconPdfConvert,
  IconReadView,
  IconRedo,
  IconReplace,
  IconQatMore,
  IconRuler,
  IconSaveFloppy,
  IconScissors,
  IconSelectCursor,
  IconShading,
  IconShare,
  IconSortAZ,
  IconSparkle,
  IconSpin,
  IconTemplateDoc,
  IconUndo,
  IconWordMark,
} from '../components/ui/app-icons'
import {
  AppMenu,
  NavRow,
  OfficeFrame,
  StatusButton,
  StatusText,
  type RibbonGroup,
  type RibbonTab,
} from './OfficeFrame'
import type { AppFrameProps } from './types'

/** 字体栈在功能区里的显示名：Word 的字体框里写的是字体名，这里照做 */
const FONT_LABELS: Record<string, string> = {
  sans: '等线',
  serif: '宋体',
  kai: '楷体',
  mono: 'Consolas',
}

/** 字体框里连着字号写的那一行小注，也是 Word 的写法 */
const FONT_NOTE: Record<string, string> = {
  sans: '中文正文',
  serif: '中文正文',
  kai: '中文正文',
  mono: '代码',
}

const FONT_ORDER = ['sans', 'serif', 'kai', 'mono']
/** 字号框里给得出来的那几档（和设置面板同一个区间） */
const FONT_SIZES = [14, 16, 18, 20, 22, 24, 28, 34]
/** 行距那几档。和设置面板同一个区间 */
const LINE_STEPS = [1.0, 1.15, 1.5, 2.0, 2.5]
/** 缩放下拉里给得出来的那几档字号（百分比 = 字号 ÷ 16）。14 与 34 是设置的上下限 */
const ZOOM_STEPS = [14, 16, 20, 24, 28, 32]

/**
 * Word 形态。
 *
 * 版式照 Word 2024 的窗口摆：标题栏（产品记号 + 快速访问工具栏 + 搜索框）、
 * 一排页签（右端是批注 / 编辑 / 共享）、功能区（一行行格子）、灰蓝桌面上
 * 一张 A4 白纸、状态栏（第几页 + 字数 + 语言 + 右边三个视图按钮与缩放）。
 * 尺寸和颜色是照着 1920×1030 的截图量的，都在 styles/word.css 开头的注释里。
 *
 * 功能区的处理是这套外壳里最花心思的地方，也是决定记录 27 与 34 的主题：
 *
 * - **真的会响的**：复制本章文字、字体、字号（增大 / 缩小 / 直接选）、行距、
 *   首行缩进、两种对齐、导航窗格、标尺、阅读视图、全屏、摸鱼模式、查找。
 *   这些恰好就是 Word 最常用的命令，也恰好都是这个阅读器本来就有的设置。
 * - **灰着的**：粘贴、剪切、格式刷、加粗、斜体、下划线、删除线、字体颜色、
 *   高亮、底纹、项目符号、编号、排序、替换、评论、几个加载项。真实的只读文档
 *   里它们本来就是灰的，所以我们**不给它们功能，也不假装能用**。
 * - 带下拉三角的格里，真有选项的是菜单（字体、字号、行距），灰的只是那个记号。
 */
export function WordApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  const [sideOpen, setSideOpen] = useState(false)
  // 截图里没开标尺（视图页签里能打开）。裁剪标记是纸自己的，一直画
  const [ruler, setRuler] = useState(false)
  const [immersive, setImmersive] = useState(false)
  /** 导航窗格当前那一页：标题 / 查找 / 替换（替换是灰的，见 WORD_NAV_TABS） */
  const [navTab, setNavTab] = useState<WordNavTab>('headings')

  // ---- 查找：标题栏那个搜索框与编辑组里的「查找」共用同一份状态 ----
  const bodyRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLElement[]>([])
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState({ total: 0, at: 0 })
  /** 当前落在第几处（1 起）。和 hit 并行一份 ref：翻上/下一处要读到「现在这一处」 */
  const hitRef = useRef(0)

  useEffect(() => {
    const root = bodyRef.current?.querySelector<HTMLElement>('.mn-content')
    if (!root) return
    let cancelled = false
    let timer = 0
    let attempts = 0
    const apply = () => {
      if (cancelled) return
      // 换章时正文要晚一拍才换上来（ReaderView 在等图片资源）。正文还是空的就再等
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

  const stepHit = useCallback((delta: number) => {
    const marks = marksRef.current
    if (marks.length === 0) return
    const at = ((hitRef.current - 1 + delta + marks.length) % marks.length) + 1
    hitRef.current = at
    marks.forEach((mark, index) => revealFind(mark, index === at - 1))
    setHit({ total: marks.length, at })
  }, [])

  // 离开这个外壳（换主题）时把标记清干净。正文那一块 DOM 是 React 的，
  // 换外壳时**可能被下一个外壳接着用**（html 字符串没变，React 不重写 innerHTML），
  // 那样搜索框没了、标记还留在正文里。所以卸载时自己收尾
  useEffect(() => {
    const body = bodyRef.current
    return () => {
      const content = body?.querySelector<HTMLElement>('.mn-content')
      if (content) clearFinds(content)
    }
  }, [])

  // 阅读视图里按 Esc 出来：功能区的标题上是这么写的，就得真能（真 Word 也一样）
  useEffect(() => {
    if (!immersive) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive])

  const copyChapter = () => {
    // 复制的是这一章的正文，纯文本。剪贴板要给就真给，不弹个「已复制」了事
    const text = chapterBlocks(props.chapterHtml ?? '')
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n')
    if (text) void navigator.clipboard.writeText(text)
  }

  const nudgeFont = (delta: number) =>
    onSettingsChange({ fontSize: Math.max(14, Math.min(34, settings.fontSize + delta)) })

  // ---- 开始页签上的那几组格子 ----
  const homeGroups = useMemo<RibbonGroup[]>(() => {
    const label = FONT_LABELS[settings.fontFamily] ?? settings.fontFamily
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
              title: '粘贴（只读文档，没有可粘贴的位置）',
            },
            {
              id: 'clip',
              kind: 'column',
              items: [
                {
                  id: 'cut',
                  kind: 'small',
                  icon: <IconScissors />,
                  label: '剪切',
                  disabled: true,
                  title: '剪切（只读）',
                },
                {
                  id: 'copy',
                  kind: 'small',
                  icon: <IconCopy />,
                  label: '复制',
                  title: '复制这一章的正文',
                  onClick: copyChapter,
                },
                {
                  id: 'brush',
                  kind: 'small',
                  icon: <IconBrush />,
                  label: '格式刷',
                  disabled: true,
                  title: '格式刷（只读）',
                },
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
                  label={`字体：${label}`}
                  trigger={
                    <span className="mn-word__combo">
                      <span className="mn-word__combo-value">{label}</span>
                      <span className="mn-word__combo-note">（{FONT_NOTE[settings.fontFamily] ?? '中文正文'}）</span>
                      <IconChevron className="mn-word__combo-caret" />
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
                <span className="mn-word__combo mn-word__combo--size">
                  <span className="mn-word__combo-value">{settings.fontSize}</span>
                  <span className="mn-word__spin">
                    <button
                      type="button"
                      title="增大字号"
                      disabled={settings.fontSize >= 34}
                      onClick={() => nudgeFont(1)}
                    >
                      <IconSpin className="mn-word__spin-icon" />
                    </button>
                  </span>
                  <AppMenu
                    label="字号"
                    trigger={<IconChevron className="mn-word__combo-caret" />}
                    items={FONT_SIZES.map((size) => ({
                      label: String(size),
                      checked: settings.fontSize === size,
                      onSelect: () => onSettingsChange({ fontSize: size }),
                    }))}
                  />
                </span>
              ),
            },
            { id: 'r1', kind: 'rule' },
            {
              id: 'grow',
              icon: <IconFontGrow />,
              disabled: settings.fontSize >= 34,
              title: '增大字号',
              onClick: () => nudgeFont(1),
            },
            {
              id: 'shrink',
              icon: <IconFontShrink />,
              disabled: settings.fontSize <= 14,
              title: '缩小字号',
              onClick: () => nudgeFont(-1),
            },
            { id: 'r2', kind: 'rule' },
            { id: 'case', kind: 'text', icon: 'Aa', menu: true, disabled: true, title: '更改大小写（只读）' },
            { id: 'r3', kind: 'rule' },
            { id: 'clear', icon: <IconClearFormat />, disabled: true, title: '清除格式（只读）' },
            { id: 'shading', icon: <IconCharShading />, menu: true, disabled: true, title: '字符底纹（只读）' },
            { id: 'border', icon: <IconCharBorder />, disabled: true, title: '字符边框（只读）' },
          ],
          [
            { id: 'bold', kind: 'text', icon: 'B', disabled: true, title: '加粗（正文的粗细不归读者调）' },
            { id: 'italic', kind: 'text', icon: 'I', disabled: true, title: '斜体（只读）' },
            { id: 'underline', kind: 'text', icon: 'U', menu: true, disabled: true, title: '下划线（只读）' },
            { id: 'strike', kind: 'text', icon: 'ab', disabled: true, title: '删除线（只读）' },
            { id: 'sub', kind: 'text', icon: 'x₂', disabled: true, title: '下标（只读）' },
            { id: 'sup', kind: 'text', icon: 'x²', disabled: true, title: '上标（只读）' },
            { id: 'r4', kind: 'rule' },
            {
              id: 'effects',
              kind: 'text',
              icon: (
                <>
                  A
                  <IconSparkle className="mn-word__spark" />
                </>
              ),
              title: '文字效果和版式（只读）',
              disabled: true,
              menu: true,
            },
            { id: 'highlight', icon: <IconHighlight />, menu: true, disabled: true, title: '文本突出显示颜色（只读）' },
            { id: 'color', icon: <IconFontColor />, menu: true, disabled: true, title: '字体颜色（只读）' },
            { id: 'r5', kind: 'rule' },
            { id: 'circled', icon: <IconCircledChar />, disabled: true, title: '带圈字符（只读）' },
          ],
        ],
      },
      {
        label: 'OfficePLUS',
        rows: [
          [
            { id: 'ai', kind: 'big', icon: <IconAiHelper />, label: 'AI 助手', disabled: true, title: 'AI 助手（这个外壳里没有）' },
            { id: 'fontlib', kind: 'big', icon: <IconFontLibrary />, label: '字体', disabled: true, title: '字体库（这个外壳里没有）' },
            { id: 'tpl', kind: 'big', icon: <IconTemplateDoc />, label: '模板', menu: true, disabled: true, title: '模板（这个外壳里没有）' },
          ],
        ],
      },
      {
        label: '段落',
        launcher: true,
        rows: [
          [
            { id: 'bullets', icon: <IconBullets />, menu: true, disabled: true, title: '项目符号（只读）' },
            { id: 'numbering', icon: <IconNumbering />, menu: true, disabled: true, title: '编号（只读）' },
            { id: 'multilevel', icon: <IconMultilevelList />, menu: true, disabled: true, title: '多级列表（只读）' },
            { id: 'p1', kind: 'rule' },
            {
              id: 'outdent',
              icon: <IconIndentLeft />,
              title: `减少首行缩进（当前 ${settings.indent} 字符）`,
              disabled: settings.indent <= 0,
              onClick: () => onSettingsChange({ indent: Math.max(0, settings.indent - 0.5) }),
            },
            {
              id: 'indent',
              icon: <IconIndentRight />,
              title: `增加首行缩进（当前 ${settings.indent} 字符）`,
              disabled: settings.indent >= 3,
              onClick: () => onSettingsChange({ indent: Math.min(3, settings.indent + 0.5) }),
            },
            { id: 'p2', kind: 'rule' },
            { id: 'sort', icon: <IconSortAZ />, menu: true, disabled: true, title: '排序（只读）' },
            { id: 'marks', icon: <IconParagraphMark />, disabled: true, title: '显示编辑标记（只读）' },
          ],
          [
            { id: 'align-left', icon: <IconAlignLeft />, title: '左对齐', active: settings.align === 'left', onClick: () => onSettingsChange({ align: 'left' }) },
            { id: 'align-center', icon: <IconAlignCenter />, disabled: true, title: '居中（这个外壳里没有）' },
            { id: 'align-right', icon: <IconAlignRight />, disabled: true, title: '右对齐（这个外壳里没有）' },
            { id: 'align-justify', icon: <IconAlignJustify />, title: '两端对齐', active: settings.align === 'justify', onClick: () => onSettingsChange({ align: 'justify' }) },
            { id: 'align-distribute', icon: <IconAlignDistribute />, disabled: true, title: '分散对齐（这个外壳里没有）' },
            { id: 'p3', kind: 'rule' },
            {
              id: 'spacing',
              kind: 'node',
              node: (
                <AppMenu
                  label="行距"
                  trigger={
                    <span className="mn-rb mn-rb--icon mn-rb--trigger" title={`行距：${settings.lineHeight.toFixed(2)}`}>
                      <span className="mn-rb__icon">
                        <IconLineSpacing />
                      </span>
                      <span className="mn-rb__caret" aria-hidden>
                        <IconChevron className="h-2.5 w-2.5" />
                      </span>
                    </span>
                  }
                  items={LINE_STEPS.map((step) => ({
                    label: `${step.toFixed(2)} 倍行距`,
                    checked: Math.abs(settings.lineHeight - step) < 0.01,
                    onSelect: () => onSettingsChange({ lineHeight: step }),
                  }))}
                />
              ),
            },
            { id: 'p4', kind: 'rule' },
            { id: 'borders', icon: <IconBorders />, menu: true, disabled: true, title: '边框（只读）' },
            { id: 'shading2', icon: <IconShading />, menu: true, disabled: true, title: '底纹（只读）' },
          ],
        ],
      },
      {
        label: '样式',
        launcher: true,
        rows: [
          [
            {
              id: 'gallery',
              kind: 'node',
              node: (
                // 样式库是**文档样式的预览**，不是一排按钮：这一层只读，改不了样式。
                // 所以它连 disabled 的按钮都不画——画成按钮就得能按（AGENTS.md 第二节第 3 条）
                <div className="mn-word__gallery" title="这一段用的是「正文」样式">
                  {WORD_STYLES.map((style) => (
                    <span
                      key={style.id}
                      className={cx(
                        'mn-word__style',
                        style.heading && 'mn-word__style--heading',
                        style.current && 'is-current',
                      )}
                    >
                      {style.label}
                    </span>
                  ))}
                </div>
              ),
            },
          ],
        ],
      },
      {
        label: '编辑',
        rows: [
          [
            {
              id: 'find',
              kind: 'column',
              items: [
                {
                  id: 'find',
                  kind: 'small',
                  icon: <IconFindReplace />,
                  label: '查找',
                  menu: true,
                  title: '查找（在这一章里找）',
                  onClick: () => searchRef.current?.focus(),
                },
                { id: 'replace', kind: 'small', icon: <IconReplace />, label: '替换', menu: true, disabled: true, title: '替换（只读文档改不了字）' },
                { id: 'select', kind: 'small', icon: <IconSelectCursor />, label: '选择', menu: true, disabled: true, title: '选择（只读）' },
              ],
            },
          ],
        ],
      },
      {
        label: '论文助手',
        rows: [[{ id: 'dupe', kind: 'big', icon: <IconDupeCheck />, label: '论文查重', disabled: true, title: '论文查重（这个外壳里没有）' }]],
      },
      {
        label: '加载项',
        rows: [[{ id: 'addin', kind: 'big', icon: <IconAddinGrid />, label: '加载项', disabled: true, title: '加载项（这个外壳里没有）' }]],
      },
      {
        label: 'PDF工具箱',
        rows: [[{ id: 'pdftool', kind: 'big', icon: <IconPdfConvert />, label: 'PDF转换', menu: true, disabled: true, title: 'PDF转换（这个外壳里没有）' }]],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.fontFamily, settings.fontSize, settings.indent, settings.lineHeight, settings.align])

  /**
   * 视图页签。四组照桌面版 Word 的截图摆（2026-09-24）：
   * 文档视图 / 缩放 / 显示 / 深色模式。
   *
   * 哪几格是真的：单独的页面、阅读视图、沉浸式阅读器（= 全屏 + 只剩正文，
   * 所以老的那个「全屏」按钮并进了它）、缩放下拉与「100%」、标尺、导航、
   * 深色模式（在 Word 亮 / 暗两套主题之间切）。灰的是页眉和页脚、脚注、尾注——
   * 书里没有这三样东西，真 Word 里文档没有脚注时那两格也同样是灰的。
   */
  const viewGroups = useMemo<RibbonGroup[]>(() => {
    const pct = Math.round((settings.fontSize / 16) * 100)
    const dark = settings.themeId === 'word-dark'
    return [
      {
        label: '文档视图',
        rows: [
          [
            {
              id: 'page-view',
              kind: 'stack',
              icon: <IconPageView />,
              label: '单独的页面',
              active: !immersive,
              title: '单独的页面（一张 A4 纸）',
              onClick: () => setImmersive(false),
            },
            {
              id: 'read-view',
              kind: 'stack',
              icon: <IconReadView />,
              label: '阅读视图',
              active: immersive,
              title: '阅读视图（收起功能区，按 Esc 回来）',
              onClick: () => setImmersive(true),
            },
            {
              id: 'immersive-reader',
              kind: 'stack',
              icon: <IconImmersiveReader />,
              label: '沉浸式阅读器',
              title: '沉浸式阅读器（全屏，只剩正文）',
              onClick: () => {
                setImmersive(true)
                if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
              },
            },
          ],
        ],
      },
      {
        label: '缩放',
        rows: [
          [
            {
              id: 'zoom-label',
              kind: 'node',
              node: (
                <span className="mn-rb__static" aria-hidden>
                  <span className="mn-rb__icon">
                    <IconZoomIn />
                  </span>
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
                    <span className="mn-word__combo mn-word__combo--zoom" title={`缩放：${pct}%`}>
                      <span className="mn-word__combo-value">{pct}%</span>
                      <IconChevron className="mn-word__combo-caret" />
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
        label: '显示',
        rows: [
          [
            {
              id: 'ruler',
              kind: 'stack',
              icon: <IconRuler />,
              label: '标尺',
              active: ruler,
              title: '标尺',
              onClick: () => setRuler((on) => !on),
            },
            {
              id: 'nav-pane',
              kind: 'stack',
              icon: <IconNavRows />,
              label: '导航',
              active: sideOpen,
              title: '导航窗格（标题 / 查找 / 替换）',
              onClick: () => setSideOpen((open) => !open),
            },
            {
              id: 'header-footer',
              kind: 'stack',
              icon: <IconHeaderFooter />,
              label: '页眉和页脚',
              disabled: true,
              title: '页眉和页脚（书里的每一页都没有）',
            },
            {
              id: 'footnote',
              kind: 'stack',
              icon: <IconFootnoteMark />,
              label: '脚注',
              disabled: true,
              title: '脚注（这个外壳里没有）',
            },
            {
              id: 'endnote',
              kind: 'stack',
              icon: <IconEndnoteMark />,
              label: '尾注',
              disabled: true,
              title: '尾注（这个外壳里没有）',
            },
          ],
        ],
      },
      {
        label: '深色模式',
        rows: [
          [
            {
              id: 'dark',
              kind: 'big',
              icon: <IconDarkMode />,
              label: '深色模式',
              active: dark,
              title: dark ? '深色模式（换回 Word 亮）' : '深色模式（换成 Word 暗）',
              onClick: () => onSettingsChange({ themeId: dark ? 'word' : 'word-dark' }),
            },
          ],
        ],
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, ruler, settings.fontSize, settings.themeId, sideOpen])

  const tabs: RibbonTab[] = WORD_TABS.map((item) =>
    item.id === 'home'
      ? { id: item.id, label: item.label, groups: homeGroups }
      : item.id === 'view'
        ? { id: item.id, label: item.label, groups: viewGroups }
        : { id: item.id, label: item.label, disabled: item.disabled },
  )

  const chapters = props.chapters
  const navTabSpec = WORD_NAV_TABS.find((item) => item.id === navTab) ?? WORD_NAV_TABS[0]
  /**
   * 导航窗格。照桌面版 Word 的截图（2026-09-24）：一行「← 导航」+ 三页
   * （标题 / 查找 / 替换）+ 一个「在文档中搜索」的框 + 内容区。
   *
   * - 「←」是真能按的：收起窗格（真 Word 里那个箭头就是这个意思）
   * - 那个搜索框和标题栏正中间那个是**同一份状态**（同一个章内查找）：在哪儿
   *   打字都在正文里标出来，计数也一样
   * - 标题那一页列目录（换章就在这里）；没有目录时老实说一句
   * - 替换灰着：只读文档改不了字
   */
  const side = (
    <div className="mn-word__nav">
      <div className="mn-word__nav-head">
        <button
          type="button"
          className="mn-word__nav-back"
          title="收起导航窗格"
          aria-label="收起导航窗格"
          onClick={() => setSideOpen(false)}
        >
          <IconBack className="h-[18px] w-[18px]" />
        </button>
        <span className="mn-word__nav-title">导航</span>
      </div>

      <div className="mn-word__nav-tabs" role="tablist">
        {WORD_NAV_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === navTabSpec.id}
            className={cx('mn-word__nav-tab', item.id === navTabSpec.id && 'is-active')}
            disabled={item.disabled}
            title={item.disabled ? item.why : item.label}
            onClick={() => setNavTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="mn-word__nav-search">
        <IconSearch className="mn-word__nav-search-icon" />
        <input
          value={query}
          placeholder="在文档中搜索"
          aria-label="在本章里查找"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              stepHit(event.shiftKey ? -1 : 1)
            }
          }}
        />
        {query ? (
          <button type="button" aria-label="清空查找" onClick={() => setQuery('')}>
            <IconClose className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>

      <div className="mn-word__nav-body">
        {navTab === 'headings' ? (
          chapters === undefined ? (
            <p className="mn-word__nav-hint">正在读目录…</p>
          ) : chapters.length === 0 ? (
            <p className="mn-word__nav-box">这本书没有目录</p>
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
          )
        ) : (
          <div className="mn-word__nav-find">
            <p className="mn-word__nav-hint">
              {query.trim()
                ? hit.total > 0
                  ? `第 ${hit.at}/${hit.total} 处`
                  : `没有匹配「${query.trim()}」的段落`
                : '还没有输入要查找的词'}
            </p>
            <div className="mn-word__nav-find-acts">
              <button
                type="button"
                className="mn-word__nav-btn"
                disabled={hit.total === 0}
                onClick={() => stepHit(-1)}
              >
                上一处
              </button>
              <button
                type="button"
                className="mn-word__nav-btn"
                disabled={hit.total === 0}
                onClick={() => stepHit(1)}
              >
                下一处
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mn-word__nav-foot">
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
      fileName={`${fileNameFor('page', book.title)} - Word`}
      avatar={avatarOf(book.author)}
      brand={<IconWordMark className="mn-office__brand-icon" />}
      titleTools={
        <>
          {/* 本地文件的改动本来就落在这台设备上，没有要同步的云——所以这个开关
              是灰的，而且停在「关」：截图里的 Word 也是关着的 */}
          <span className="mn-office__autosave" title="自动保存（本地文件不上云，没有要同步的东西）">
            自动保存
            <span className="mn-office__switch" aria-hidden>
              <span className="mn-office__switch-knob" />
              关
            </span>
          </span>
          <button type="button" className="mn-office__title-btn" disabled title="保存（只读文档，没有要保存的改动）">
            <IconSaveFloppy className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="撤销（没有可撤销的操作）">
            <IconUndo className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="重做（没有可重做的操作）">
            <IconRedo className="h-[18px] w-[18px]" />
          </button>
          <button type="button" className="mn-office__title-btn" disabled title="快速访问工具栏（这个外壳里没有）">
            <IconQatMore className="h-[18px] w-[18px]" />
          </button>
        </>
      }
      titleCenter={
        <div className="mn-word__search">
          <IconSearch className="mn-word__search-icon" />
          <input
            ref={searchRef}
            value={query}
            placeholder="搜索"
            aria-label="在本章里查找"
            title="在本章里查找"
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
              <span className="mn-word__search-count">
                {hit.total ? `${hit.at}/${hit.total}` : '没有匹配'}
              </span>
              <button
                type="button"
                className="mn-word__search-btn"
                disabled={hit.total === 0}
                title="上一处"
                onClick={() => stepHit(-1)}
              >
                <IconChevron className="h-3.5 w-3.5 rotate-180" />
              </button>
              <button
                type="button"
                className="mn-word__search-btn"
                disabled={hit.total === 0}
                title="下一处"
                onClick={() => stepHit(1)}
              >
                <IconChevron className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="mn-word__search-btn"
                title="清空"
                onClick={() => setQuery('')}
              >
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
          <button type="button" className="mn-office__tabbtn" disabled title="编辑（只读文档，改不了）">
            <IconEditPencil className="h-4 w-4" />
            编辑
            <IconChevron className="h-3 w-3" />
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
      immersive={immersive}
      escLocal={immersive}
      band={
        ruler ? (
          <div className="mn-word__ruler-wrap">
            <div className="mn-word__ruler-slide">
              <div className="mn-word__ruler" aria-hidden>
                <span className="mn-word__ruler-margin mn-word__ruler-margin--left" />
                <span className="mn-word__ruler-margin mn-word__ruler-margin--right" />
              </div>
            </div>
          </div>
        ) : null
      }
      side={side}
      sideOpen={sideOpen}
      statusLeft={
        <>
          <StatusText title="一章就是一页：我们一次只读一章">
            第 {props.chapterIndex + 1} 页，共 {props.chapterCount} 页
          </StatusText>
          {props.chapterChars === undefined ? null : (
            <StatusText title="本章字数" className="max-sm:hidden">
              {formatChars(props.chapterChars)} 个字
            </StatusText>
          )}
          {/* 窄屏上状态栏只留「第几页」：不然后面那几项会挤成一团 */}
          <StatusText className="max-sm:hidden">简体中文(中国大陆)</StatusText>
        </>
      }
      statusRight={<StatusText title="已读">{formatPercent(props.percent)}</StatusText>}
      statusTools={
        <>
          <StatusButton
            active={props.dimOn}
            title={props.dimOn ? '退出摸鱼模式' : '专注（调暗正文区）'}
            onClick={props.onToggleDim}
          >
            <IconFocus className="mn-office__status-icon" />
            专注
          </StatusButton>
          <StatusButton
            active={immersive}
            title="阅读视图（只剩这一页）"
            onClick={() => setImmersive(true)}
          >
            <IconReadView className="mn-office__status-icon" />
          </StatusButton>
          <StatusButton
            active={!immersive}
            title="页面视图"
            onClick={() => setImmersive(false)}
          >
            <IconPageView className="mn-office__status-icon" />
          </StatusButton>
          <StatusButton
            title={`缩放：回到 100%（正文字号 16，现在是 ${settings.fontSize}）`}
            disabled={settings.fontSize === 16}
            onClick={() => onSettingsChange({ fontSize: 16 })}
          >
            <IconPageZoom className="mn-office__status-icon" />
          </StatusButton>
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
      <div
        ref={bodyRef}
        // mn-veil：摸鱼模式的黑纱盖在这一层（桌面 + 纸一起压暗，功能区与状态栏不动）。
        // 首页上那一层也一样盖在「最近」列表上——见 styles/office.css 的 .mn-veil
        className={cx('mn-word__body', 'mn-veil', immersive && 'is-immersive')}
      >
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
