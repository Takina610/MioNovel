import { useState } from 'react'
import {
  EXCEL_HOME_TABS,
  appName,
  avatarOf,
  excelHomeRows,
  fileNameFor,
  fileKindLabel,
  greetingText,
  type ExcelHomeTab,
} from '../lib/appdocs'
import { formatBytes, formatDateTime } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevronRight, IconClose, IconSearch, IconSliders } from '../components/ui/icons'
import {
  IconAccount,
  IconDoc,
  IconExcelFile,
  IconExcelMark,
  IconExcelWatermark,
  IconFolderOpen,
  IconGear,
  IconHomeLine,
  IconTour,
} from '../components/ui/app-icons'
import { OfficeFrame } from './OfficeFrame'
import type { ShelfProps } from './ShelfShell'

/**
 * Excel 的开始屏幕（这一套的书架）。
 *
 * 2026-09-24 按桌面版 Excel 的「开始」屏幕截图一比一复刻：标题栏右端一片
 * 淡灰的商标水印，左边一条 96px 的导航栏（开始 / 新建 / 打开 … 账户 / 选项），
 * 右边一句问候（下午好）、一颗绿色的「新建空白工作簿」、三个药丸
 * （最近 / 收藏夹 / 与我共享）、一个「搜索文件」框、右下角「更多工作簿 →」，
 * 中间是文件列表。尺寸都在 styles/excel.css 的「Excel 开始屏幕」那一节里，
 * 是从截图上量的（1917 / 1920 两张，1:1 量）。
 *
 * 映射到我们这个应用上，哪些是真的、哪些灰着：
 *
 * - **真的**：「新建空白工作簿」= 导入本地 txt / epub（拖进来也行）；「新建」「打开」
 *   同理（打开 = 打开最近读的那一本，没书时灰着）；最近 / 收藏夹 / 与我共享 三栏
 *   真的能切；搜索框真的能搜（书名、作者、原文件名）；每一行的 ⋯ 是解析设置与删除；
 *   左栏「选项」= 阅读设置、「开始」= 回到这一屏的默认状态。
 * - **灰着的**：左边那个「>」方框（真 Excel 里是使用向导）、账户（本地文件没有
 *   账户）、更多工作簿 →（书架上的都在这张列表里了）。
 *
 * 「收藏夹」与「与我共享」两栏**老实空着**：本地书架没有收藏，也没有共享
 * （和 Word 开始屏幕、飞书首页同一处理，见决定记录 28 / 35）。
 *
 * 顶上那句问候是**这台设备现在的钟点**（lib/appdocs 的 greetingText）——
 * 真 Excel 按钟点换，我们也按真的钟点来，不编一个固定的话。
 */
export function ExcelHome({
  books,
  onOpen,
  onMenu,
  onImport,
  onOpenSettings,
  dropping,
  dim,
  dimOn,
  onToggleDim,
}: ShelfProps) {
  const [tab, setTab] = useState<ExcelHomeTab>('recent')
  const [query, setQuery] = useState('')

  const all = books ?? []
  const rows = excelHomeRows(all, { tab, query })
  const spec = EXCEL_HOME_TABS.find((item) => item.id === tab) ?? EXCEL_HOME_TABS[0]
  // 「打开」= 打开最近读的那一本。没有书时它是灰的：没有任何东西可打开
  const latest = excelHomeRows(all, { tab: 'recent' })[0]

  /** 「开始」= 回到这一屏的默认状态（和 Word 开始屏幕、飞书首页同一处理） */
  const resetHome = () => {
    setQuery('')
    setTab('recent')
  }

  return (
    <OfficeFrame
      fileName={appName('sheet')}
      brand={<IconExcelMark className="mn-office__brand-icon" />}
      avatar={avatarOf(all[0]?.author ?? '')}
      titleArt={<IconExcelWatermark className="mn-xhome__watermark" />}
      tabs={[]}
      activeTab=""
      onTab={() => undefined}
      statusLeft={null}
      statusRight={null}
      hideStatus
      zoom={16}
      zoomRange={[10, 34]}
      onZoom={() => undefined}
      onOpenSettings={onOpenSettings}
      dim={dim}
      dimOn={dimOn}
      onToggleDim={onToggleDim}
    >
      <div className={cx('mn-xhome', dropping && 'mn-drop-active')}>
        {/* ---------------- 左边那条导航栏 ---------------- */}
        <nav className="mn-xhome__rail" aria-label="Excel">
          <button
            type="button"
            className="mn-xhome__rail-item is-active"
            aria-current="page"
            title="开始（回到这一屏的默认状态）"
            onClick={resetHome}
          >
            <IconHomeLine className="mn-xhome__rail-icon" />
            开始
          </button>
          <button
            type="button"
            className="mn-xhome__rail-item"
            title="新建：导入一份本地 txt / epub"
            onClick={onImport}
          >
            <IconDoc className="mn-xhome__rail-icon" />
            新建
          </button>
          <button
            type="button"
            className="mn-xhome__rail-item"
            title={latest ? `打开《${latest.title}》` : '还没有工作簿'}
            disabled={!latest}
            onClick={() => latest && onOpen(latest)}
          >
            <IconFolderOpen className="mn-xhome__rail-icon" />
            打开
          </button>

          <span className="mn-xhome__rail-gap" />

          <div className="mn-xhome__rail-sep" />
          <button
            type="button"
            className="mn-xhome__rail-item"
            title="账户（本地文件没有账户）"
            disabled
          >
            <IconAccount className="mn-xhome__rail-icon" />
            账户
          </button>
          <button
            type="button"
            className="mn-xhome__rail-item"
            title="选项：阅读设置"
            onClick={onOpenSettings}
          >
            <IconGear className="mn-xhome__rail-icon" />
            选项
          </button>
        </nav>

        {/* ---------------- 右边：问候 + 新建 + 最近 ---------------- */}
        <main className="mn-xhome__main mn-veil">
          <h1 className="mn-xhome__greeting">{greetingText()}</h1>

          <div className="mn-xhome__new">
            <button
              type="button"
              className="mn-xhome__tour"
              disabled
              title="使用向导（这个外壳里没有）"
            >
              <IconTour className="mn-xhome__tour-icon" />
            </button>
            <button
              type="button"
              className="mn-xhome__blank"
              title="导入一份本地 txt / epub"
              onClick={onImport}
            >
              新建空白工作簿
            </button>
          </div>

          <div className="mn-xhome__filters">
            <div className="mn-xhome__tabs" role="tablist">
              {EXCEL_HOME_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === tab}
                  className={cx('mn-xhome__tab', item.id === tab && 'is-active')}
                  title={
                    item.id === 'recent'
                      ? '最近打开过的工作簿'
                      : item.id === 'starred'
                        ? '收藏夹（本地书架没有收藏）'
                        : '与我共享（本地文件没有共享）'
                  }
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mn-xhome__search">
              <IconSearch className="mn-xhome__search-icon" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索文件"
                aria-label="搜索文件"
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="mn-xhome__list" role="list">
            <div className="mn-xhome__row mn-xhome__row--head" role="presentation">
              <span className="mn-xhome__name">名称</span>
              <span className="mn-xhome__when">修改时间</span>
              <span className="mn-xhome__kind">类型</span>
              <span className="mn-xhome__size">大小</span>
              {/* 行尾那一格在表头里是空的，但宽度要占住：不然日期列会比数据行左移 */}
              <span className="mn-xhome__acts" aria-hidden />
            </div>

            {rows.map((book) => (
              <div key={book.id} className="mn-xhome__row" role="listitem">
                <button
                  type="button"
                  className="mn-xhome__open"
                  title={book.title}
                  onClick={() => onOpen(book)}
                >
                  <span className="mn-xhome__name">
                    <IconExcelFile className="mn-xhome__file-icon" />
                    <span className="mn-xhome__file">
                      <span className="mn-xhome__file-name">{fileNameFor('sheet', book.title)}</span>
                      <span className="mn-xhome__file-path">
                        原始文件 » {book.fileName}
                        {book.chapterCount > 0 ? ` » ${book.chapterCount} 章` : ''}
                      </span>
                    </span>
                  </span>
                  <span className="mn-xhome__when" title={`原始文件 ${formatBytes(book.fileSize)}`}>
                    {formatDateTime(book.lastReadAt || book.addedAt)}
                  </span>
                  <span className="mn-xhome__kind">{fileKindLabel('sheet')}</span>
                  <span className="mn-xhome__size">{formatBytes(book.fileSize)}</span>
                </button>
                <span className="mn-xhome__acts">
                  <button
                    type="button"
                    className="mn-xhome__act"
                    title="解析设置与删除"
                    aria-label={`${book.title} 的更多操作`}
                    onClick={() => onMenu(book)}
                  >
                    <IconSliders className="mn-xhome__act-icon" />
                  </button>
                </span>
              </div>
            ))}

            {rows.length === 0 ? (
              <p className="mn-xhome__empty">
                {query.trim() ? `没有匹配「${query}」的文件` : spec.empty}
              </p>
            ) : null}
          </div>

          <div className="mn-xhome__more">
            <button
              type="button"
              className="mn-xhome__link"
              title="书架上的都在这张列表里"
              disabled
            >
              更多工作簿
              <IconChevronRight className="mn-xhome__link-icon" />
            </button>
          </div>
        </main>
      </div>
    </OfficeFrame>
  )
}
