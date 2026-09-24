import { type ReactNode } from 'react'
import { appName } from '../lib/appdocs'
import { CHAT_RAIL } from '../lib/chat'
import type { BookRecord } from '../db/db'
import { OfficeFrame } from './OfficeFrame'
import { ChatApp, ChatHome } from './ChatApp'
import { DocApp } from './DocApp'
import { DocHome } from './DocHome'
import { ExcelApp } from './ExcelApp'
import { ExcelHome } from './ExcelHome'
import { PptApp } from './PptApp'
import { PptHome } from './PptHome'
import { WordApp } from './WordApp'
import { WordHome } from './WordHome'
import { ShelfShell } from './ShelfShell'
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
        <nav className="mn-chat__rail" aria-hidden>
          <span className="mn-chat__me" />
          {CHAT_RAIL.map((item) => (
            <span key={item.id} className="mn-chat__rail-btn">
              <span className="mn-chat__rail-icon" />
            </span>
          ))}
        </nav>
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
            // Word 那一屏的开始屏幕是单独的组件：左边一条导航栏、新建三张卡、
            // 页签行与一份两列列表（见 WordHome.tsx）。Excel 也是自己的一屏
            // （问候语、绿按钮、三个药丸、搜索文件——见 ExcelHome.tsx），
            // PowerPoint 也是（问候语、八张模板卡、搜索文件——见 PptHome.tsx）
            return <WordHome {...props} />
          case 'sheet':
            return <ExcelHome {...props} />
          case 'slide':
            return <PptHome {...props} />
          default:
            return null
        }
      }}
    />
  )
}
