import { type ReactNode } from 'react'
import { avatarOf, appName, fileKindLabel, fileNameFor } from '../lib/appdocs'
import { formatBytes, formatDateTime, formatPercent } from '../lib/format'
import type { BookRecord } from '../db/db'
import { OfficeFrame, OfficeStart } from './OfficeFrame'
import { IconBookBlank, IconDoc, IconSlide } from '../components/ui/app-icons'
import { ChatApp, ChatHome } from './ChatApp'
import { DocApp, DocHome } from './DocApp'
import { ExcelApp } from './ExcelApp'
import { PptApp } from './PptApp'
import { WordApp } from './WordApp'
import { ShelfShell, type ShelfProps } from './ShelfShell'
import type { AppFrameProps, AppShellChrome } from './types'

/**
 * 书还没读出来 / 读不出来 / 没能解析 这三种状态下的外壳骨架。
 *
 * 规矩和编辑器形态一样（见 ReaderPage 的 shellFallback）：骨架必须和真窗口
 * 长得一样——同样的标题栏、同样的边框，只是里面空着。不然从书架点进来会先闪
 * 一下另一个形状的页面，看着就是「加载了一下」。所以这里不摆标识、不转圈，
 * 只在正文区里放一行字。
 */
export function AppFrameSkeleton({
  chrome,
  message,
  action,
}: {
  chrome: AppShellChrome
  message: ReactNode
  action?: { label: string; run: () => void }
}) {
  const body = (
    <div className="mn-app-skeleton">
      <p className="text-[13px] text-fg-muted">{message}</p>
      {action ? (
        <button type="button" className="mn-app-skeleton__btn" onClick={action.run}>
          {action.label}
        </button>
      ) : null}
    </div>
  )

  if (chrome === 'doc') {
    return (
      <div className="mn-doc mn-doc--skeleton">
        <header className="mn-doc__bar">
          <span className="mn-doc__name" />
        </header>
        <div className="mn-doc__body">
          <main className="mn-doc__main">
            <div className="mn-doc__canvas">{body}</div>
          </main>
        </div>
      </div>
    )
  }

  if (chrome === 'chat') {
    return (
      <div className="mn-chat mn-chat--skeleton">
        <nav className="mn-chat__rail" aria-hidden />
        <aside className="mn-chat__list" aria-hidden />
        <main className="mn-chat__main">{body}</main>
      </div>
    )
  }

  return (
    <OfficeFrame
      fileName={appName(chrome)}
      avatar=""
      tabs={[]}
      activeTab=""
      onTab={() => undefined}
      statusLeft={<span className="mn-office__status-text">就绪</span>}
      statusRight={null}
      zoom={16}
      zoomRange={[10, 34]}
      onZoom={() => undefined}
      onOpenSettings={() => undefined}
      dim={0}
      dimOn={false}
      onToggleDim={() => undefined}
    >
      {body}
    </OfficeFrame>
  )
}

/**
 * 形态 → 外壳的分派表。
 *
 * 这里按 chrome 找到外壳。和编辑器形态同一条约束：**组件不认主题 id**，
 * 所以同一副 Word 外壳给亮色和暗色两套主题用，一行都不用改。
 *
 * 形态名说的是形状（page / sheet / slide / doc / chat），不是品牌——
 * 以后想加「金山文档」或「腾讯文档」，只要它的形状落在 doc 这一档，
 * 加一条主题数据就够了。
 */
export function AppReader(props: AppFrameProps) {
  switch (props.chrome) {
    case 'doc':
      return <DocApp {...props} />
    case 'chat':
      return <ChatApp {...props} />
    case 'page':
      return <WordApp {...props} />
    case 'sheet':
      return <ExcelApp {...props} />
    case 'slide':
      return <PptApp {...props} />
  }
}

/** 外壳书架：五套首页共用 ShelfShell 那层底座（导入、拖拽、面板、提示条） */
export function AppShelf({
  chrome,
  navigateToBook,
}: {
  chrome: AppShellChrome
  navigateToBook: (book: BookRecord) => void
}) {
  return (
    <ShelfShell
      navigateToBook={navigateToBook}
      render={(props) => {
        switch (chrome) {
          case 'doc':
            return <DocHome {...props} />
          case 'chat':
            return <ChatHome {...props} />
          case 'page':
            return <OfficeHome chrome="page" {...props} />
          case 'sheet':
            return <OfficeHome chrome="sheet" {...props} />
          case 'slide':
            return <OfficeHome chrome="slide" {...props} />
          default:
            return null
        }
      }}
    />
  )
}

const BLANK_ICONS: Record<'page' | 'sheet' | 'slide', ReturnType<typeof IconDoc>> = {
  page: <IconDoc className="h-8 w-8" />,
  sheet: <IconBookBlank className="h-8 w-8" />,
  slide: <IconSlide className="h-8 w-8" />,
}

const BLANK_LABELS: Record<'page' | 'sheet' | 'slide', string> = {
  page: '空白文档',
  sheet: '空白工作簿',
  slide: '空白演示文稿',
}

/**
 * Office 三件套的开始屏幕（书架）。
 *
 * 真 Office 打开时就是这一屏：左边「新建」（空白文档/工作簿/演示文稿），
 * 右边「最近」列表。用同一个组件 + 主题里的强调色，所以 Word 是蓝的、
 * Excel 是绿的、PowerPoint 是橙的——品牌色全部来自主题，组件里一个色号都没有。
 *
 * 顶上那条窄标题栏里，右边两个按钮是真的：阅读设置和导入（导入就是「新建」——
 * 拖一本小说进来，就是给这个「程序」新建一份文件）。
 */
function OfficeHome({
  chrome,
  books,
  onOpen,
  onMenu,
  onImport,
  onOpenSettings,
  dropping,
}: { chrome: 'page' | 'sheet' | 'slide' } & ShelfProps) {
  const list = (books ?? []).map((book) => ({
    id: book.id,
    title: fileNameFor(chrome, book.title),
    author: book.author,
    meta: fileKindLabel(chrome),
    size: formatBytes(book.fileSize),
    when: formatDateTime(book.lastReadAt || book.addedAt),
    percent: book.progress ? formatPercent(book.progress.ratio) : '',
  }))

  return (
    <OfficeFrame
      fileName={appName(chrome)}
      avatar={avatarOf(books?.[0]?.author ?? '')}
      tabs={[]}
      activeTab=""
      onTab={() => undefined}
      onBack={onImport}
      immersive={false}
      statusLeft={<span className="mn-office__status-text">就绪</span>}
      statusRight={null}
      zoom={16}
      zoomRange={[10, 34]}
      onZoom={() => undefined}
      onOpenSettings={onOpenSettings}
      dim={0}
      dimOn={false}
      onToggleDim={() => undefined}
    >
      <OfficeStart
        appLabel={appName(chrome)}
        blankLabel={BLANK_LABELS[chrome]}
        blankHint="拖一本小说进来，就是这个「新建」"
        BlankIcon={BLANK_ICONS[chrome]}
        books={list}
        onOpen={(id) => {
          const book = books?.find((item) => item.id === id)
          if (book) onOpen(book)
        }}
        onMenu={(id) => {
          const book = books?.find((item) => item.id === id)
          if (book) onMenu(book)
        }}
        onImport={onImport}
        dropping={dropping}
      />
    </OfficeFrame>
  )
}
