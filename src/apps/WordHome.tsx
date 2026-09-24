import { useState } from 'react'
import { WORD_HOME_TABS, appName, avatarOf, fileNameFor, wordDateText, wordHomeRows, type WordHomeTab } from '../lib/appdocs'
import { formatBytes, formatChars } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevron, IconChevronRight, IconClose, IconSearch, IconSliders } from '../components/ui/icons'
import {
  IconAccount,
  IconCalligraphyPage,
  IconDoc,
  IconFolderOpen,
  IconGear,
  IconHomeLine,
  IconPin,
  IconStarLine,
  IconTemplateCover,
  IconWordFile,
  IconWordMark,
} from '../components/ui/app-icons'
import { OfficeFrame } from './OfficeFrame'
import type { ShelfProps } from './ShelfShell'

/**
 * Word 的开始屏幕（这一套的书架）。
 *
 * 2026-09-24 按桌面版 Word 的开屏截图一比一复刻：左边一条 96px 的导航栏
 * （开始 / 新建 / 打开 … 账户 / 选项），右边是「新建」三张卡 + 页签行
 * （最近 / 收藏夹 / 与我共享 + 搜索框）+ 一份列表（名称 / 已修改日期）。
 * 尺寸都在 styles/word.css 的「Word 开始屏幕」那一节里，是从截图上量的。
 *
 * 映射到我们这个应用上，哪些是真的、哪些灰着：
 *
 * - **真的**：「空白文档」= 导入本地 txt / epub（拖进来也行）；「新建」「打开」同理
 *   （打开 = 打开最近读的那一本，没书时灰着）；最近 / 收藏夹 / 与我共享 三栏真的能切；
 *   搜索框真的能搜（书名、作者、文件名）；每一行的 ⋯ 是解析设置与删除；
 *   左栏「选项」= 阅读设置、「开始」= 回到这一屏的默认状态。
 * - **灰着的**：解锁高级模板 / 书法字帖（模板要联网）、更多模板 →、更多文档 →、
 *   账户（本地文件没有账户）、行尾的图钉与星（没有置顶也没有收藏）。
 *
 * 为什么不做「收藏夹」：这个应用里没有收藏这件事，与其摆一个永远空的星，
 * 不如老实说一句「还没有收藏的文档」，并把入口灰着说清为什么（和飞书首页
 * 的「与我共享 / 收藏」同一处理——见 docs/SPEC.md 决定记录 28 与 35）。
 */
export function WordHome({
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
  const [tab, setTab] = useState<WordHomeTab>('recent')
  const [query, setQuery] = useState('')

  const all = books ?? []
  const rows = wordHomeRows(all, { tab, query })
  const spec = WORD_HOME_TABS.find((item) => item.id === tab) ?? WORD_HOME_TABS[0]
  // 「打开」= 打开最近读的那一本。没有书时它是灰的：没有任何东西可打开
  const latest = wordHomeRows(all, { tab: 'recent' })[0]

  /** 「开始」= 回到这一屏的默认状态（和飞书首页的「主页」同一处理） */
  const resetHome = () => {
    setQuery('')
    setTab('recent')
  }

  return (
    <OfficeFrame
      fileName={appName('page')}
      brand={<IconWordMark className="mn-office__brand-icon" />}
      avatar={avatarOf(all[0]?.author ?? '')}
      tabs={[]}
      activeTab=""
      onTab={() => undefined}
      statusLeft={null}
      statusRight={null}
      hideStatus
      zoom={16}
      zoomRange={[14, 34]}
      onZoom={() => undefined}
      onOpenSettings={onOpenSettings}
      dim={dim}
      dimOn={dimOn}
      onToggleDim={onToggleDim}
    >
      <div className={cx('mn-whome', dropping && 'mn-drop-active')}>
        {/* ---------------- 左边那条导航栏 ---------------- */}
        <nav className="mn-whome__rail" aria-label="Word">
          <button
            type="button"
            className="mn-whome__rail-item is-active"
            aria-current="page"
            title="开始（回到这一屏的默认状态）"
            onClick={resetHome}
          >
            <IconHomeLine className="mn-whome__rail-icon" />
            开始
          </button>
          <button
            type="button"
            className="mn-whome__rail-item"
            title="新建：导入一份本地 txt / epub"
            onClick={onImport}
          >
            <IconDoc className="mn-whome__rail-icon" />
            新建
          </button>
          <button
            type="button"
            className="mn-whome__rail-item"
            title={latest ? `打开《${latest.title}》` : '还没有文件'}
            disabled={!latest}
            onClick={() => latest && onOpen(latest)}
          >
            <IconFolderOpen className="mn-whome__rail-icon" />
            打开
          </button>

          <span className="mn-whome__rail-gap" />

          <div className="mn-whome__rail-sep" />
          <button
            type="button"
            className="mn-whome__rail-item"
            title="账户（本地文件没有账户）"
            disabled
          >
            <IconAccount className="mn-whome__rail-icon" />
            账户
          </button>
          <button
            type="button"
            className="mn-whome__rail-item"
            title="选项：阅读设置"
            onClick={onOpenSettings}
          >
            <IconGear className="mn-whome__rail-icon" />
            选项
          </button>
        </nav>

        {/* ---------------- 右边：新建 + 最近 ---------------- */}
        <main className="mn-whome__main mn-veil">
          <section className="mn-whome__section">
            <div className="mn-whome__section-head">
              <span className="mn-whome__section-title">
                <IconChevron className="mn-whome__section-caret rotate-180" />
                新建
              </span>
              <button
                type="button"
                className="mn-whome__link"
                title="模板库要联网，本地文件没有"
                disabled
              >
                更多模板
                <IconChevronRight className="mn-whome__link-icon" />
              </button>
            </div>

            <div className="mn-whome__cards">
              {/* 空白文档 = 导入：这一格是真的，也是整屏最该被点到的东西 */}
              <button
                type="button"
                className="mn-whome__card is-selected"
                title="导入一份本地 txt / epub"
                onClick={onImport}
              >
                <span className="mn-whome__page" aria-hidden>
                  <span className="mn-whome__page-line" />
                  <span className="mn-whome__page-line mn-whome__page-line--short" />
                </span>
                <span className="mn-whome__card-label">空白文档</span>
              </button>
              <button
                type="button"
                className="mn-whome__card mn-whome__card--template"
                title="解锁高级模板（模板库要联网，本地文件没有）"
                disabled
              >
                <IconTemplateCover className="mn-whome__cover" />
                <span className="mn-whome__card-label">解锁高级模板</span>
              </button>
              <button
                type="button"
                className="mn-whome__card mn-whome__card--template"
                title="书法字帖（模板库要联网，本地文件没有）"
                disabled
              >
                <IconCalligraphyPage className="mn-whome__cover" />
                <span className="mn-whome__card-label">书法字帖</span>
              </button>
            </div>
          </section>

          <section className="mn-whome__section mn-whome__section--list">
            <div className="mn-whome__filters">
              <div className="mn-whome__tabs" role="tablist">
                {WORD_HOME_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === tab}
                    className={cx('mn-whome__tab', item.id === tab && 'is-active')}
                    title={
                      item.id === 'recent'
                        ? '最近读过的文档'
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
              <label className="mn-whome__search">
                <IconSearch className="mn-whome__search-icon" />
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

            <div className="mn-whome__list" role="list">
              <div className="mn-whome__row mn-whome__row--head" role="presentation">
                <span className="mn-whome__name">名称</span>
                {/* 行尾那一格在表头里是空的，但宽度要占住：不然日期列会比数据行左移 */}
                <span className="mn-whome__acts" aria-hidden />
                <span className="mn-whome__when">已修改日期</span>
              </div>

              {rows.map((book) => (
                <div key={book.id} className="mn-whome__row" role="listitem">
                  <button
                    type="button"
                    className="mn-whome__open"
                    title={book.title}
                    onClick={() => onOpen(book)}
                  >
                    <IconWordFile className="mn-whome__file-icon" />
                    <span className="mn-whome__lines">
                      <span className="mn-whome__file-name">{fileNameFor('page', book.title)}</span>
                      <span className="mn-whome__file-path">
                        原始文件 » {book.fileName}
                        {book.chapterCount > 0 ? ` » ${book.chapterCount} 章` : ''}
                        {book.totalChars > 0 ? ` » ${formatChars(book.totalChars)}` : ''}
                      </span>
                    </span>
                  </button>
                  {/* 图钉与星在真 Word 里是「置顶 / 收藏」：本地书架两样都没有，
                      所以它们灰着（灰按钮是诚实的），落在这里只是保住那一行的样子。
                      它们排在日期左边，和截图一致；那一格宽度定死，日期不会左右跳 */}
                  <span className="mn-whome__acts">
                    <button type="button" className="mn-whome__act" title="置顶（本地书架没有置顶）" disabled>
                      <IconPin className="mn-whome__act-icon" />
                    </button>
                    <button type="button" className="mn-whome__act" title="收藏（本地书架没有收藏）" disabled>
                      <IconStarLine className="mn-whome__act-icon" />
                    </button>
                    <button
                      type="button"
                      className="mn-whome__act"
                      title="解析设置与删除"
                      aria-label={`${book.title} 的更多操作`}
                      onClick={() => onMenu(book)}
                    >
                      <IconSliders className="mn-whome__act-icon" />
                    </button>
                  </span>
                  <span className="mn-whome__when" title={`原始文件 ${formatBytes(book.fileSize)}`}>
                    {wordDateText(book.lastReadAt || book.addedAt)}
                  </span>
                </div>
              ))}

              {rows.length === 0 ? (
                <p className="mn-whome__empty">
                  {query.trim() ? `没有匹配「${query}」的文件` : spec.empty}
                </p>
              ) : null}
            </div>

            <div className="mn-whome__more">
              <button
                type="button"
                className="mn-whome__link"
                title="书架上的都在这张列表里"
                disabled
              >
                更多文档
                <IconChevronRight className="mn-whome__link-icon" />
              </button>
            </div>
          </section>
        </main>
      </div>
    </OfficeFrame>
  )
}
