import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BookRecord } from '../db/db'
import { avatarHue, avatarInitial, sessionUnread } from '../lib/chat'
import {
  DESK_FILTERS,
  DESK_PANEL_TABS,
  DESK_RAIL,
  deskChapterPayText,
  deskChapterRows,
  deskChapterStateText,
  deskChapterSummary,
  deskEmptyText,
  deskIdleDays,
  deskListTime,
  deskPercentText,
  deskRows,
  deskStats,
  deskUnreadTotal,
  deskViewTitle,
  type DeskFilter,
  type DeskPanelTab,
  type DeskView,
} from '../lib/desk'
import { readStateOf, wordDateText } from '../lib/appdocs'
import { formatBytes, formatChars } from '../lib/format'
import { cx } from '../lib/cx'
import { toggleFullscreen } from '../lib/fullscreen'
import { useHotkeyCombo } from '../store/hotkeys'
import { listThemes, themePreset } from '../themes/apply'
import {
  IconChevron,
  IconClose,
  IconMenu,
  IconSearch,
  IconSliders,
} from '../components/ui/icons'
import {
  IconDeskAdjust,
  IconDeskApps,
  IconDeskCustomer,
  IconDeskDash,
  IconDeskExternal,
  IconDeskFlag,
  IconDeskFold,
  IconDeskGrid,
  IconDeskNotice,
  IconDeskOnline,
  IconDeskNut,
  IconDeskOpportunity,
  IconDeskPersonAdd,
  IconDeskQuick,
  IconDeskReception,
  IconDeskRefresh,
  IconDeskService,
  IconDeskSkin,
  IconDeskSolved,
  IconDeskTimer,
  IconEditPencil,
  IconFullscreen,
  IconNewDoc,
  IconPicture,
  IconPlusThin,
  IconScissors,
  IconSmile,
  IconThumbUp,
} from '../components/ui/app-icons'
import { AppMenu } from './OfficeFrame'
import type { AppFrameProps } from './types'
import type { ShelfProps } from './ShelfShell'

/**
 * 1688 客户工作台形态。
 *
 * 2026-09-24 按用户给的 1920×1033 截图一比一复刻（尺寸都在 styles/desk.css 开头的
 * 注释里，是从像素里量出来的）：最左一条 64px 的品牌蓝功能栏（八格「图标 + 小字」），
 * 顶上一条 96px 的白条（左边身份、中间四个指标、右边窗口按钮与页签），
 * 下面一屏分三列——240 的会话列表、中间的聊天窗口、右边 450 的客户档案，
 * 聊天窗口底部是客服工具区（快捷话术那一排药丸、图标行、白盒子里的进度与发送）。
 *
 * 映射见 lib/desk.ts 的开头。这一层只决定「怎么摆」和「哪些是真的」：
 *
 * 1. **会响的都真响。** 功能栏五格换的是列表怎么列（接待 / 客户 / 客服 / 通知 / 商机），
 *    列表上那五个页签是真筛选，窗口按钮里「新建」是导入、「皮肤」是换主题、
 *    「最大化」是全屏、「关闭」是回工作台；聊天头部那几个按钮分别是回到本章开头、
 *    导入、会话状态菜单、收起右侧面板；底部那排药丸和图标都是这个阅读器本来就有的
 *    动作（药丸是上一章 / 下一章 / 目录 / 阅读设置，图标是章节目录 / 导入 / 字号 /
 *    下一章 / 双语对照 / 把聊天框折下去）。
 * 2. **只读文档里本来就该灰的一律 disabled + title**：表情、点赞、定时消息、标记、
 *    最小化、应用中心——1688 里这几格也确实是「那个软件自己的东西」。
 * 3. **不编数据。** 会话列表上的时间是这本书真实的最近阅读时间，[未读] 是还没读完的
 *    章数，顶上四个指标是数出来的，右侧档案里的每个数都从书上算，订单追踪里一行是一章。
 * 3.5 **底部那个回复框可以收起来**（工具条最右那一格）：收起来之后消息区多出一屏，
 *    工具条留着、按钮就在它上面（做法照企业微信那一副外壳的「收起输入区」）。
 * 4. **底部那个白盒子不是假输入框。** 真客服在这里打字，我们打不了——所以那个位置
 *    放的是**读到哪里了**（一行真数据 + 一条能拖的进度条），右下角「发送」的位置
 *    是「下一章」，「关闭」是回会话列表（和企业微信那副外壳同一个处理，见决定记录 27）。
 * 5. **「已读 / 未读」是算出来的，不是编的。** 右侧那一条回执按阅读位置给：
 *    消息结尾落在当前进度之前 = 已读，之后 = 未读（见 lib/desk.ts 的 deskReceipts）。
 *    所以往下读几屏，那一列会一条条变成「已读」——它是这一屏里最像客服工具、也最经得住
 *    看的一处。
 */
export function DeskApp(props: AppFrameProps) {
  const { book, books, chapters } = props
  const [view, setView] = useState<DeskView>('reception')
  const [filter, setFilter] = useState<DeskFilter>('now')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<DeskPanelTab>('detail')
  /** 客户档案那张卡摊开没有（1688 那一行右边写着「收起 ⌃」） */
  const [detailOpen, setDetailOpen] = useState(true)
  /** 订单追踪那一节摊开没有 */
  const [ordersOpen, setOrdersOpen] = useState(true)
  /** 「查看原始文件信息」摊开没有（真值：磁盘上的原文件名与大小） */
  const [fileOpen, setFileOpen] = useState(false)
  /**
   * 底部那个白盒子（回复框）收起来没有。**做法照企业微信那一副外壳**：
   * 收的是这个盒子（这一章的位置 + 进度条 + 「关闭 / 发送」那一行），工具条留着——
   * 切换的按钮就在工具条上，收完还得能放下来。长章读到一半时会想收一下：
   * 消息区一次多出一屏。
   */
  const [composerOpen, setComposerOpen] = useState(true)
  /**
   * 右边那块面板。窄屏上默认收着——三列一摆，聊天窗口只剩不到 700 宽，
   * 那不是聊天窗口，是一条缝（和企业微信窄屏收列表同一个判断）。
   */
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1300)
  const panelTouched = useRef(false)
  const togglePanel = () => {
    panelTouched.current = true
    setPanelOpen((open) => !open)
  }
  useEffect(() => {
    const sync = () => {
      if (panelTouched.current) return
      if (window.innerWidth >= 1300) setPanelOpen(true)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])


  /** 窄屏上会话列表是浮层：64 + 240 之后只剩不到 100 给聊天窗口（同企业微信那副） */
  const [listOpen, setListOpen] = useState(false)
  /** 消息区。两个用途：钻进去找滚动容器（回到本章开头），以及给摸鱼的黑纱当底 */
  const stageRef = useRef<HTMLDivElement>(null)

  const settingsHotkey = useHotkeyCombo('settings')
  const fullscreenHotkey = useHotkeyCombo('fullscreen')
  const dimHotkey = useHotkeyCombo('dim')

  const all = books ?? []
  const chapterLabel = props.chapterTitle || `第 ${props.chapterIndex + 1} 章`
  /** 章内进度：左边的会话摘要、右边的订单行、底部那颗药丸都按它算 */
  const percent = props.chapterPercent
  const stats = useMemo(() => deskStats(all, percent), [all, percent])
  const unreadTotal = deskUnreadTotal(all)
  /** 这一章里有没有第二种语言（双语书才有）——「译」那一格靠它决定能不能按 */
  const hasAlt = (props.chapterHtml ?? '').includes('data-mn-lang')
  const chapterRows = useMemo(
    () => deskChapterRows(chapters, book.progress, props.chapterCount),
    [chapters, book.progress, props.chapterCount],
  )
  const summary = useMemo(() => deskChapterSummary(chapterRows), [chapterRows])
  const currentRow = chapterRows.find((row) => row.index === props.chapterIndex)
  /**
   * 「订单追踪」那一节列的是**从当前这一章往下**几章（订单列表也是从最近的往下排），
   * 整本书的目录在「客户订单」那个页签里。到底了就从最后几章往前凑。
   */
  const recentRows = useMemo(() => {
    const start = Math.max(0, Math.min(props.chapterIndex, chapterRows.length - 8))
    return chapterRows.slice(start, start + 8)
  }, [chapterRows, props.chapterIndex])

  const idle = deskIdleDays(book)
  const groups = useMemo(() => deskRows(all, view, { filter, query }), [all, view, filter, query])
  const shown = useMemo(
    () => groups.reduce((sum, group) => sum + group.books.length, 0),
    [groups],
  )

  /**
   * 「回到本章开头」：把消息区卷回顶。
   *
   * 直接写 scrollTop 而不是 smooth：这个环境（以及后台标签页）里 rAF 不跑，
   * 平滑滚动会变成「按下去什么都没发生」（见 docs/SPEC.md 决定记录 20 那条）。
   */
  const backToChapterTop = () => {
    const scroller = stageRef.current?.querySelector<HTMLElement>('.mn-scroll')
    if (scroller) scroller.scrollTop = 0
  }

  const pills = [
    {
      id: 'prev',
      label: '上一章',
      title: '上一章',
      disabled: props.chapterIndex <= 0,
      run: () => props.onChapter(props.chapterIndex - 1),
    },
    {
      id: 'next',
      label: '下一章',
      title: '下一章',
      disabled: props.chapterIndex >= props.chapterCount - 1,
      run: () => props.onChapter(props.chapterIndex + 1),
    },
    {
      id: 'toc',
      label: '目录',
      title: '目录（右边那块面板里一章一行）',
      run: () => {
        setTab('orders')
        setPanelOpen(true)
      },
    },
    { id: 'settings', label: '阅读设置', title: '阅读设置', run: props.onOpenSettings },
  ]

  const fileInput = (
    <button
      type="button"
      className="mn-desk__wbtn"
      title="导入文件"
      aria-label="导入文件"
      onClick={() => props.onImport?.()}
    >
      <IconNewDoc className="mn-desk__wicon" />
    </button>
  )

  return (
    <div
      className="mn-desk"
      style={{ ['--mn-dim' as string]: String(props.dim) }}
      data-list={listOpen ? 'open' : 'closed'}
    >
      {/* ---------------- 最左边那条功能栏 ---------------- */}
      <nav className="mn-desk__rail" aria-label="工作台">
        {DESK_RAIL.filter((item) => !item.bottom).map((item) => (
          <button
            key={item.id}
            type="button"
            className="mn-desk__rail-btn"
            title={item.label}
            aria-label={item.label}
            aria-pressed={item.view ? view === item.view : undefined}
            onClick={() => {
              if (item.view) {
                setView(item.view)
                setListOpen(false)
              }
            }}
          >
            <span className="mn-desk__rail-icon">
              {RAIL_ICONS[item.id]}
              {item.id === 'notice' && unreadTotal > 0 ? (
                <span className="mn-desk__rail-badge" title={`还有 ${unreadTotal} 章没读完`}>
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              ) : null}
            </span>
            <span className="mn-desk__rail-label">{item.label}</span>
          </button>
        ))}
        <span className="mn-desk__rail-gap" />
        {DESK_RAIL.filter((item) => item.bottom).map((item) => {
          const run =
            item.action === 'home'
              ? props.onBack
              : item.action === 'settings'
                ? props.onOpenSettings
                : undefined
          return (
            <button
              key={item.id}
              type="button"
              className="mn-desk__rail-btn mn-desk__rail-btn--bare"
              title={item.why ?? item.label}
              aria-label={item.label}
              disabled={!run}
              onClick={run}
            >
              {RAIL_ICONS[item.id]}
            </button>
          )
        })}
      </nav>

      <div className="mn-desk__work">
        {/* ---------------- 顶上那一条：身份 / 指标 / 窗口按钮与页签 ---------------- */}
        <header className="mn-desk__top">
          <div className="mn-desk__ident">
            {/* 「1688」是产品记号：色号写死在 desk.css 里（同飞书的商标、PPT 的记号） */}
            <span className="mn-desk__mark" aria-hidden>
              1688
            </span>
            <AppMenu
              label="工作台状态与菜单"
              trigger={
                <button type="button" className="mn-desk__status">
                  <IconDeskOnline className="mn-desk__dot" />
                  <span>在线</span>
                  <span className="mn-desk__status-sub">共 {all.length} 个会话</span>
                  <IconChevron className="mn-desk__status-caret" />
                </button>
              }
              items={[
                { label: '导入文件', onSelect: () => props.onImport?.() },
                { label: '阅读设置', hint: settingsHotkey, onSelect: props.onOpenSettings },
                {
                  label: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）',
                  hint: dimHotkey,
                  onSelect: props.onToggleDim,
                },
                { label: '全屏', hint: fullscreenHotkey, onSelect: toggleFullscreen },
                { label: '回到工作台首页', separatorBefore: true, onSelect: props.onBack },
              ]}
            />
          </div>

          <div className="mn-desk__stats">
            {stats.map((stat) => (
              <span key={stat.label} className="mn-desk__stat" title={stat.title}>
                <span className="mn-desk__stat-value">{stat.value}</span>
                <span className="mn-desk__stat-label">{stat.label}</span>
              </span>
            ))}
          </div>

          <div className="mn-desk__topright">
            <div className="mn-desk__winctl">
              {fileInput}
              <button
                type="button"
                className="mn-desk__wbtn"
                title="标记（这个外壳里没有标记）"
                aria-label="标记"
                disabled
              >
                <IconDeskFlag className="mn-desk__wicon" />
              </button>
              {/* 「皮肤」= 换主题：菜单里就是主题注册表（选一套连排版预设一起换） */}
              <AppMenu
                label="皮肤：换一套主题"
                trigger={
                  <button type="button" className="mn-desk__wbtn" title="皮肤（换主题）">
                    <IconDeskSkin className="mn-desk__wicon" />
                  </button>
                }
                items={listThemes().map((theme) => ({
                  label: theme.name,
                  checked: theme.id === props.settings.themeId,
                  onSelect: () =>
                    props.onSettingsChange({ themeId: theme.id, ...themePreset(theme.id) }),
                }))}
              />
              <button
                type="button"
                className="mn-desk__wbtn"
                title="最小化（浏览器里没有最小化）"
                aria-label="最小化"
                disabled
              >
                <IconDeskDash className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="最大化（把窗口全屏）"
                aria-label="最大化"
                onClick={toggleFullscreen}
              >
                <IconFullscreen className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="关闭这个会话，回到工作台"
                aria-label="关闭"
                onClick={props.onBack}
              >
                <IconClose className="mn-desk__wicon" />
              </button>
            </div>
            {panelOpen ? (
              <div className="mn-desk__paneltabs" role="tablist">
                {DESK_PANEL_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === tab}
                    className={cx('mn-desk__paneltab', item.id === tab && 'is-active')}
                    title={item.why ?? item.label}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="mn-desk__panelrefresh"
                  title="重新读一遍这一段（图片、字体晚一步就位时用它）"
                  onClick={backToChapterTop}
                >
                  <IconDeskRefresh className="mn-desk__wicon" />
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mn-desk__body">
          {/* ---------------- 会话列表（折下去之后它会拉宽铺满） ---------------- */}
          <aside className="mn-desk__list" aria-label={deskViewTitle(view, filter)}>
            <div className="mn-desk__search">
              <label className="mn-desk__search-box">
                <IconSearch className="mn-desk__search-icon" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="联系人、聊天记录"
                  aria-label="搜索联系人、聊天记录"
                />
                {query ? (
                  <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
            </div>

            <div className="mn-desk__filters" role="tablist" aria-label="筛选">
              {DESK_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === filter}
                  className={cx('mn-desk__filter', item.id === filter && 'is-active')}
                  title={item.title}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mn-desk__list-body">
              {books === undefined ? (
                <p className="mn-office__side-hint">正在打开书架…</p>
              ) : all.length === 0 ? (
                <p className="mn-office__side-hint">还没有会话</p>
              ) : shown === 0 ? (
                <p className="mn-office__side-hint">
                  {query.trim() ? `没有匹配「${query}」的会话` : deskEmptyText(view)}
                </p>
              ) : (
                groups.map((group, index) =>
                  group.books.length === 0 ? null : (
                    <div key={`${group.label ?? 'default'}-${index}`} className="mn-desk__group">
                      {group.label ? (
                        <div className="mn-desk__group-head">
                          <span className="mn-desk__group-label">{group.label}</span>
                          {group.hint ? (
                            <span className="mn-desk__group-hint">{group.hint}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {group.books.map((item) => (
                        <SessionRow
                          key={item.id}
                          book={item}
                          currentBookId={book.id}
                          chapterIndex={props.chapterIndex}
                          onClick={() => {
                            setListOpen(false)
                            if (item.id !== book.id) props.onOpenBook?.(item)
                          }}
                        />
                      ))}
                    </div>
                  ),
                )
              )}
            </div>

            <div className="mn-desk__list-foot">
              <span className="mn-desk__list-count">{deskViewTitle(view, filter)}</span>
              <span className="mn-desk__list-hint">
                {shown}/{all.length}
              </span>
            </div>

          </aside>

          {/* ---------------- 中间：聊天窗口 ---------------- */}
          <main className="mn-desk__main">
            <header className="mn-desk__chathead">
              <button
                type="button"
                className="mn-desk__list-toggle"
                title={listOpen ? '收起会话列表' : '展开会话列表'}
                aria-pressed={listOpen}
                aria-label="会话列表"
                onClick={() => setListOpen((open) => !open)}
              >
                <IconDeskReception className="h-4 w-4" />
              </button>
              <span
                className="mn-desk__peer-avatar"
                style={{ ['--mn-dhue' as string]: String(sessionHue(book)) }}
                aria-hidden
              >
                {avatarInitial(book.author || book.title)}
              </span>
              <span className="mn-desk__peer-name" title={book.title}>
                {book.title}
              </span>
              <span className="mn-desk__peer-tag">
                [{sessionTagOf(book)}]
              </span>
              <span className="flex-1" />
              <div className="mn-desk__head-actions">
                <button
                  type="button"
                  className="mn-desk__icon-btn"
                  title="回到本章开头"
                  aria-label="回到本章开头"
                  onClick={backToChapterTop}
                >
                  <IconDeskRefresh className="mn-desk__head-icon" />
                </button>
                <button
                  type="button"
                  className="mn-desk__icon-btn"
                  title="导入文件（添一个会话）"
                  aria-label="导入文件"
                  onClick={() => props.onImport?.()}
                >
                  <IconDeskPersonAdd className="mn-desk__head-icon" />
                </button>
                <AppMenu
                  label="会话状态"
                  trigger={
                    <span className="mn-desk__head-menu" title="会话状态与跳转">
                      <IconDeskSolved className="mn-desk__head-icon" />
                      <IconChevron className="mn-desk__head-caret" />
                    </span>
                  }
                  items={[
                    {
                      label: '读完了，翻到下一章',
                      onSelect: () =>
                        props.onChapter(Math.min(props.chapterCount - 1, props.chapterIndex + 1)),
                    },
                    { label: '回到本章开头', onSelect: backToChapterTop },
                    { label: '回到会话列表', separatorBefore: true, onSelect: props.onBack },
                  ]}
                />
                <button
                  type="button"
                  className={cx('mn-desk__icon-btn', panelOpen && 'is-active')}
                  title={panelOpen ? '收起右侧面板' : '展开右侧面板'}
                  aria-pressed={panelOpen}
                  aria-label="右侧面板"
                  onClick={togglePanel}
                >
                  <IconMenu className="mn-desk__head-icon" />
                </button>
              </div>
            </header>

            {/* 消息区。mn-veil：摸鱼模式的黑纱盖在这一片上（功能栏、列表、面板、工具区不压） */}
            <div ref={stageRef} className="mn-desk__stage mn-veil">
              {props.children}
            </div>

            {/* ---------------- 底部：客服工具区 ---------------- */}
            <footer className="mn-desk__composer">
              <div className="mn-desk__quick">
                <button
                  type="button"
                  className="mn-desk__chip"
                  title={`正在读「${chapterLabel}」，这一章已读 ${Math.round(percent * 100)}%`}
                  onClick={() => {
                    setTab('orders')
                    setPanelOpen(true)
                  }}
                >
                  <span className="mn-desk__chip-icon" aria-hidden>
                    <IconDeskQuick className="h-3.5 w-3.5" />
                  </span>
                  第 {props.chapterIndex + 1} 章 · 已读 {Math.round(percent * 100)}%
                </button>
                {pills.map((pill) => (
                  // 药丸都是「按一下就去做一件事」，没有开关型的（所以没有 is-active
                  // 那一档：原来只有摸鱼模式那颗用得上，它已经挪走了）
                  <button
                    key={pill.id}
                    type="button"
                    className="mn-desk__pill"
                    title={pill.title}
                    disabled={pill.disabled}
                    onClick={pill.run}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="mn-desk__tools">
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="表情（这个外壳里没有表情）"
                  aria-label="表情"
                  disabled
                >
                  <IconSmile className="mn-desk__tool-icon" />
                </button>
                {/* 快捷短语那一格 = 章节目录（真 1688 里它开的是常用语） */}
                <AppMenu
                  label="章节目录"
                  trigger={
                    <span className="mn-desk__tool-caret" title="章节目录">
                      <IconScissors className="mn-desk__tool-icon" />
                      <IconChevron className="mn-desk__tool-caret-icon" />
                    </span>
                  }
                  items={chapterRows.map((row) => ({
                    label: `${row.index + 1}. ${row.label}`,
                    checked: row.index === props.chapterIndex,
                    onSelect: () => props.onChapter(row.index),
                  }))}
                />
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="导入文件"
                  aria-label="导入文件"
                  onClick={() => props.onImport?.()}
                >
                  <IconPicture className="mn-desk__tool-icon" />
                </button>
                {/* 字号那一格（1688 里那个记号是换算，位置一模一样） */}
                <AppMenu
                  label="字号"
                  trigger={
                    <span className="mn-desk__tool-caret" title={`字号：${props.settings.fontSize}`}>
                      <IconDeskAdjust className="mn-desk__tool-icon" />
                      <IconChevron className="mn-desk__tool-caret-icon" />
                    </span>
                  }
                  items={[14, 15, 16, 17, 18, 20].map((size) => ({
                    label: String(size),
                    checked: props.settings.fontSize === size,
                    onSelect: () => props.onSettingsChange({ fontSize: size }),
                  }))}
                />
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="读完这一章（翻到下一章）"
                  aria-label="读完这一章"
                  disabled={props.chapterIndex >= props.chapterCount - 1}
                  onClick={() => props.onChapter(props.chapterIndex + 1)}
                >
                  <IconThumbUp className="mn-desk__tool-icon" />
                </button>
                {/* 「译」= 双语对照（真图标就是一个 circled 译，写一个字比画一个准） */}
                <button
                  type="button"
                  className={cx(
                    'mn-desk__tool',
                    'mn-desk__tool--glyph',
                    props.settings.bilingual === 'both' && 'is-active',
                  )}
                  title={
                    !hasAlt
                      ? '这本书里没有第二种语言的段落'
                      : props.settings.bilingual === 'both'
                        ? '双语对照显示（按一下只看译文）'
                        : '只看译文（按一下恢复对照）'
                  }
                  aria-label="双语对照"
                  disabled={!hasAlt}
                  onClick={() =>
                    props.onSettingsChange({
                      bilingual: props.settings.bilingual === 'both' ? 'primary' : 'both',
                    })
                  }
                >
                  译
                </button>

                <span className="flex-1" />

                <button
                  type="button"
                  className="mn-desk__tool"
                  title="定时消息（这个外壳里没有）"
                  aria-label="定时消息"
                  disabled
                >
                  <IconDeskTimer className="mn-desk__tool-icon" />
                  <IconChevron className="mn-desk__tool-caret-icon" />
                </button>
                {/* 收起 / 展开底部那个回复框。收了之后只剩这一条工具条，按钮就在它上面
                    （和企业微信那一副外壳的「收起输入区」是同一个做法、同一个位置）。
                    真 1688 的工具条右端是「语音通话 / 视频通话」这类会话级的图标，
                    这一格摆这个动作；回书架有白盒子的「关闭」、窗口的 ×、
                    头部的「会话状态」菜单和功能栏的「工作台」，不归它管。 */}
                <button
                  type="button"
                  className="mn-desk__tool mn-desk__tool--fold"
                  title={composerOpen ? '收起回复框' : '展开回复框'}
                  aria-label={composerOpen ? '收起回复框' : '展开回复框'}
                  aria-pressed={!composerOpen}
                  onClick={() => setComposerOpen((open) => !open)}
                >
                  {/* 开着的箭头朝下（按下去收到底）、收着的朝上（按下去放回来） */}
                  <IconDeskFold
                    className={cx('mn-desk__tool-icon', !composerOpen && 'rotate-180')}
                  />
                </button>
              </div>

              {/* 那个白盒子：真客服在这里打字，我们打不了，所以放的是读到哪里了。
                  收起来之后这一整块不画，工具条照旧——和企业微信那一副一模一样 */}
              {composerOpen ? (
              <div className="mn-desk__draft">
                <div className="mn-desk__draft-line">
                  <span className="mn-desk__draft-label" title={chapterLabel}>
                    {chapterLabel}
                  </span>
                  <span className="mn-desk__draft-hint">
                    本章 {formatChars(props.chapterChars ?? 0)} · 全书 {deskPercentText(book)}
                  </span>
                </div>
                <input
                  type="range"
                  className="mn-range mn-desk__range"
                  min={0}
                  max={1000}
                  step={1}
                  value={Math.round(props.percent * 1000)}
                  onChange={(event) => props.onSeek(Number(event.target.value) / 1000)}
                  aria-label="全书进度"
                  title="拖一下换位置（这个外壳里没有输入框：发不出去的框不如一个有用的滑条）"
                />
                <div className="mn-desk__send-row">
                  <button
                    type="button"
                    className="mn-desk__btn"
                    title="回到会话列表"
                    onClick={props.onBack}
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    className="mn-desk__btn mn-desk__btn--send"
                    title="下一章"
                    disabled={props.chapterIndex >= props.chapterCount - 1}
                    onClick={() => props.onChapter(props.chapterIndex + 1)}
                  >
                    发送
                    <span className="mn-desk__btn-split" aria-hidden />
                    <IconChevron className="mn-desk__btn-caret" />
                  </button>
                </div>
              </div>
              ) : null}
            </footer>

          </main>

          {/* ---------------- 右边：客户档案 ---------------- */}
          {panelOpen ? (
            <aside className="mn-desk__panel" aria-label="客户详情">
              <div className="mn-desk__panel-body">
                {tab === 'detail' ? (
                  <>
                    <section className="mn-desk__card">
                      <div className="mn-desk__card-head">
                        <span className="mn-desk__card-title" title={book.title}>
                          {book.title}
                        </span>
                        <button
                          type="button"
                          className="mn-desk__fold"
                          aria-expanded={detailOpen}
                          title={detailOpen ? '收起' : '展开'}
                          onClick={() => setDetailOpen((open) => !open)}
                        >
                          {detailOpen ? '收起' : '展开'}
                          <IconChevron className={cx('mn-desk__fold-icon', detailOpen && 'is-up')} />
                        </button>
                      </div>
                      {detailOpen ? (
                        <div className="mn-desk__fields">
                          <Field label="书籍身份">
                            <span className="mn-desk__valchip">{book.format.toUpperCase()}</span>
                          </Field>
                          <Field label="书架关系">
                            <span className="mn-desk__tags">
                              <span className="mn-desk__tagline">{book.format.toUpperCase()}</span>
                              <span className="mn-desk__tagline is-accent">
                                {STATE_TEXT[readStateOf(book)]}
                              </span>
                              <span className="mn-desk__tagline is-accent">
                                共 {props.chapterCount} 章
                              </span>
                              <span className="mn-desk__tagline is-ok">
                                {formatChars(book.totalChars)}
                              </span>
                              <button
                                type="button"
                                className="mn-desk__field-icon"
                                title={fileOpen ? '收起文件信息' : '查看原始文件信息'}
                                aria-expanded={fileOpen}
                                aria-label="原始文件信息"
                                onClick={() => setFileOpen((open) => !open)}
                              >
                                <IconDeskExternal className="h-4 w-4" />
                              </button>
                            </span>
                          </Field>
                          <Field label="阅读情况">
                            <span className="mn-desk__field-line">
                              <span className="mn-desk__field-key">最近阅读</span>
                              <span className="mn-desk__field-value">
                                {book.lastReadAt ? deskListTime(book.lastReadAt) : '还没读过'}
                              </span>
                              <span className="mn-desk__field-rule" aria-hidden />
                              <span className="mn-desk__field-key">导入</span>
                              <span className="mn-desk__field-value">{wordDateText(book.addedAt)}</span>
                            </span>
                            <span className="mn-desk__field-line">
                              <span className="mn-desk__field-key">
                                {idle === undefined ? '还没有开始读' : '未读天数'}
                              </span>
                              {idle === undefined ? null : (
                                <span className="mn-desk__field-value">{idle} 天</span>
                              )}
                            </span>
                          </Field>
                          <Field label="章节情况">
                            <span className="mn-desk__field-line">
                              <span className="mn-desk__field-value">
                                共 {summary.total} 章 · 平均 {summary.avg} 字/章
                              </span>
                            </span>
                            {summary.longest > 0 ? (
                              <span className="mn-desk__field-line">
                                <span className="mn-desk__field-value">
                                  最长 {summary.longest} 字 · 最短 {summary.shortest} 字
                                </span>
                              </span>
                            ) : null}
                          </Field>
                          <Field label="文件信息">
                            <button
                              type="button"
                              className="mn-desk__link"
                              aria-expanded={fileOpen}
                              title="看磁盘上那个原始文件（改了要在书面板里重新解析）"
                              onClick={() => setFileOpen((open) => !open)}
                            >
                              {fileOpen ? '收起原始文件信息' : '查看原始文件信息'}
                            </button>
                            {fileOpen ? (
                              <span className="mn-desk__field-line">
                                <span className="mn-desk__field-value" title={book.fileName}>
                                  {book.fileName}
                                </span>
                                <span className="mn-desk__field-rule" aria-hidden />
                                <span className="mn-desk__field-value">
                                  {formatBytes(book.fileSize)}
                                </span>
                              </span>
                            ) : null}
                          </Field>
                          <Field label="标签">
                            <span className="mn-desk__tags">
                              {book.groups.length > 0 ? (
                                book.groups.map((group) => (
                                  <span key={group.chapterIndex} className="mn-desk__tagline">
                                    {group.label}
                                  </span>
                                ))
                              ) : (
                                <span className="mn-desk__field-key">没有卷 / 部</span>
                              )}
                              <button
                                type="button"
                                className="mn-desk__link mn-desk__link--muted"
                                title="标签来自书里的卷 / 部，改不了"
                                disabled
                              >
                                添加 ＋
                              </button>
                            </span>
                          </Field>
                          <Field label="备注">
                            <button
                              type="button"
                              className="mn-desk__field-icon"
                              title="备注（这个阅读器不做标注）"
                              aria-label="备注"
                              disabled
                            >
                              <IconEditPencil className="h-4 w-4" />
                            </button>
                          </Field>
                        </div>
                      ) : null}
                    </section>

                    <section className="mn-desk__card">
                      <div className="mn-desk__card-head">
                        <span className="mn-desk__card-title">订单追踪</span>
                        <span className="flex-1" />
                        <button
                          type="button"
                          className="mn-desk__link"
                          title="整本书的目录"
                          onClick={() => setTab('orders')}
                        >
                          查看全部订单
                        </button>
                        <button
                          type="button"
                          className="mn-desk__fold"
                          aria-expanded={ordersOpen}
                          title={ordersOpen ? '收起' : '展开'}
                          onClick={() => setOrdersOpen((open) => !open)}
                        >
                          {ordersOpen ? '收起' : '展开'}
                          <IconChevron className={cx('mn-desk__fold-icon', ordersOpen && 'is-up')} />
                        </button>
                      </div>
                      <OrderStatus
                        state={currentRow?.state ?? 'reading'}
                        index={props.chapterIndex}
                        label={chapterLabel}
                        when={book.lastReadAt ? wordDateText(book.lastReadAt) : '还没读过'}
                      />
                      {ordersOpen ? (
                        <div className="mn-desk__orders">
                          {recentRows.map((row) => (
                            <OrderRow
                              key={row.index}
                              index={row.index}
                              label={row.label}
                              chars={row.chars}
                              state={row.state}
                              current={row.index === props.chapterIndex}
                              pay={deskChapterPayText(row)}
                              onClick={() => props.onChapter(row.index)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </>
                ) : null}

                {tab === 'orders' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">客户订单</span>
                      <span className="flex-1" />
                      <span className="mn-desk__card-note">
                        {summary.done}/{summary.total} 章读完
                      </span>
                    </div>
                    <OrderStatus
                      state={currentRow?.state ?? 'reading'}
                      index={props.chapterIndex}
                      label={chapterLabel}
                      when={book.lastReadAt ? wordDateText(book.lastReadAt) : '还没读过'}
                    />
                    <div className="mn-desk__orders">
                      {chapterRows.map((row) => (
                        <OrderRow
                          key={row.index}
                          index={row.index}
                          label={row.label}
                          chars={row.chars}
                          state={row.state}
                          current={row.index === props.chapterIndex}
                          pay={deskChapterPayText(row)}
                          onClick={() => props.onChapter(row.index)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {tab === 'goods' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">店铺商品</span>
                      <span className="flex-1" />
                      <span className="mn-desk__card-note">{all.length} 个会话</span>
                    </div>
                    <div className="mn-desk__orders">
                      {all.map((item) => (
                        <BookRow
                          key={item.id}
                          book={item}
                          current={item.id === book.id}
                          onClick={() => props.onOpenBook?.(item)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {tab === 'quote' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">物流报价</span>
                    </div>
                    <p className="mn-desk__panel-empty">
                      这个外壳里没有物流报价（本地的书没有运费可报）
                    </p>
                  </section>
                ) : null}
              </div>

              <div className="mn-desk__panel-foot">
                <span className="mn-desk__panel-foot-text" title={deskViewTitle(view, filter)}>
                  {deskViewTitle(view, filter)}
                </span>
                <AppMenu
                  items={[
                    { label: '阅读设置', hint: settingsHotkey, onSelect: props.onOpenSettings },
                    {
                      label: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）',
                      hint: dimHotkey,
                      onSelect: props.onToggleDim,
                    },
                    { label: '全屏', hint: fullscreenHotkey, onSelect: toggleFullscreen },
                    { label: '回到工作台首页', separatorBefore: true, onSelect: props.onBack },
                  ]}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * 功能栏那八格的记号。1688 那一列是白线图标（选中那格垫一块浅蓝方块），
 * 图标盒子给 22px 而不是 18px：我们这批记号画在 24 格里、墨迹只占 60% 上下，
 * 按 18 画出来会比截图里的小一圈（见 AGENTS.md 那条换算）。
 */
const RAIL_ICONS: Record<string, ReactNode> = {
  reception: <IconDeskReception className="h-[22px] w-[22px]" />,
  customer: <IconDeskCustomer className="h-[22px] w-[22px]" />,
  service: <IconDeskService className="h-[22px] w-[22px]" />,
  notice: <IconDeskNotice className="h-[22px] w-[22px]" />,
  leads: <IconDeskOpportunity className="h-[22px] w-[22px]" />,
  workbench: <IconDeskGrid className="h-[22px] w-[22px]" />,
  apps: <IconDeskApps className="h-[22px] w-[22px]" />,
  settings: <IconDeskNut className="h-[22px] w-[22px]" />,
}

/** 读到哪一档 → 会话行上那个方括号里的字（和「筛选」用同一个判断） */
const STATE_TEXT: Record<'reading' | 'todo' | 'done', string> = {
  reading: '在读',
  todo: '未读',
  done: '已读完',
}

/** 会话/头像上的色相。1688 的默认头像是橙色系，所以色域取 8-42 */
function sessionHue(book: BookRecord): number {
  return avatarHue(book.author || book.title, 8, 34)
}

/** 会话头部「[ ]」里那个字 */
function sessionTagOf(book: BookRecord): string {
  if (readStateOf(book) === 'done') return '已读完'
  if (readStateOf(book) === 'reading') return '在读'
  return '未读'
}

/** 会话列表里的一行（头像 + 名字 + 时间 +「[未读]」+ 摘要） */
function SessionRow({
  book,
  currentBookId,
  chapterIndex,
  onClick,
}: {
  book: BookRecord
  currentBookId: string
  chapterIndex: number
  onClick: () => void
}) {
  const unread = sessionUnread(book)
  const current = book.id === currentBookId
  const preview =
    book.state !== 'ready'
      ? book.state === 'importing'
        ? '正在导入…'
        : '没能解析成功'
      : current
        ? `第 ${chapterIndex + 1} 章 · 共 ${book.chapterCount} 章`
        : `共 ${book.chapterCount} 章 · ${formatChars(book.totalChars)}`
  return (
    <button
      type="button"
      className={cx('mn-desk__session', current && 'is-current')}
      title={book.title}
      aria-current={current}
      onClick={onClick}
    >
      {/* 头像上不挂角标：截图里那一列只有名字、时间和「[未读]」标签，
          没读完的章数在功能栏那颗角标上（角标数的是同一个值） */}
      <span
        className="mn-desk__avatar"
        style={{ ['--mn-dhue' as string]: String(sessionHue(book)) }}
        aria-hidden
      >
        {avatarInitial(book.author || book.title)}
      </span>
      <span className="mn-desk__session-body">
        <span className="mn-desk__session-top">
          <span className="mn-desk__session-name">{book.title}</span>
          <span className="mn-desk__session-time">
            {deskListTime(book.lastReadAt || book.addedAt)}
          </span>
        </span>
        <span className="mn-desk__session-preview">
          <span className={cx('mn-desk__session-tag', unread > 0 && 'is-unread')}>
            [{unread > 0 ? '未读' : '已读'}]
          </span>
          {preview}
        </span>
      </span>
    </button>
  )
}

/** 档案里的一行：左边 46px 的标签列 + 右边的值（照截图量的） */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mn-desk__field">
      <span className="mn-desk__field-label">{label}</span>
      <span className="mn-desk__field-body">{children}</span>
    </div>
  )
}

/** 订单追踪那一行状态：状态字 + 当前第几章 + 日期（都是真值） */
function OrderStatus({
  state,
  index,
  label,
  when,
}: {
  state: 'read' | 'reading' | 'unread'
  index: number
  label: string
  when: string
}) {
  return (
    <div className="mn-desk__order-status">
      <span className="mn-desk__state">{deskChapterStateText(state)}</span>
      <span className="mn-desk__order-index" title={label}>
        当前 第 {index + 1} 章
      </span>
      <span className="flex-1" />
      <span className="mn-desk__order-when">{when}</span>
    </div>
  )
}

/** 一行章：左边章号块、中间章名与「第 N 章 · 字数」、右边读到哪了 */
function OrderRow({
  index,
  label,
  chars,
  state,
  current,
  pay,
  onClick,
}: {
  index: number
  label: string
  chars?: number
  state: 'read' | 'reading' | 'unread'
  current: boolean
  pay: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cx('mn-desk__order', current && 'is-current')}
      title={`跳到「${label}」`}
      aria-current={current}
      onClick={onClick}
    >
      <span className="mn-desk__order-thumb" data-state={state}>
        {index + 1}
      </span>
      <span className="mn-desk__order-body">
        <span className="mn-desk__order-name">{label}</span>
        <span className="mn-desk__order-sub">
          第 {index + 1} 章{typeof chars === 'number' && chars > 0 ? ` · ${chars} 字` : ''}
        </span>
      </span>
      <span className={cx('mn-desk__order-pay', state === 'reading' && 'is-current')}>{pay}</span>
    </button>
  )
}

/** 一行书（「店铺商品」那一栏）：左边首字方块、中间书名与章数、右边读到哪了 */
function BookRow({
  book,
  current,
  onClick,
}: {
  book: BookRecord
  current: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cx('mn-desk__order', current && 'is-current')}
      title={`打开《${book.title}》`}
      onClick={onClick}
    >
      <span
        className="mn-desk__order-thumb mn-desk__order-thumb--name"
        style={{ ['--mn-dhue' as string]: String(sessionHue(book)) }}
        aria-hidden
      >
        {avatarInitial(book.author || book.title)}
      </span>
      <span className="mn-desk__order-body">
        <span className="mn-desk__order-name">{book.title}</span>
        <span className="mn-desk__order-sub">
          {book.state === 'ready'
            ? `共 ${book.chapterCount} 章 · ${formatChars(book.totalChars)}`
            : book.state === 'importing'
              ? '正在导入…'
              : '没能解析成功'}
        </span>
      </span>
      <span className="mn-desk__order-pay">{deskPercentText(book)}</span>
    </button>
  )
}

/**
 * 客服工作台的首页（这一套的书架）。
 *
 * 和阅读器共用那一副窗口，只是**中间还没有选中会话**：一句状态 + 最近几个会话 +
 * 真的导入入口。不自动打开某本书——理由和别的外壳一样（见决定记录 21 / 27）：
 * 切到这套主题的那一刻不该直接是某本小说的正文。
 */
export function DeskHome({
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
  const [view, setView] = useState<DeskView>('reception')
  const [filter, setFilter] = useState<DeskFilter>('now')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<DeskPanelTab>('detail')
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1300)
  const [listOpen, setListOpen] = useState(false)

  const all = books ?? []
  const groups = useMemo(() => deskRows(all, view, { filter, query }), [all, view, filter, query])
  const shown = groups.reduce((sum, group) => sum + group.books.length, 0)
  const stats = useMemo(() => deskStats(all, undefined), [all])
  const unreadTotal = deskUnreadTotal(all)
  const recent = useMemo(
    () => [...all].sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt)).slice(0, 6),
    [all],
  )

  return (
    <div
      className={cx('mn-desk', 'mn-desk--home', dropping && 'mn-drop-active')}
      style={{ ['--mn-dim' as string]: String(dim) }}
      data-list={listOpen ? 'open' : 'closed'}
    >
      <nav className="mn-desk__rail" aria-label="工作台">
        {DESK_RAIL.filter((item) => !item.bottom).map((item) => (
          <button
            key={item.id}
            type="button"
            className="mn-desk__rail-btn"
            title={item.label}
            aria-label={item.label}
            aria-pressed={item.view ? view === item.view : undefined}
            onClick={() => {
              if (item.view) {
                setView(item.view)
                setListOpen(false)
              }
            }}
          >
            <span className="mn-desk__rail-icon">
              {RAIL_ICONS[item.id]}
              {item.id === 'notice' && unreadTotal > 0 ? (
                <span className="mn-desk__rail-badge" title={`还有 ${unreadTotal} 章没读完`}>
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              ) : null}
            </span>
            <span className="mn-desk__rail-label">{item.label}</span>
          </button>
        ))}
        <span className="mn-desk__rail-gap" />
        {DESK_RAIL.filter((item) => item.bottom).map((item) => (
          <button
            key={item.id}
            type="button"
            className="mn-desk__rail-btn mn-desk__rail-btn--bare"
            title={item.why ?? item.label}
            aria-label={item.label}
            disabled={item.id === 'apps' || item.id === 'workbench'}
            onClick={item.id === 'settings' ? onOpenSettings : undefined}
          >
            {RAIL_ICONS[item.id]}
          </button>
        ))}
      </nav>

      <div className="mn-desk__work">
        <header className="mn-desk__top">
          <div className="mn-desk__ident">
            <span className="mn-desk__mark" aria-hidden>
              1688
            </span>
            <span className="mn-desk__status">
              <IconDeskOnline className="mn-desk__dot" />
              <span>在线</span>
              <span className="mn-desk__status-sub">共 {all.length} 个会话</span>
            </span>
          </div>
          <div className="mn-desk__stats">
            {stats.map((stat) => (
              <span key={stat.label} className="mn-desk__stat" title={stat.title}>
                <span className="mn-desk__stat-value">{stat.value}</span>
                <span className="mn-desk__stat-label">{stat.label}</span>
              </span>
            ))}
          </div>
          <div className="mn-desk__topright">
            <div className="mn-desk__winctl">
              <button
                type="button"
                className="mn-desk__wbtn"
                title="新建会话（导入一本本地 txt / epub）"
                aria-label="新建会话"
                onClick={onImport}
              >
                <IconNewDoc className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="标记（这个外壳里没有标记）"
                aria-label="标记"
                disabled
              >
                <IconDeskFlag className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="阅读设置（皮肤与主题在里面）"
                aria-label="阅读设置"
                onClick={onOpenSettings}
              >
                <IconDeskSkin className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="最小化（浏览器里没有最小化）"
                aria-label="最小化"
                disabled
              >
                <IconDeskDash className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="最大化（把窗口全屏）"
                aria-label="最大化"
                onClick={toggleFullscreen}
              >
                <IconFullscreen className="mn-desk__wicon" />
              </button>
              <button
                type="button"
                className="mn-desk__wbtn"
                title="关闭（已经在工作台首页上了）"
                aria-label="关闭"
                disabled
              >
                <IconClose className="mn-desk__wicon" />
              </button>
            </div>
            {panelOpen ? (
              <div className="mn-desk__paneltabs" role="tablist">
                {DESK_PANEL_TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === tab}
                    className={cx('mn-desk__paneltab', item.id === tab && 'is-active')}
                    title={item.why ?? item.label}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="mn-desk__panelrefresh"
                  title="清空搜索"
                  onClick={() => setQuery('')}
                >
                  <IconDeskRefresh className="mn-desk__wicon" />
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mn-desk__body">
          <aside className="mn-desk__list" aria-label={deskViewTitle(view, filter)}>
            <div className="mn-desk__search">
              <label className="mn-desk__search-box">
                <IconSearch className="mn-desk__search-icon" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="联系人、聊天记录"
                  aria-label="搜索联系人、聊天记录"
                />
                {query ? (
                  <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
            </div>
            <div className="mn-desk__filters" role="tablist" aria-label="筛选">
              {DESK_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === filter}
                  className={cx('mn-desk__filter', item.id === filter && 'is-active')}
                  title={item.title}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mn-desk__list-body">
              {books === undefined ? (
                <p className="mn-office__side-hint">正在打开书架…</p>
              ) : all.length === 0 ? (
                <p className="mn-office__side-hint">还没有会话</p>
              ) : shown === 0 ? (
                <p className="mn-office__side-hint">
                  {query.trim() ? `没有匹配「${query}」的会话` : deskEmptyText(view)}
                </p>
              ) : (
                groups.map((group, index) =>
                  group.books.length === 0 ? null : (
                    <div key={`${group.label ?? 'default'}-${index}`} className="mn-desk__group">
                      {group.label ? (
                        <div className="mn-desk__group-head">
                          <span className="mn-desk__group-label">{group.label}</span>
                          {group.hint ? (
                            <span className="mn-desk__group-hint">{group.hint}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {group.books.map((item) => (
                        <SessionRow
                          key={item.id}
                          book={item}
                          currentBookId=""
                          chapterIndex={0}
                          onClick={() => {
                            setListOpen(false)
                            onOpen(item)
                          }}
                        />
                      ))}
                    </div>
                  ),
                )
              )}
            </div>
            <div className="mn-desk__list-foot">
              <span className="mn-desk__list-count">{deskViewTitle(view, filter)}</span>
              <span className="mn-desk__list-hint">
                {shown}/{all.length}
              </span>
            </div>
          </aside>

          <main className="mn-desk__main">
            <header className="mn-desk__chathead">
              <button
                type="button"
                className="mn-desk__list-toggle"
                title={listOpen ? '收起会话列表' : '展开会话列表'}
                aria-pressed={listOpen}
                aria-label="会话列表"
                onClick={() => setListOpen((open) => !open)}
              >
                <IconDeskReception className="h-4 w-4" />
              </button>
              <span className="mn-desk__peer-name">工作台</span>
              <span className="mn-desk__peer-tag">[等待接待]</span>
              <span className="flex-1" />
              <div className="mn-desk__head-actions">
                <button
                  type="button"
                  className="mn-desk__icon-btn"
                  title="导入文件"
                  aria-label="导入文件"
                  onClick={onImport}
                >
                  <IconDeskPersonAdd className="mn-desk__head-icon" />
                </button>
                <button
                  type="button"
                  className="mn-desk__icon-btn"
                  title="阅读设置"
                  aria-label="阅读设置"
                  onClick={onOpenSettings}
                >
                  <IconSliders className="mn-desk__head-icon" />
                </button>
                <button
                  type="button"
                  className={cx('mn-desk__icon-btn', panelOpen && 'is-active')}
                  title={panelOpen ? '收起右侧面板' : '展开右侧面板'}
                  aria-pressed={panelOpen}
                  aria-label="右侧面板"
                  onClick={() => setPanelOpen((open) => !open)}
                >
                  <IconMenu className="mn-desk__head-icon" />
                </button>
              </div>
            </header>

            <div className="mn-desk__stage mn-veil">
              <div className="mn-desk__empty">
                <p className="mn-desk__empty-title">选择一个会话</p>
                <p className="mn-desk__empty-hint">
                  {books === undefined
                    ? '正在打开书架…'
                    : all.length === 0
                      ? '还没有会话'
                      : `共 ${all.length} 个会话`}
                </p>
                {recent.length > 0 ? (
                  <div className="mn-desk__empty-recent">
                    {recent.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mn-desk__empty-row"
                        onClick={() => onOpen(item)}
                      >
                        <span className="truncate">{item.title}</span>
                        <span className="mn-desk__empty-meta">
                          {deskListTime(item.lastReadAt || item.addedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mn-desk__empty-actions">
                  <button type="button" className="mn-desk__empty-btn" onClick={onImport}>
                    <IconPlusThin className="h-4 w-4" />
                    导入文件
                  </button>
                </div>
              </div>
            </div>

            <footer className="mn-desk__composer">
              <div className="mn-desk__quick">
                <span className="mn-desk__chip mn-desk__chip--idle">
                  <span className="mn-desk__chip-icon" aria-hidden>
                    <IconDeskQuick className="h-3.5 w-3.5" />
                  </span>
                  等待接待
                </span>
                {recent.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mn-desk__pill"
                    title={`打开《${item.title}》`}
                    onClick={() => onOpen(item)}
                  >
                    {item.title.length > 6 ? `${item.title.slice(0, 6)}…` : item.title}
                  </button>
                ))}
              </div>
              <div className="mn-desk__tools">
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="表情（这个外壳里没有表情）"
                  aria-label="表情"
                  disabled
                >
                  <IconSmile className="mn-desk__tool-icon" />
                </button>
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="导入文件"
                  aria-label="导入文件"
                  onClick={onImport}
                >
                  <IconPicture className="mn-desk__tool-icon" />
                </button>
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="打开读得最近的那一本"
                  aria-label="打开最近读的"
                  disabled={recent.length === 0}
                  onClick={() => recent[0] && onOpen(recent[0])}
                >
                  <IconDeskReception className="mn-desk__tool-icon" />
                </button>
                <span className="flex-1" />
                <button
                  type="button"
                  className="mn-desk__tool"
                  title="阅读设置"
                  aria-label="阅读设置"
                  onClick={onOpenSettings}
                >
                  <IconSliders className="mn-desk__tool-icon" />
                </button>
                <button
                  type="button"
                  className={cx('mn-desk__tool', dimOn && 'is-active')}
                  title={dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗消息区）'}
                  aria-label="摸鱼模式"
                  aria-pressed={dimOn}
                  onClick={onToggleDim}
                >
                  <IconDeskNut className="mn-desk__tool-icon" />
                </button>
              </div>
              <div className="mn-desk__draft mn-desk__draft--idle">
                <div className="mn-desk__draft-line">
                  <span className="mn-desk__draft-label">还没有选中会话</span>
                  <span className="mn-desk__draft-hint">左边那一列点一下就能进去</span>
                </div>
              </div>
            </footer>
          </main>

          {panelOpen ? (
            <aside className="mn-desk__panel" aria-label="工作台">
              <div className="mn-desk__panel-body">
                {tab === 'detail' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">工作台</span>
                    </div>
                    <div className="mn-desk__fields">
                      <Field label="会话">
                        <span className="mn-desk__field-value">共 {all.length} 个</span>
                      </Field>
                      <Field label="在读">
                        <span className="mn-desk__field-value">
                          {all.filter((item) => readStateOf(item) === 'reading').length} 个
                        </span>
                      </Field>
                      <Field label="已读完">
                        <span className="mn-desk__field-value">
                          {all.filter((item) => readStateOf(item) === 'done').length} 个
                        </span>
                      </Field>
                      <Field label="未读完">
                        <span className="mn-desk__field-value">{unreadTotal} 章</span>
                      </Field>
                    </div>
                  </section>
                ) : null}
                {tab === 'goods' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">店铺商品</span>
                      <span className="flex-1" />
                      <span className="mn-desk__card-note">{all.length} 个会话</span>
                    </div>
                    <div className="mn-desk__orders">
                      {all.map((item) => (
                        <div key={item.id} className="mn-desk__order-row">
                          <BookRow book={item} current={false} onClick={() => onOpen(item)} />
                          <button
                            type="button"
                            className="mn-desk__order-act"
                            title="解析设置与删除"
                            aria-label={`${item.title} 的解析设置与删除`}
                            onClick={() => onMenu(item)}
                          >
                            ⋯
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {tab === 'orders' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">客户订单</span>
                    </div>
                    <p className="mn-desk__panel-empty">
                      先选一个会话（左边那一列点一下），它下面才有章节可列
                    </p>
                  </section>
                ) : null}
                {tab === 'quote' ? (
                  <section className="mn-desk__card">
                    <div className="mn-desk__card-head">
                      <span className="mn-desk__card-title">物流报价</span>
                    </div>
                    <p className="mn-desk__panel-empty">
                      这个外壳里没有物流报价（本地的书没有运费可报）
                    </p>
                  </section>
                ) : null}
              </div>
              <div className="mn-desk__panel-foot">
                <span className="mn-desk__panel-foot-text">{deskViewTitle(view, filter)}</span>
                <button
                  type="button"
                  className="mn-desk__panel-foot-btn"
                  title="阅读设置"
                  onClick={onOpenSettings}
                >
                  <IconSliders className="h-4 w-4" />
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
