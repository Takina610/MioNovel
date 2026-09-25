import { useCallback, useRef, useState, type ReactNode } from 'react'
import { BookPanel } from '../components/shelf/BookPanel'
import { Toast } from '../components/ui/Toast'
import type { BookRecord } from '../db/db'
import { useBooks } from '../hooks/useBooks'
import { useFileDrop } from '../hooks/useFileDrop'
import { useHotkey } from '../hooks/useHotkeys'
import {
  openSettingsDialog,
  toggleSettingsFromHotkey,
} from '../store/settingsDialog'
import { useDim } from '../store/dim'
import { useImports } from '../store/imports'
import { cx } from '../lib/cx'
import { toggleFullscreen } from '../lib/fullscreen'

/**
 * 外壳书架的共用底座。
 *
 * 五套外壳的首页长得完全不同（云文档列表、会话列表、Office 开始屏幕……），
 * 但底下要做的事一模一样：导入文件、拖拽、打开某本书、弹出解析设置与阅读设置、
 * 显示提示条。那些是**这个应用自己的东西**，不属于任何一副外壳，
 * 所以放在这一层：各外壳只要管「怎么排书架」和那几个回调。
 *
 * 快捷键也挂在这一层：五套首页都能按 S 开阅读设置、按 F 全屏，组合可以在面板里
 * 改（命令表见 lib/hotkey.ts）。输入框里打字时它们让位——飞书首页上那个搜索框
 * 就在这一屏里。
 *
 * 注意这里**没有**任何一处提到某个形态的名字：它被哪个 chrome 用都一样。
 */
export interface ShelfProps {
  books: BookRecord[] | undefined
  onOpen: (book: BookRecord) => void
  onMenu: (book: BookRecord) => void
  onImport: () => void
  onOpenSettings: () => void
  /** 拖拽悬停中，外壳自己决定怎么提示（边框高亮那类） */
  dropping: boolean
  /**
   * 摸鱼模式：这一屏的「内容区」也要压得暗。
   *
   * 首页上的开关、键位和阅读器里是同一套（hotkeyLiveOn 说这几个形态都有它），
   * 所以首页也得真的暗下来——不然在首页按 Alt+S 会变成「按了没反应」。
   * 哪一块算内容区由各外壳自己决定（文档列表 / 会话区 / 最近列表）。
   */
  dim: number
  dimOn: boolean
  onToggleDim: () => void
}

export function ShelfShell({
  render,
  navigateToBook,
}: {
  /** 各外壳的首页。收到的是真数据 + 几个回调 */
  render: (props: ShelfProps) => ReactNode
  /** 点开一本书：进阅读器（和编辑器形态同一套做法） */
  navigateToBook: (book: BookRecord) => void
}) {
  const books = useBooks()
  const addFiles = useImports((state) => state.addFiles)
  const notice = useImports((state) => state.notice)
  const dismissNotice = useImports((state) => state.dismissNotice)
  const dimOn = useDim((state) => state.enabled)
  const dimLevel = useDim((state) => state.level)
  const toggleDim = useDim((state) => state.toggle)

  const fileInput = useRef<HTMLInputElement>(null)
  const dragging = useFileDrop(addFiles)
  const [panelBookId, setPanelBookId] = useState<string | null>(null)
  // 阅读设置弹窗（SettingsDialog）的开合在全局 store（store/settingsDialog）：
  // 首页上的按钮、菜单项、快捷键都从这一扇门进，弹窗的出发点也在那儿

  useHotkey('settings', toggleSettingsFromHotkey)
  useHotkey('fullscreen', toggleFullscreen)

  const panelBook =
    panelBookId && books ? (books.find((book) => book.id === panelBookId) ?? null) : null

  const pickFiles = useCallback(() => fileInput.current?.click(), [])

  return (
    <div className={cx('relative', dragging && 'mn-drop-active')}>
      {render({
        books,
        onOpen: navigateToBook,
        onMenu: (book) => setPanelBookId(book.id),
        onImport: pickFiles,
        onOpenSettings: openSettingsDialog,
        dropping: dragging,
        dim: dimOn ? dimLevel : 0,
        dimOn,
        onToggleDim: toggleDim,
      })}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".txt,.epub,text/plain,application/epub+zip"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          addFiles(files)
          event.target.value = ''
        }}
      />

      <BookPanel
        book={panelBook}
        open={panelBook !== null}
        onClose={() => setPanelBookId(null)}
        onRead={navigateToBook}
        onDeleted={() => setPanelBookId(null)}
      />

      <Toast message={notice} onDismiss={dismissNotice} />

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-70 flex items-center justify-center p-6">
          <div className="mn-fade absolute inset-0 bg-overlay/35 backdrop-blur-sm" />
          <div className="mn-pop rounded-3xl border border-border bg-surface/95 px-9 py-7 text-center shadow-[var(--mn-shadow-float)]">
            <div className="text-[15px] font-medium text-fg">松手就导入</div>
            <div className="mt-1 text-[12px] text-fg-faint">txt · epub</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
