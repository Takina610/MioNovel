import { useState } from 'react'
import {
  PPT_HOME_TABS,
  PPT_TEMPLATES,
  appName,
  avatarOf,
  fileNameFor,
  fileKindLabel,
  greetingText,
  pptHomeRows,
  type PptHomeTab,
  type PptTemplate,
} from '../lib/appdocs'
import { formatBytes, formatDateTime } from '../lib/format'
import { cx } from '../lib/cx'
import { IconChevron, IconChevronRight, IconClose, IconSearch } from '../components/ui/icons'
import {
  IconDoc,
  IconFolderOpen,
  IconHomeLine,
  IconPptFile,
  IconPptMark,
  IconPptWatermark,
} from '../components/ui/app-icons'
import { OfficeFrame } from './OfficeFrame'
import type { ShelfProps } from './ShelfShell'

/**
 * PowerPoint 的开始屏幕（这一套的书架）。
 *
 * 2026-09-24 按桌面版 PowerPoint 的「开始」屏幕截图一比一复刻（1920×1032）：
 * 标题栏右端一段线稿装饰，左边一条 139px 的导航栏（开始 / 新建 / 打开，
 * 底下一行分隔线之后是 帐户 / 选项），右边一句问候（下午好）、一行模板卡片
 * （八张，选中的那张描一圈深色边）、一条横线、右下角「更多主题 →」、
 * 一个「搜索文件」框、三个页签（最近 / 收藏夹 / 与我共享），再往下是文件列表
 * 与右下角「更多演示文稿 →」。尺寸都在 styles/ppt.css 的「PPT 开始屏幕」那一节里，
 * 是从截图上量的（1:1 量）。
 *
 * 映射到我们这个应用上，哪些是真的、哪些灰着：
 *
 * - **真的**：「空白演示文稿」那张卡片 = 导入本地 txt / epub（拖进来也行）；
 *   「新建」「打开」同理（打开 = 打开最近读的那一本，没书时灰着）；三个页签真的能切；
 *   搜索框真的能搜（书名、作者、原文件名）；每一行的 ⋯ 是解析设置与删除；
 *   「新建」左边那个小三角真的能收起 / 展开模板那一排（真 PPT 里也是它）；
 *   左栏「选项」= 阅读设置、「开始」= 回到这一屏的默认状态。
 * - **灰着的**：另外七张模板（它们是 PowerPoint 内置的在线模板，这个外壳里没有）、
 *   帐户（本地文件没有账户）、「更多主题 →」「更多演示文稿 →」（书架上的都在这张
 *   列表里了）。
 *
 * 「收藏夹」与「与我共享」两栏**老实空着**：本地书架没有收藏，也没有共享
 * （和 Word / Excel 的开始屏幕同一处理，见决定记录 28 / 35 / 36）。
 *
 * 顶上那句问候是**这台设备现在的钟点**（lib/appdocs 的 greetingText）——
 * 真 PowerPoint 也按钟点换，我们按真的钟点来，不编一句固定的。
 */
export function PptHome({
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
  const [tab, setTab] = useState<PptHomeTab>('recent')
  const [query, setQuery] = useState('')
  /** 模板那一排是不是摊开的。真 PPT 里那个小三角收的就是它 */
  const [templatesOpen, setTemplatesOpen] = useState(true)

  const all = books ?? []
  const rows = pptHomeRows(all, { tab, query })
  const spec = PPT_HOME_TABS.find((item) => item.id === tab) ?? PPT_HOME_TABS[0]
  // 「打开」= 打开最近读的那一本。没有书时它是灰的：没有任何东西可打开
  const latest = pptHomeRows(all, { tab: 'recent' })[0]

  /** 「开始」= 回到这一屏的默认状态（和 Word / Excel 的开始屏幕同一处理） */
  const resetHome = () => {
    setQuery('')
    setTab('recent')
    setTemplatesOpen(true)
  }

  return (
    <OfficeFrame
      fileName={appName('slide')}
      brand={<IconPptMark className="mn-office__brand-icon" />}
      avatar={avatarOf(all[0]?.author ?? '')}
      titleArt={<IconPptWatermark className="mn-phome__watermark" />}
      tabs={[]}
      activeTab=""
      onTab={() => undefined}
      statusLeft={null}
      statusRight={null}
      hideStatus
      zoom={18}
      zoomRange={[12, 34]}
      onZoom={() => undefined}
      onOpenSettings={onOpenSettings}
      dim={dim}
      dimOn={dimOn}
      onToggleDim={onToggleDim}
    >
      <div className={cx('mn-phome', dropping && 'mn-drop-active')}>
        {/* ---------------- 左边那条导航栏 ---------------- */}
        <nav className="mn-phome__rail" aria-label="PowerPoint">
          <button
            type="button"
            className="mn-phome__rail-item is-active"
            aria-current="page"
            title="开始（回到这一屏的默认状态）"
            onClick={resetHome}
          >
            <IconHomeLine className="mn-phome__rail-icon" />
            开始
          </button>
          <button
            type="button"
            className="mn-phome__rail-item"
            title="新建：导入一份本地 txt / epub"
            onClick={onImport}
          >
            <IconDoc className="mn-phome__rail-icon" />
            新建
          </button>
          <button
            type="button"
            className="mn-phome__rail-item"
            title={latest ? `打开《${latest.title}》` : '还没有演示文稿'}
            disabled={!latest}
            onClick={() => latest && onOpen(latest)}
          >
            <IconFolderOpen className="mn-phome__rail-icon" />
            打开
          </button>

          <span className="mn-phome__rail-gap" />

          <button
            type="button"
            className="mn-phome__rail-item mn-phome__rail-item--text"
            title="账户（本地文件没有账户）"
            disabled
          >
            账户
          </button>
          <button
            type="button"
            className="mn-phome__rail-item mn-phome__rail-item--text"
            title="选项：阅读设置"
            onClick={onOpenSettings}
          >
            选项
          </button>
        </nav>

        {/* ---------------- 右边：问候 + 模板 + 最近 ---------------- */}
        <main className="mn-phome__main mn-veil">
          <h1 className="mn-phome__greeting">{greetingText()}</h1>

          <div className="mn-phome__templates">
            <div className="mn-phome__templates-head">
              <button
                type="button"
                className={cx('mn-phome__fold', !templatesOpen && 'is-closed')}
                aria-expanded={templatesOpen}
                title={templatesOpen ? '收起模板' : '展开模板'}
                onClick={() => setTemplatesOpen((open) => !open)}
              >
                <IconChevron className="mn-phome__fold-icon" />
              </button>
              <span className="mn-phome__templates-label">新建</span>
            </div>

            {templatesOpen ? (
              <div className="mn-phome__cards">
                {PPT_TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cx('mn-phome__card', item.blank && 'is-blank')}
                    title={
                      item.blank
                        ? '导入一份本地 txt / epub'
                        : `${item.label}（PowerPoint 的内置模板，这个外壳里没有）`
                    }
                    disabled={!item.blank}
                    onClick={item.blank ? onImport : undefined}
                  >
                    <TemplateArt art={item.art} />
                    <span className="mn-phome__card-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mn-phome__rule" />

          <div className="mn-phome__themes">
            <button
              type="button"
              className="mn-phome__link"
              title="PowerPoint 的在线模板库（这个外壳里没有）"
              disabled
            >
              更多主题
              <IconChevronRight className="mn-phome__link-icon" />
            </button>
          </div>

          <label className="mn-phome__search">
            <IconSearch className="mn-phome__search-icon" />
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

          <div className="mn-phome__tabs" role="tablist">
            {PPT_HOME_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === tab}
                className={cx('mn-phome__tab', item.id === tab && 'is-active')}
                title={
                  item.id === 'recent'
                    ? '最近打开过的演示文稿'
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

          <div className="mn-phome__list" role="list">
            {rows.map((book) => (
              <div key={book.id} className="mn-phome__row" role="listitem">
                <button
                  type="button"
                  className="mn-phome__open"
                  title={book.title}
                  onClick={() => onOpen(book)}
                >
                  <span className="mn-phome__name">
                    <IconPptFile className="mn-phome__file-icon" />
                    <span className="mn-phome__file">
                      <span className="mn-phome__file-name">{fileNameFor('slide', book.title)}</span>
                      <span className="mn-phome__file-path">
                        原始文件 » {book.fileName}
                        {book.chapterCount > 0 ? ` » ${book.chapterCount} 节` : ''}
                      </span>
                    </span>
                  </span>
                  <span className="mn-phome__when" title={`原始文件 ${formatBytes(book.fileSize)}`}>
                    {formatDateTime(book.lastReadAt || book.addedAt)}
                  </span>
                  <span className="mn-phome__kind">{fileKindLabel('slide')}</span>
                  <span className="mn-phome__size">{formatBytes(book.fileSize)}</span>
                </button>
                <button
                  type="button"
                  className="mn-phome__act"
                  title="解析设置与删除"
                  aria-label={`${book.title} 的更多操作`}
                  onClick={() => onMenu(book)}
                >
                  ⋯
                </button>
              </div>
            ))}

            {rows.length === 0 ? (
              <p className="mn-phome__empty">
                {query.trim() ? `没有匹配「${query}」的文件` : spec.empty}
              </p>
            ) : null}
          </div>

          <div className="mn-phome__more">
            <button
              type="button"
              className="mn-phome__link"
              title="书架上的都在这张列表里"
              disabled
            >
              更多演示文稿
              <IconChevronRight className="mn-phome__link-icon" />
            </button>
          </div>
        </main>
      </div>
    </OfficeFrame>
  )
}

/**
 * 模板卡片上那幅画。
 *
 * 这是**插图**，不是界面：颜色写在 lib/appdocs.ts 的 PPT_TEMPLATES 里（每个模板
 * 自己的封面配色），不跟主题注册表走——和飞书首页那三张卡片同一个例外。
 * 底下的字写的是模板名，是真的；封面上的花纹是几何（天际线 / 花枝 / 色带）。
 */
function TemplateArt({ art }: { art: PptTemplate['art'] }) {
  return (
    <span className="mn-phome__art" style={{ background: art.bg, color: art.fg }} aria-hidden>
      {art.ornament === 'skyline' ? (
        <svg className="mn-phome__art-ink" viewBox="0 0 140 78" fill="none" stroke="currentColor">
          <path d="M4 62h132" strokeWidth="1.2" />
          <path d="M12 62V40h14v22M30 62V28h12v34M46 62V46h9v16M60 62V34h13v28M78 62V22h11v40M94 62V44h10v18M108 62V32h12v30M124 62V50h8v12" strokeWidth="1.2" />
          <path d="M22 92 74 4" strokeWidth="1.4" />
          <path d="M22 34c0-8 6-12 12-12s12 4 12 12-12 22-12 22-12-14-12-22z" strokeWidth="1.3" />
          <path d="M44 22 62 12M56 8l14 4-8 12" strokeWidth="1.3" />
        </svg>
      ) : null}
      {art.ornament === 'blossom' ? (
        <svg className="mn-phome__art-ink" viewBox="0 0 140 78" fill="none" stroke="currentColor">
          <path d="M96 78c-6-22 2-40 22-52" strokeWidth="1.4" />
          <path d="M110 34c-6-6-4-14 3-17 7-3 13 3 12 9-1 7-9 10-15 8z" strokeWidth="1.3" />
          <path d="M120 52c8-3 15 2 14 9-1 6-9 9-14 5-4-3-4-11 0-14z" strokeWidth="1.3" />
          <path d="M100 20c-2-8 4-13 10-11 5 1 7 8 3 12-3 3-10 3-13-1z" strokeWidth="1.3" />
          <path d="M84 62c-6 1-10-3-9-8 1-5 7-7 11-3 3 3 2 9-2 11z" strokeWidth="1.3" />
        </svg>
      ) : null}
      {art.ornament === 'bands' ? (
        <span className="mn-phome__art-band">
          <span className="mn-phome__art-band-title">{art.title}</span>
        </span>
      ) : null}
      {art.title && art.ornament !== 'bands' ? (
        <span className="mn-phome__art-title">{art.title}</span>
      ) : null}
    </span>
  )
}
