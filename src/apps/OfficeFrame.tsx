import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatDateTime, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { IconCheck, IconClose, IconSearch, IconSliders } from '../components/ui/icons'
import {
  IconComment,
  IconDoc,
  IconFullscreen,
  IconShare,
  IconTheme,
} from '../components/ui/app-icons'

/**
 * Office 三件套共用的窗户框：标题栏、功能区、状态栏，以及开始屏幕。
 *
 * 为什么 Word / Excel / PowerPoint 共用一个框：它们的窗口本来就是同一个模子
 * ——2021 之后这三套界面用的是同一份 Fluent 设计（页签 + 功能区 + 状态栏），
 * 区别只有品牌色和功能区里有哪些命令。所以框共用、内容各自给，
 * 品牌色直接从主题的 accent 来（换主题就换牌子，组件一行都不用改）。
 *
 * 一条硬规矩：**这里不摆任何点了没反应的东西**。功能区里那些只读文档里本就
 * 该是灰的命令（粘贴、格式刷、字体颜色）一律标成 disabled —— 灰着的按钮是诚实的，
 * 一个点了没反应的按钮是骗人的（见 docs/SPEC.md 五 5.4 与决定记录 27）。
 */

export interface RibbonButton {
  id: string
  /** 图标；给字符串就画成文字按钮（B / I / U / Σ 这些在真 Office 里本来就是字） */
  icon?: ReactNode
  /** 按钮下方的说明（Office 只给少数命令配文字） */
  label?: string
  title: string
  disabled?: boolean
  /** 当前生效的那个（对齐方式、视图切换这类） */
  active?: boolean
  onClick?: () => void
}

export interface RibbonGroup {
  label: string
  buttons: RibbonButton[]
}

export interface RibbonTab {
  id: string
  label: string
  groups?: RibbonGroup[]
  /** 这个外壳里没有实现的页签：灰着，鼠标放上去说清楚为什么 */
  disabled?: boolean
}

/** 功能区里的一格。文字按钮和图标按钮分开两套尺寸 */
function RibbonCell({ button }: { button: RibbonButton }) {
  const text = typeof button.icon === 'string'
  return (
    <button
      type="button"
      className={cx(
        'mn-ribbon__btn',
        text && 'mn-ribbon__btn--text',
        button.active && 'is-active',
      )}
      title={button.title}
      aria-label={button.title}
      aria-pressed={button.active}
      disabled={button.disabled}
      onClick={button.onClick}
    >
      {text ? <span className="mn-ribbon__glyph">{button.icon}</span> : button.icon}
      {button.label ? <span className="mn-ribbon__btn-label">{button.label}</span> : null}
    </button>
  )
}

export interface OfficeFrameProps {
  /** 标题栏上的文件名（书名.docx 这类） */
  fileName: string
  /** 「已保存到这台设备」那一行小字；Word 的标题栏里就是这个位置 */
  savedHint?: string
  /** 标题栏右侧的头像字（真数据：作者的首字） */
  avatar: string
  tabs: RibbonTab[]
  activeTab: string
  onTab: (id: string) => void
  /** 「文件」页签 = 回开始屏幕。开始屏幕上没有页签，所以可以不传 */
  onBack?: () => void
  /** 功能区之上、正文之下的一条：Word 的标尺、Excel 的编辑栏 */
  band?: ReactNode
  /** 功能区之下、状态栏之上的一条：Excel 的工作表标签、PPT 的备注栏 */
  footBand?: ReactNode
  /** 左边的窗格：Word 的导航窗格、PPT 的幻灯片栏 */
  side?: ReactNode
  sideOpen?: boolean
  /** 正文区。外面已经包好滚动容器（ReaderView） */
  children: ReactNode
  statusLeft: ReactNode
  statusRight: ReactNode
  /** 缩放滑条：改的是正文字号，显示成百分比（见各 App 里的说明） */
  zoom: number
  zoomRange: readonly [number, number]
  onZoom: (value: number) => void
  onOpenSettings: () => void
  /** 摸鱼模式 */
  dim: number
  dimOn: boolean
  onToggleDim: () => void
  /**
   * 阅读视图（只有 Word 用）：把标题栏、功能区、状态栏一起收起来，只留正文。
   * 这是真 Word 里就有的功能，也是「窗口里只剩一张纸」那一下。
   */
  immersive?: boolean
}

export function OfficeFrame({
  fileName,
  savedHint,
  avatar,
  tabs,
  activeTab,
  onTab,
  onBack,
  band,
  footBand,
  side,
  sideOpen,
  children,
  statusLeft,
  statusRight,
  zoom,
  zoomRange,
  onZoom,
  onOpenSettings,
  dim,
  dimOn,
  onToggleDim,
  immersive,
}: OfficeFrameProps) {
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  if (immersive) {
    return (
      <div className="mn-office mn-office--immersive" style={{ ['--mn-dim' as string]: String(dim) }}>
        <main className="mn-office__main">{children}</main>
      </div>
    )
  }

  return (
    <div className="mn-office" style={{ ['--mn-dim' as string]: String(dim) }}>
      <header className="mn-office__title">
        <div className="mn-office__file">
          <span className="mn-office__file-name" title={fileName}>
            {fileName}
          </span>
          {savedHint ? <span className="mn-office__saved">{savedHint}</span> : null}
        </div>
        <div className="mn-office__title-actions">
          <button
            type="button"
            className={cx('mn-office__title-btn', dimOn && 'is-active')}
            title={dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗正文区）'}
            aria-pressed={dimOn}
            onClick={onToggleDim}
          >
            <IconTheme className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="mn-office__title-btn"
            title="阅读设置（主题也在这里）"
            onClick={onOpenSettings}
          >
            <IconSliders className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="mn-office__title-btn"
            title="本地文件没有分享这回事"
            disabled
          >
            <IconShare className="h-4 w-4" />
          </button>
          <span className="mn-office__avatar" title="你（用的是书里的作者名）">
            {avatar}
          </span>
        </div>
      </header>

      {/* 开始屏幕上没有功能区：真 Office 那两屏就是分开的（页签为空 = 这是开始屏幕）。
          主页签那一行里的「文件」只在有页签时出现 */}
      {tabs.length > 0 ? (
        <div className="mn-ribbon">
          <div className="mn-ribbon__tabs" role="tablist">
            <button
              type="button"
              className="mn-ribbon__tab mn-ribbon__tab--file"
              onClick={onBack}
              title="回到开始屏幕"
            >
              文件
            </button>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === active.id}
                className={cx('mn-ribbon__tab', tab.id === active.id && 'is-active')}
                disabled={tab.disabled}
                title={tab.disabled ? '这个外壳里只有「开始」和「视图」两页' : tab.label}
                onClick={() => onTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mn-ribbon__panel">
            {(active.groups ?? []).map((group) => (
              <div key={group.label} className="mn-ribbon__group">
                <div className="mn-ribbon__group-body">
                  {group.buttons.map((button) => (
                    <RibbonCell key={button.id} button={button} />
                  ))}
                </div>
                <div className="mn-ribbon__group-label">{group.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {band}

      <div className="mn-office__body">
        {sideOpen && side ? <aside className="mn-office__side">{side}</aside> : null}
        <main className="mn-office__main">{children}</main>
      </div>

      {footBand}

      <footer className="mn-office__status">
        <div className="mn-office__status-left">{statusLeft}</div>
        <div className="flex-1" />
        <div className="mn-office__status-right">
          {statusRight}
          <span className="mn-office__zoom">
            <input
              type="range"
              className="mn-range mn-office__zoom-range"
              min={zoomRange[0]}
              max={zoomRange[1]}
              step={1}
              value={zoom}
              onChange={(event) => onZoom(Number(event.target.value))}
              aria-label="正文字号"
              title="缩放（改的是正文字号）"
            />
            <span className="mn-office__zoom-value">{zoomPct(zoom)}</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

/** 字号 → 缩放百分比。16px 当 100%，和 Word 里「正文 12 磅」的观感对齐 */
export function zoomPct(fontSize: number): string {
  return `${Math.round((fontSize / 16) * 100)}%`
}

/**
 * 外壳上的「⋯」菜单。
 *
 * 五套外壳都需要一个地方放「这个应用自己的东西」：阅读设置（主题就在里面）、
 * 摸鱼模式、全屏、回书架。Office 三件套把这些摊在标题栏和视图页签上，
 * 飞书和企业微信的顶栏放不下，就用这个 ⋯ 菜单——真飞书文档右上角也有一个 ⋯。
 */
export interface AppMenuItem {
  label: string
  hint?: string
  separatorBefore?: boolean
  onSelect: () => void
}

export function AppMenu({ items, label = '更多' }: { items: AppMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="mn-appmenu-wrap">
      <button
        type="button"
        className={cx('mn-appmenu-btn', open && 'is-open')}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open ? (
        <div className="mn-appmenu" role="menu">
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore ? <div className="mn-appmenu__rule" /> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <span>{item.label}</span>
                {item.hint ? <kbd>{item.hint}</kbd> : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 开始屏幕：Office 打开时的那一屏。
 *
 * 左「新建」，右「最近」——三件套的开始屏幕本来就是这个结构，
 * 所以共用一个组件，品牌色跟着主题走。「最近」列的都是真数据
 * （书名、加入/阅读时间、文件大小、字数），不是摆出来的样子。
 *
 * 单击就是打开：真 Office 里是「先选中再双击」，但我们这副界面里
 * 没有别的选中态，一个只选中不打开的列表看着更像坏了（见决定记录 27）。
 */
export function OfficeStart({
  appLabel,
  blankLabel,
  blankHint,
  BlankIcon,
  books,
  onOpen,
  onMenu,
  onImport,
  dropping,
}: {
  appLabel: string
  blankLabel: string
  blankHint: string
  BlankIcon: ReactNode
  books: Array<{ id: string; title: string; author: string; meta: string; size: string; when: string }>
  onOpen: (id: string) => void
  onMenu: (id: string) => void
  onImport: () => void
  dropping?: boolean
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? books.filter((book) => book.title.toLowerCase().includes(needle) || book.author.toLowerCase().includes(needle))
    : books

  return (
    <div className={cx('mn-start', dropping && 'mn-drop-active')}>
      <div className="mn-start__side">
        <div className="mn-start__side-head">新建</div>
        <button type="button" className="mn-start__blank" onClick={onImport}>
          <span className="mn-start__blank-icon">{BlankIcon}</span>
          <span className="mn-start__blank-label">{blankLabel}</span>
          <span className="mn-start__blank-hint">{blankHint}</span>
        </button>
      </div>

      <div className="mn-start__main">
        <div className="mn-start__head">
          <span className="mn-start__head-label">最近</span>
          <label className="mn-start__search">
            <IconSearch className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索"
              aria-label="搜索文件"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">
                <IconClose className="h-3 w-3" />
              </button>
            ) : null}
          </label>
        </div>
        <div className="mn-start__list" role="list">
          <div className="mn-start__row mn-start__row--head" role="presentation">
            <span className="mn-start__name">名称</span>
            <span className="mn-start__when">修改时间</span>
            <span className="mn-start__meta">类型</span>
            <span className="mn-start__size">大小</span>
            <span className="mn-start__more" />
          </div>
          {visible.map((book) => (
            <div key={book.id} className="mn-start__row" role="listitem">
              <button type="button" className="mn-start__open" onClick={() => onOpen(book.id)}>
                <span className="mn-start__name">
                  <IconDoc className="mn-start__file-icon" />
                  <span className="truncate">{book.title}</span>
                </span>
                <span className="mn-start__when">{book.when}</span>
                <span className="mn-start__meta">{book.meta}</span>
                <span className="mn-start__size">{book.size}</span>
              </button>
              <button
                type="button"
                className="mn-start__more"
                title="更多操作"
                aria-label={`${book.title} 的更多操作`}
                onClick={() => onMenu(book.id)}
              >
                ⋯
              </button>
            </div>
          ))}
          {visible.length === 0 ? (
            <p className="mn-start__empty">
              {books.length === 0
                ? `还没有文件。拖一本小说进来，或者点左边的「${blankLabel}」。`
                : `没有匹配「${query}」的文件`}
            </p>
          ) : null}
        </div>
        <p className="mn-start__hint">
          {books.length > 0
            ? `最近 ${visible.length} 个文件 · 点一下打开 · 右边的 ⋯ 打开解析设置`
            : `${appLabel} 的开始屏幕`}
        </p>
      </div>
    </div>
  )
}

/** 名次行（Word 的导航窗格、PPT 的节列表共用）：一行标题 + 可选的字数 */
export function NavRow({
  label,
  hint,
  active,
  onClick,
  className,
}: {
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
  className?: string
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])
  return (
    <button
      ref={ref}
      type="button"
      className={cx('mn-navrow', active && 'is-active', className)}
      aria-current={active}
      title={label}
      onClick={onClick}
    >
      <span className="mn-navrow__label">{label}</span>
      {hint ? <span className="mn-navrow__hint">{hint}</span> : null}
      {active ? <IconCheck className="mn-navrow__check h-3.5 w-3.5" /> : null}
    </button>
  )
}

/** 状态栏上的一项（Office 的状态栏就是一行小字，不是按钮——能点的另算） */
export function StatusText({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <span className={cx('mn-office__status-text', className)} title={title}>
      {children}
    </span>
  )
}

/** 状态栏上能点的一项：视图切换、上下章这些 */
export function StatusButton({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cx('mn-office__status-text mn-office__status-btn', active && 'is-active')}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** 字数 / 时间这几样在状态栏和列表里反复出现，统一出口免得各处格式不一 */
export const officeText = {
  progress: formatPercent,
  when: formatDateTime,
}

/** 全屏按钮：Office 三套的视图页签里都有，做一份共用的配置 */
export function fullscreenButton(): RibbonButton {
  return {
    id: 'fullscreen',
    icon: <IconFullscreen className="h-5 w-5" />,
    title: '全屏',
    onClick: () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    },
  }
}

/** 评论：只读文档里 Word 也会灰掉它（我们连评论都没有） */
export const CommentButton: RibbonButton = {
  id: 'comment',
  icon: <IconComment className="h-5 w-5" />,
  title: '评论（这个外壳里没有）',
  disabled: true,
}
