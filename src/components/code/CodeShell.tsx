import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentChrome'
import { cx } from '../../lib/cx'
import {
  IconFiles,
  IconMenu,
  IconSearch,
  IconSidebar,
  IconSliders,
} from '../ui/icons'

/** 活动栏上的视图。和 VS Code 一样：点已选中的那个 = 收起/展开侧栏 */
export type CodeView = 'explorer' | 'search'

export interface CodeMenuItem {
  label: string
  /** 右侧的快捷键提示 */
  hint?: string
  disabled?: boolean
  /** 在这一项上面画一条分隔线 */
  separatorBefore?: boolean
  onSelect: () => void
}

export interface CodeTab {
  key: string
  label: string
  active: boolean
  onSelect: () => void
}

export interface CodeCrumb {
  label: string
  onSelect?: () => void
}

interface CodeShellProps {
  /** 窗口标题。真编辑器里这里放「文件名 — 文件夹 — 程序名」，我们照同一顺序填 */
  title: string
  view: CodeView
  onView: (view: CodeView) => void
  sideOpen: boolean
  onToggleSide: () => void
  sideTitle: string
  sideFooter?: ReactNode
  /** 侧栏内容。搜索视图和资源管理器都从这里进 */
  side: ReactNode
  menu: CodeMenuItem[]
  tabs?: CodeTab[]
  crumbs?: CodeCrumb[]
  statusLeft: ReactNode
  statusRight?: ReactNode
  /** 0-1，画成状态栏顶上那条进度线 */
  statusRatio?: number
  onSettings: () => void
  /** 拖拽导入的高亮（只有书架用得上） */
  dropping?: boolean
  children: ReactNode
}

/**
 * 编辑器外壳。
 *
 * 版式、比例、层次都照着编辑器来：标题栏 35px、活动栏 48px、状态栏 24px，
 * 标签页当前项和编辑区同色。这些数字不是随手定的——差几像素就不像了，
 * 而「像」正是这一整套存在的理由。
 *
 * 它只负责外壳：侧栏里放什么、编辑区里放什么都由调用方给。
 * 于是书架把正文预览放进编辑区，阅读器把正文放进去，两边是同一个窗口。
 */
export function CodeShell({
  title,
  view,
  onView,
  sideOpen,
  onToggleSide,
  sideTitle,
  sideFooter,
  side,
  menu,
  tabs,
  crumbs,
  statusLeft,
  statusRight,
  statusRatio,
  onSettings,
  dropping,
  children,
}: CodeShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // 窗口标题也写进浏览器标签页：外面看到的那行字必须和里面一致
  useDocumentTitle(title)

  // 点别处 / 按 Esc 收起菜单。窗口级监听而不是只在按钮上：菜单是个浮层，
  // 点它周围的任何地方都该关掉。
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const rail: Array<{ key: CodeView; label: string; icon: ReactNode }> = [
    { key: 'explorer', label: '资源管理器', icon: <IconFiles className="h-6 w-6" /> },
    { key: 'search', label: '搜索', icon: <IconSearch className="h-6 w-6" /> },
  ]

  return (
    <div className={cx('mn-code', dropping && 'mn-drop-active')}>
      <header className="mn-code__title">
        <div ref={menuRef} className="flex items-center">
          <button
            type="button"
            className="mn-code__title-btn"
            aria-label="菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconMenu className="h-4.5 w-4.5" />
          </button>
          {menuOpen ? (
            <div className="mn-code-menu" role="menu">
              {menu.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  {item.separatorBefore ? <div className="mn-code-menu__rule" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setMenuOpen(false)
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

        <div className="mn-code__title-text" title={title}>
          {title}
        </div>

        <button
          type="button"
          className="mn-code__title-btn"
          aria-label={sideOpen ? '收起侧栏' : '展开侧栏'}
          aria-pressed={sideOpen}
          onClick={onToggleSide}
        >
          <IconSidebar className={cx('h-4.5 w-4.5', sideOpen && 'text-fg')} />
        </button>
      </header>

      <div className="mn-code__body">
        <nav className="mn-code__rail" aria-label="活动栏">
          {rail.map((item) => {
            const active = view === item.key && sideOpen
            return (
              <button
                key={item.key}
                type="button"
                className="mn-code__rail-btn"
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => {
                  if (view === item.key) onToggleSide()
                  else {
                    onView(item.key)
                    if (!sideOpen) onToggleSide()
                  }
                }}
              >
                {item.icon}
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            type="button"
            className="mn-code__rail-btn"
            title="阅读设置"
            aria-label="阅读设置"
            onClick={onSettings}
          >
            <IconSliders className="h-6 w-6" />
          </button>
        </nav>

        {sideOpen ? (
          <aside className="mn-code__side" aria-label={sideTitle}>
            <div className="mn-code__side-head">
              <span className="truncate">{sideTitle}</span>
            </div>
            <div className="mn-code__side-body">{side}</div>
            {sideFooter}
          </aside>
        ) : null}

        <main className="mn-code__main">
          {tabs && tabs.length > 0 ? (
            <div className="mn-code__tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={tab.active}
                  className="mn-code__tab"
                  onClick={tab.onSelect}
                >
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {crumbs && crumbs.length > 0 ? (
            <div className="mn-code__crumbs">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <span aria-hidden>›</span> : null}
                  {crumb.onSelect ? (
                    <button type="button" onClick={crumb.onSelect} className="hover:text-fg">
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-fg-muted">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mn-code__pane">{children}</div>
        </main>
      </div>

      <footer className="mn-code__status">
        {statusRatio !== undefined ? (
          <span
            aria-hidden
            className="mn-code__status-fill"
            style={{ width: `${Math.max(0, Math.min(1, statusRatio)) * 100}%` }}
          />
        ) : null}
        <div className="flex min-w-0 items-center gap-1">{statusLeft}</div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">{statusRight}</div>
      </footer>
    </div>
  )
}

/**
 * 一张空的编辑器窗口。
 *
 * 用于「书还没读出来」和「这本书打不开」这两种状态：它们的骨架必须和真窗口
 * 一模一样（同样高的标题栏、同样宽的活动栏、同一条状态栏），否则从书架点进来时
 * 会先闪一下另一个形状的页面——用户看到的就是「加载了一下」。
 * 所以这里不摆标识、不摆转圈，也不写「正在打开」：编辑器打开文件时也不会弹这些。
 */
export function CodeFrame({ title, children }: { title?: string; children?: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="mn-code">
      <header className="mn-code__title">
        <div className="mn-code__title-text" title={title}>
          {title ?? ''}
        </div>
      </header>
      <div className="mn-code__body">
        <nav className="mn-code__rail" aria-hidden />
        <main className="mn-code__main">
          <div className="mn-code__pane">{children}</div>
        </main>
      </div>
      <footer className="mn-code__status" />
    </div>
  )
}

/** 状态栏上的一项。点和不可点两种，长得一样、只是 hover 的反馈不同 */
export function CodeStatusItem({
  children,
  title,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  title?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        className={cx(
          'mn-code__status-item mn-code__status-item--action flex items-center',
          className,
        )}
      >
        {children}
      </button>
    )
  }
  return (
    <span title={title} className={cx('mn-code__status-item flex items-center', className)}>
      {children}
    </span>
  )
}
