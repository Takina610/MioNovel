import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  DOC_FILTERS,
  DOC_LOCATION,
  DOC_TABS,
  avatarOf,
  docOwnerOf,
  docTimeText,
  homeRows,
  pinnedBook,
  type DocFilter,
  type DocSortKey,
  type DocTab,
} from '../lib/appdocs'
import { bookPercent } from '../lib/progress'
import { bookInitial, coverGradient, formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import { useCoverUrl } from '../hooks/useCoverUrl'
import type { BookRecord } from '../db/db'
import { IconChevron, IconClose, IconSearch } from '../components/ui/icons'
import {
  IconBulb,
  IconCloudDrive,
  IconDisplaySettings,
  IconDocFilled,
  IconDocLine,
  IconDockPrint,
  IconDockTools,
  IconDockTrash,
  IconFeishuMark,
  IconFolderLine,
  IconFunnel,
  IconGrid2x2,
  IconGridDots,
  IconHomeFilled,
  IconListDots,
  IconMinutes,
  IconNewDoc,
  IconNodeGraph,
  IconPlusThin,
  IconSideToggle,
  IconSortDown,
  IconTemplates,
  IconUploadBlob,
  IconViewList,
  IconWiki,
} from '../components/ui/app-icons'
import { useHotkeyCombo } from '../store/hotkeys'
import { toggleFullscreen } from '../lib/fullscreen'
import { AppMenu } from './OfficeFrame'
import type { ShelfProps } from './ShelfShell'

/**
 * 云文档首页（飞书形态的书架）。
 *
 * 这一屏照飞书云文档的「主页」摆：左边一条 300px 的空间栏（搜索、主页 / 云盘 /
 * 知识库 / 智能纪要、置顶文档、我的文档库、底部那三个图标），右边是三张动作卡片 +
 * 一条页签 + 一张文档列表，标题栏右上角是搜索 / 关系图 / 助手 / 应用 / 头像。
 *
 * 「真的会发生的事」被摆在真飞书放它们的位置上：
 *
 *   导入 = 三张卡片里的「上传」和「新建」，以及「我的文档库」右边那个加号；
 *   打开 = 列表里点一行（左边那串文档列表也点得动）；
 *   阅读设置 = 头像一个菜单，以及「我的文档库」右边第二个图标；
 *   看哪几本、按什么顺序 = 四个页签、筛选、表头上的排序箭头、显示设置里的列开关。
 *
 * 其余的（云盘、知识库、智能纪要、新建或置顶知识库、模板库、新建视图、顶栏三个图标、
 * 底部那三个）在这个应用里没有对应的东西，一律 `disabled` + `title` 写清为什么——
 * 这是五套外壳从第一版起就守的规矩（见 docs/SPEC.md 决定记录 27）：一个按下去
 * 没反应的按钮比少一个按钮更容易露馅。
 *
 * 颜色一个色号都不写在这里，全走主题 token（styles/doc.css 的同名类）。
 * 两个例外是商标和那三张卡片的彩色插图，它们属于产品记号，不跟主题走。
 */
export function DocHome({
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
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<DocTab>('recent')
  const [filter, setFilter] = useState<DocFilter>('all')
  const [sortKey, setSortKey] = useState<DocSortKey>('recent')
  const [direction, setDirection] = useState<'desc' | 'asc'>('desc')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [columns, setColumns] = useState({ location: true, owner: true, created: true, visited: true })
  const searchRef = useRef<HTMLInputElement>(null)
  const settingsHotkey = useHotkeyCombo('settings')
  const fullscreenHotkey = useHotkeyCombo('fullscreen')
  const dimHotkey = useHotkeyCombo('dim')

  // 列宽是 JS 算出来的（见下面的 gridStyle），所以「窗口窄了要收哪几列」也得由 JS 定：
  // CSS 那边覆盖不了 inline 的 grid-template-columns，硬覆盖会让格子数对不上内容
  const compact = useNarrow('(max-width: 1180px)')
  const tight = useNarrow('(max-width: 960px)')
  const shown = {
    location: columns.location && !tight,
    owner: columns.owner && !compact,
    created: columns.created && !compact,
    visited: columns.visited,
  }

  const all = books ?? []
  const needle = query.trim().toLowerCase()
  const matched = useMemo(
    () =>
      needle
        ? all.filter(
            (book) =>
              book.title.toLowerCase().includes(needle) ||
              book.author.toLowerCase().includes(needle),
          )
        : all,
    [all, needle],
  )
  const rows = useMemo(
    () => homeRows(matched, { tab, filter, sortKey, direction }),
    [matched, tab, filter, sortKey, direction],
  )
  const pinned = useMemo(() => pinnedBook(all), [all])

  const pickTab = (next: DocTab) => {
    setTab(next)
    // 每个页签有自己的默认排法：「最近访问」按最近读的，「归我所有」按加进来的
    setSortKey(next === 'mine' ? 'created' : 'recent')
    setDirection('desc')
  }

  const pickSort = (key: DocSortKey) => {
    if (key === sortKey) setDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setDirection('desc')
    }
  }

  /** 列宽：标题占剩下的，四列数据各 224px，行尾 34px 是 ⋯。和截图里量到的位置一致 */
  const gridStyle = useMemo(() => {
    const tracks = ['minmax(0, 1fr)']
    for (const key of ['location', 'owner', 'created', 'visited'] as const) {
      if (shown[key]) tracks.push('224px')
    }
    tracks.push('34px')
    return { gridTemplateColumns: tracks.join(' ') } as CSSProperties
    // shown 每次渲染都是新对象，但它的值只跟这几个来源有关
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, compact, tight])

  const showTable = tab !== 'shared' && tab !== 'starred'
  const notice = noticeFor({ tab, filter, total: all.length, matched: matched.length, query })

  return (
    <div
      className={cx('mn-doc mn-doc--home', dropping && 'mn-drop-active')}
      style={{ ['--mn-dim' as string]: String(dim) }}
    >
      {/* ---------------- 左边的空间栏 ---------------- */}
      <aside className="mn-doc__side">
        <div className="mn-doc__side-top">
          <button
            type="button"
            className="mn-doc__side-fold"
            title="收起侧边栏（这个外壳里没有）"
            aria-label="收起侧边栏"
            disabled
          >
            <IconSideToggle className="h-[18px] w-[18px]" />
          </button>
          <IconFeishuMark className="mn-doc__mark" />
          <span className="mn-doc__brand-name">飞书云文档</span>
        </div>

        <label className="mn-doc__find">
          <IconSearch className="mn-doc__find-icon h-4 w-4" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索"
            aria-label="搜索文档"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">
              <IconClose className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <div className="mn-doc__side-scroll">
          <nav className="mn-doc__nav" aria-label="云文档">
            <button
              type="button"
              className="mn-doc__navrow is-active"
              aria-current="page"
              title="云文档首页（回到默认视图）"
              onClick={() => {
                setQuery('')
                setFilter('all')
                pickTab('recent')
              }}
            >
              <IconHomeFilled className="mn-doc__nav-icon h-[18px] w-[18px]" />
              主页
            </button>
            <button
              type="button"
              className="mn-doc__navrow"
              title="云盘（这个外壳里没有）"
              disabled
            >
              <IconCloudDrive className="mn-doc__nav-icon h-[18px] w-[18px]" />
              云盘
            </button>
            <button
              type="button"
              className="mn-doc__navrow"
              title="知识库（这个外壳里没有）"
              disabled
            >
              <IconWiki className="mn-doc__nav-icon h-[18px] w-[18px]" />
              知识库
            </button>
            <button
              type="button"
              className="mn-doc__navrow"
              title="智能纪要（这个外壳里没有）"
              disabled
            >
              <IconMinutes className="mn-doc__nav-icon h-[18px] w-[18px]" />
              智能纪要
            </button>
          </nav>

          <div className="mn-doc__side-label">置顶文档</div>
          {pinned ? (
            <button
              type="button"
              className="mn-doc__side-row"
              title={rowHint(pinned)}
              onClick={() => onOpen(pinned)}
            >
              <IconDocLine className="mn-doc__side-icon h-4 w-4" />
              <span className="mn-doc__side-text">{pinned.title}</span>
            </button>
          ) : (
            <p className="mn-doc__side-empty">还没有文档</p>
          )}

          <div className="mn-doc__side-label">置顶知识库</div>
          <button
            type="button"
            className="mn-doc__side-row mn-doc__side-row--ghost"
            title="知识库（这个外壳里没有）"
            disabled
          >
            <IconPlusThin className="mn-doc__side-icon h-[18px] w-[18px]" />
            <span className="mn-doc__side-text">新建或置顶知识库</span>
          </button>

          <div className="mn-doc__side-label mn-doc__side-label--tools">
            <span>我的文档库</span>
            <span className="mn-doc__side-tools">
              <button type="button" title="导入本地文件（新建一篇云文档）" onClick={onImport}>
                <IconPlusThin className="h-4 w-4" />
              </button>
              <button type="button" title="阅读设置（主题也在这里）" onClick={onOpenSettings}>
                <IconListDots className="h-4 w-4" />
              </button>
            </span>
          </div>
          {all.length === 0 ? (
            <p className="mn-doc__side-empty">还没有文档</p>
          ) : (
            all.map((book) => (
              <button
                key={book.id}
                type="button"
                className="mn-doc__side-row"
                title={rowHint(book)}
                onClick={() => onOpen(book)}
              >
                <IconDocLine className="mn-doc__side-icon h-4 w-4" />
                <span className="mn-doc__side-text">{book.title}</span>
              </button>
            ))
          )}
        </div>

        {/* 底部那三个图标：图标照画，动作在这个外壳里没有 */}
        <div className="mn-doc__dock">
          <button type="button" title="打印（这个外壳里没有）" aria-label="打印" disabled>
            <IconDockPrint className="h-[18px] w-[18px]" />
          </button>
          <button type="button" title="工具箱（这个外壳里没有）" aria-label="工具箱" disabled>
            <IconDockTools className="h-[18px] w-[18px]" />
          </button>
          <button type="button" title="回收站（这个外壳里没有）" aria-label="回收站" disabled>
            <IconDockTrash className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      {/* ---------------- 右边：主页 ---------------- */}
      <main className="mn-doc__home mn-veil">
        <header className="mn-doc__top">
          <h1 className="mn-doc__page-title">主页</h1>
          <div className="mn-doc__top-right">
            <button
              type="button"
              className="mn-doc__top-btn"
              title="搜索文档（光标落在左边的搜索框里）"
              aria-label="搜索文档"
              onClick={() => searchRef.current?.focus()}
            >
              <IconSearch className="h-[19px] w-[19px]" />
            </button>
            <button type="button" className="mn-doc__top-btn" title="知识关系图（这个外壳里没有）" aria-label="知识关系图" disabled>
              <IconNodeGraph className="h-[19px] w-[19px]" />
            </button>
            <button type="button" className="mn-doc__top-btn" title="智能助手（这个外壳里没有）" aria-label="智能助手" disabled>
              <IconBulb className="h-[19px] w-[19px]" />
            </button>
            <button type="button" className="mn-doc__top-btn" title="应用中心（这个外壳里没有）" aria-label="应用中心" disabled>
              <IconGridDots className="h-[19px] w-[19px]" />
            </button>
            <AppMenu
              label="账号与设置"
              trigger={
                <span className="mn-doc__avatar mn-doc__avatar--lg" title="我">
                  我
                </span>
              }
              items={[
                { label: '阅读设置（主题也在这里）', hint: settingsHotkey, onSelect: onOpenSettings },
                { label: '导入本地文件', onSelect: onImport },
                {
                  label: dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗文档列表）',
                  hint: dimHotkey,
                  onSelect: onToggleDim,
                },
                { label: '全屏', hint: fullscreenHotkey, onSelect: toggleFullscreen },
              ]}
            />
          </div>
        </header>

        <div className="mn-doc__home-scroll">
          <div className="mn-doc__cards">
            <button
              type="button"
              className="mn-doc__card"
              title="新建文档：选一个本地的 txt / epub"
              onClick={onImport}
            >
              <IconNewDoc className="mn-doc__card-icon mn-doc__card-icon--new" />
              <span className="mn-doc__card-text">
                <span className="mn-doc__card-title">新建</span>
                <span className="mn-doc__card-sub">打开本地 txt / epub</span>
              </span>
              <IconChevron className="mn-doc__card-chevron h-3.5 w-3.5" />
            </button>
            <button type="button" className="mn-doc__card" title="上传本地文件（txt / epub）" onClick={onImport}>
              <IconUploadBlob className="mn-doc__card-icon mn-doc__card-icon--upload" />
              <span className="mn-doc__card-text">
                <span className="mn-doc__card-title">上传</span>
                <span className="mn-doc__card-sub">上传本地文件</span>
              </span>
              <IconChevron className="mn-doc__card-chevron h-3.5 w-3.5" />
            </button>
            <button type="button" className="mn-doc__card" title="模板库（这个外壳里没有）" disabled>
              <IconTemplates className="mn-doc__card-icon mn-doc__card-icon--tpl" />
              <span className="mn-doc__card-text">
                <span className="mn-doc__card-title">模板库</span>
                <span className="mn-doc__card-sub">选择模板快速新建</span>
              </span>
            </button>
          </div>

          <div className="mn-doc__tabs" role="tablist" aria-label="文档视图">
            {DOC_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === tab}
                className={cx('mn-doc__tab', item.id === tab && 'is-active')}
                onClick={() => pickTab(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button type="button" className="mn-doc__tab-add" title="新建视图（这个外壳里没有）" aria-label="新建视图" disabled>
              <IconPlusThin className="h-4 w-4" />
            </button>

            <span className="mn-doc__tabs-gap" />

            <div className="mn-doc__view">
              <AppMenu
                label="筛选"
                trigger={
                  <span className="mn-doc__viewbtn">
                    <IconFunnel className="h-4 w-4" />
                    筛选
                  </span>
                }
                items={DOC_FILTERS.map((item) => ({
                  label: item.label,
                  checked: filter === item.id,
                  onSelect: () => setFilter(item.id),
                }))}
              />
              <AppMenu
                label="显示设置"
                trigger={
                  <span className="mn-doc__viewbtn">
                    <IconDisplaySettings className="h-4 w-4" />
                    显示设置
                  </span>
                }
                items={[
                  { label: '位置', checked: columns.location, onSelect: () => setColumns((c) => ({ ...c, location: !c.location })) },
                  { label: '所有者', checked: columns.owner, onSelect: () => setColumns((c) => ({ ...c, owner: !c.owner })) },
                  { label: '创建时间', checked: columns.created, onSelect: () => setColumns((c) => ({ ...c, created: !c.created })) },
                  { label: '最近访问', checked: columns.visited, onSelect: () => setColumns((c) => ({ ...c, visited: !c.visited })) },
                ]}
              />
              <div className="mn-doc__segmented" role="group" aria-label="视图">
                <button
                  type="button"
                  className={cx('mn-doc__segment', layout === 'list' && 'is-active')}
                  title={layout === 'list' ? '列表视图（当前）' : '切到列表视图'}
                  aria-pressed={layout === 'list'}
                  onClick={() => setLayout('list')}
                >
                  <IconViewList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={cx('mn-doc__segment', layout === 'grid' && 'is-active')}
                  title={layout === 'grid' ? '网格视图（当前）' : '切到网格视图'}
                  aria-pressed={layout === 'grid'}
                  onClick={() => setLayout('grid')}
                >
                  <IconGrid2x2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {books === undefined ? (
            <p className="mn-doc__notice">正在打开书架…</p>
          ) : !showTable || rows.length === 0 ? (
            <p className="mn-doc__notice">{notice}</p>
          ) : layout === 'list' ? (
            <div className="mn-doc__table" role="table">
              <div className="mn-doc__head-row" role="row" style={gridStyle}>
                <span className="mn-doc__cell">标题</span>
                {shown.location ? <span className="mn-doc__cell">位置</span> : null}
                {shown.owner ? <span className="mn-doc__cell">所有者</span> : null}
                {shown.created ? (
                  <SortHead
                    label="创建时间"
                    active={sortKey === 'created'}
                    direction={direction}
                    onClick={() => pickSort('created')}
                  />
                ) : null}
                {shown.visited ? (
                  <SortHead
                    label="最近访问"
                    active={sortKey === 'recent'}
                    direction={direction}
                    onClick={() => pickSort('recent')}
                  />
                ) : null}
                <span />
              </div>

              {rows.map((book) => (
                <div key={book.id} className="mn-doc__row" role="row" style={gridStyle}>
                  <button
                    type="button"
                    className="mn-doc__cell mn-doc__open"
                    title={rowHint(book)}
                    onClick={() => onOpen(book)}
                  >
                    <IconDocFilled className="mn-doc__file" />
                    <span className="mn-doc__title-text">{book.title}</span>
                  </button>
                  {shown.location ? (
                    <span className="mn-doc__cell mn-doc__cell--soft">
                      <IconFolderLine className="mn-doc__folder" />
                      {DOC_LOCATION}
                    </span>
                  ) : null}
                  {shown.owner ? (
                    <span className="mn-doc__cell mn-doc__cell--soft">
                      <span className="mn-doc__owner">{avatarOf(book.author)}</span>
                      {docOwnerOf(book)}
                    </span>
                  ) : null}
                  {shown.created ? (
                    <span className="mn-doc__cell mn-doc__cell--soft">{docTimeText(book.addedAt)}</span>
                  ) : null}
                  {shown.visited ? (
                    <span className="mn-doc__cell mn-doc__cell--soft">
                      {docTimeText(book.lastReadAt || book.addedAt)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="mn-doc__row-more"
                    title="更多操作（解析设置与删除）"
                    aria-label={`${book.title} 的更多操作`}
                    onClick={() => onMenu(book)}
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mn-doc__grid">
              {rows.map((book) => (
                <DocCard key={book.id} book={book} onOpen={onOpen} onMenu={onMenu} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

/** 表头里能排序的那两列 */
function SortHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cx('mn-doc__cell mn-doc__sort', active && 'is-active')}
      title={active ? `${label}：点一下换个方向` : `按${label}排`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
      {active ? (
        <IconSortDown className={cx('mn-doc__sort-arrow', direction === 'asc' && 'is-asc')} />
      ) : null}
    </button>
  )
}

/** 网格视图里的一张卡：封面（没有封面就用书名渐变）、书名、两行说明 */
function DocCard({
  book,
  onOpen,
  onMenu,
}: {
  book: BookRecord
  onOpen: (book: BookRecord) => void
  onMenu: (book: BookRecord) => void
}) {
  const coverUrl = useCoverUrl(book.cover)
  const [from, to] = coverGradient(book.title)
  return (
    <div className="mn-doc__cardtile">
      <button type="button" className="mn-doc__tile-open" title={rowHint(book)} onClick={() => onOpen(book)}>
        <span className="mn-doc__thumb">
          {coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <span className="mn-doc__thumb-fallback" style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}>
              {bookInitial(book.title)}
            </span>
          )}
        </span>
        <span className="mn-doc__tile-title">{book.title}</span>
        <span className="mn-doc__tile-sub">
          {docOwnerOf(book)} · {docTimeText(book.lastReadAt || book.addedAt)}
        </span>
      </button>
      <button
        type="button"
        className="mn-doc__row-more mn-doc__row-more--tile"
        title="更多操作（解析设置与删除）"
        aria-label={`${book.title} 的更多操作`}
        onClick={() => onMenu(book)}
      >
        ⋯
      </button>
    </div>
  )
}

/** 鼠标放上去那一行给出的实话：读到哪了、多少字 */
function rowHint(book: BookRecord): string {
  const parts = [book.title]
  if (book.state === 'error') parts.push('解析失败，行尾 ⋯ 里可以改规则重来')
  else if (book.state === 'importing') parts.push('正在导入')
  else {
    parts.push(`第 ${book.progress ? book.progress.chapterIndex + 1 : 1}/${book.chapterCount} 章`)
    parts.push(`已读 ${formatPercent(book.progress ? bookPercent(book, book.progress.chapterIndex, book.progress.ratio) : 0)}`)
    parts.push(formatChars(book.totalChars))
  }
  return parts.join(' · ')
}

/**
 * 列表空着的时候写什么。
 *
 * 三种空法原因不同，说法也得不同：书架本来就是空的、搜索没搜到、
 * 这个页签（或这一档筛选）在这个应用里没有对应的东西。
 */
function noticeFor({
  tab,
  filter,
  total,
  matched,
  query,
}: {
  tab: DocTab
  filter: DocFilter
  total: number
  matched: number
  query: string
}): string {
  if (total === 0) return '还没有文档'
  if (query.trim() && matched === 0) return `没有匹配「${query.trim()}」的文档`
  if (tab === 'shared') return '没有共享给你的文档'
  if (tab === 'starred') return '没有收藏'
  if (filter !== 'all') {
    const label = DOC_FILTERS.find((item) => item.id === filter)?.label ?? ''
    return `没有${label}的文档`
  }
  return '没有文档'
}

/**
 * 窗口是不是窄到某个程度。
 *
 * 只用来决定列表中收哪几列——列宽是 JS 算的（gridStyle），CSS 覆盖不了那串
 * inline 的 grid-template-columns：硬覆盖会让格子数和单元格数对不上，
 * 多出来的格子会掉到下一行去。
 */
function useNarrow(query: string): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return narrow
}
