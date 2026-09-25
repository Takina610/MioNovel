import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx";
import { IconCheck, IconChevron, IconSliders } from "../components/ui/icons";
import {
  IconComment,
  IconDarkMode,
  IconFullscreen,
  IconLauncher,
  IconShare,
} from "../components/ui/app-icons";

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
 *
 * 标题栏与功能区里那几个「Word 有、Excel / PPT 没有」的位置（产品记号、搜索框、
 * 页签行右端那三个按钮）都是**可选插槽**：不传就不画，所以三件套仍然是同一个框。
 */

export interface RibbonButton {
  id: string;
  /** 图标；给字符串就画成文字按钮（B / I / U / Σ 这些在真 Office 里本来就是字） */
  icon?: ReactNode;
  /** 按钮下方的说明（Office 只给少数命令配文字） */
  label?: string;
  title: string;
  disabled?: boolean;
  /** 当前生效的那个（对齐方式、视图切换这类） */
  active?: boolean;
  onClick?: () => void;
}

/**
 * 功能区里的一格。
 *
 * kind 说的是**这一格长什么样**，不是它干什么：Office 的功能区就是一行行格子，
 * 同一个命令在小格里是「图标 + 右边的字」，在大格里是「图标上、字在下」。
 *
 *   big    粘贴、AI 助手、深色模式这些大按钮（图标 38px，字在下面）
 *   stack  图标在上、字在下，宽度跟着字走（Word 的视图页签那一排都是它：
 *          单独的页面 / 阅读视图 / 标尺 / 导航 / 页眉和页脚……）
 *   small  剪切、复制、格式刷、查找这些（图标 22px，字在右边）
 *   icon   只有图标（B、I、U、对齐、缩进）
 *   text   只有字形（Aa / x₂ / x² 这种在真 Office 里本来就是字）
 *   rule   组分隔线（1px 的一格）
 *   node   整格交给调用方：字体名与字号那两个下拉框、样式库都走它
 *   column 竖着码的一摞小格子（剪贴板那个「剪切 / 复制 / 格式刷」和编辑组）
 *
 * **行与行之间不对齐**，这是故意的：真 Word 的字体组里，第二行那排 B / I / U
 * 并不和第一行的字体框对齐，每一行自己摆。所以这里是「一行一行」而不是一张大网格表。
 */
export interface RibbonItem {
  id: string;
  kind?: "big" | "stack" | "small" | "icon" | "text" | "rule" | "node" | "column";
  icon?: ReactNode;
  /**
   * 格子底下（或右边）那行字。给字符串就是一行；Excel 里「查找录入 VLOOKUP」
   * 「加载项」这种是**两行**的，所以允许给节点（里面自己放 <br />）。
   */
  label?: ReactNode;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  /** 右下角那个小三角：这一格还有下拉。灰着的格子里它只是个记号 */
  menu?: boolean;
  /**
   * 紧一档的格子（Excel 那一套）。Word 的格子是「图标 22 + 右边的字」，
   * Excel 同一条命令只有 16-18px 的图标、旁边一个小三角，两组格子还得并排
   * 塞进同一行——所以这只是**同一个形状的密度**，不是另一种形状。
   * 具体松紧写在 styles/excel.css 的 .mn-rb--dense 里。
   */
  dense?: boolean;
  /** kind: 'node' 时整格的内容 */
  node?: ReactNode;
  /** kind: 'column' 时竖着码的那几格 */
  items?: RibbonItem[];
  onClick?: () => void;
}

export interface RibbonGroup {
  label: string;
  /** 老的一行式按钮（Excel / PPT）：按顺序排 */
  buttons?: RibbonButton[];
  /** 新的：一行一格（Word）。每一行自己摆，行与行之间不对齐 */
  rows?: RibbonItem[][];
  /** 组右下角的对话框启动器（真 Office 里点开是这个组的对话框） */
  launcher?: boolean;
}

export interface RibbonTab {
  id: string;
  label: string;
  groups?: RibbonGroup[];
  /** 这个外壳里没有实现的页签：灰着，鼠标放上去说清楚为什么 */
  disabled?: boolean;
}

/** 老式的一行按钮（Excel / PPT 还在用） */
function RibbonCell({ button }: { button: RibbonButton }) {
  const text = typeof button.icon === "string";
  return (
    <button
      type="button"
      className={cx(
        "mn-ribbon__btn",
        text && "mn-ribbon__btn--text",
        button.active && "is-active",
      )}
      title={button.title}
      aria-label={button.title}
      aria-pressed={button.active}
      disabled={button.disabled}
      onClick={button.onClick}
    >
      {text ? (
        <span className="mn-ribbon__glyph">{button.icon}</span>
      ) : (
        button.icon
      )}
      {button.label ? (
        <span className="mn-ribbon__btn-label">{button.label}</span>
      ) : null}
    </button>
  );
}

/** 功能区里的一格 */
function RibbonItemCell({ item }: { item: RibbonItem }) {
  const kind = item.kind ?? "icon";
  if (kind === "rule")
    return <span className="mn-rb mn-rb--rule" aria-hidden />;
  if (kind === "column") {
    return (
      <div className="mn-rb--column">
        {(item.items ?? []).map((child) => (
          <RibbonItemCell key={child.id} item={child} />
        ))}
      </div>
    );
  }
  if (kind === "node")
    return <div className="mn-rb mn-rb--node">{item.node}</div>;
  const body =
    kind === "text" ? (
      <span className="mn-rb__glyph">{item.icon}</span>
    ) : (
      <span className={cx("mn-rb__icon", kind === "big" && "mn-rb__icon--big")}>
        {item.icon}
      </span>
    );
  return (
    <button
      type="button"
      className={cx(
        "mn-rb",
        `mn-rb--${kind}`,
        item.dense && "mn-rb--dense",
        item.active && "is-active",
      )}
      title={item.title}
      aria-label={item.title}
      aria-pressed={item.active}
      disabled={item.disabled}
      onClick={item.onClick}
    >
      {body}
      {item.label ? <span className="mn-rb__label">{item.label}</span> : null}
      {item.menu ? (
        <span className="mn-rb__caret" aria-hidden>
          <IconChevron className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}

function RibbonGroupView({ group }: { group: RibbonGroup }) {
  return (
    <div className="mn-ribbon__group">
      <div className="mn-ribbon__group-body">
        {group.rows ? (
          <div className="mn-ribbon__rows">
            {group.rows.map((row, index) => (
              <div className="mn-ribbon__row" key={`${group.label}-${index}`}>
                {row.map((item) => (
                  <RibbonItemCell key={item.id} item={item} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          (group.buttons ?? []).map((button) => (
            <RibbonCell key={button.id} button={button} />
          ))
        )}
      </div>
      <div className="mn-ribbon__group-label">{group.label}</div>
      {group.launcher ? (
        <span
          className="mn-ribbon__launcher"
          title={`${group.label}（这个外壳里没有对话框）`}
        >
          <IconLauncher className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </div>
  );
}

export interface OfficeFrameProps {
  /** 标题栏上的文件名（书名.docx 这类） */
  fileName: string;
  /** 「已保存到这台设备」那一行小字；Word 的标题栏里就是这个位置 */
  savedHint?: string;
  /** 标题栏右侧的头像字（真数据：作者的首字） */
  avatar: string;
  /** 标题栏最左边那一格：产品记号（Word 那个蓝方块）。不传就不画 */
  brand?: ReactNode;
  /** 文件名左边那一串（自动保存、保存、撤销、重做、快速访问工具栏） */
  titleTools?: ReactNode;
  /** 标题栏中间那一格（Word 的搜索框）。给了它就居中放 */
  titleCenter?: ReactNode;
  /** 标题栏右侧、头像左边那一格（升级计划那类） */
  titleAlert?: ReactNode;
  /**
   * 标题栏上的装饰画（Excel 开始屏幕右上角那片淡灰的商标水印）。
   * 只画不接事件：`aria-hidden` + `pointer-events: none`，压在最右边、被标题栏裁掉。
   */
  titleArt?: ReactNode;
  /** 页签行右端那三个（批注 / 编辑 / 共享） */
  tabActions?: ReactNode;
  tabs: RibbonTab[];
  activeTab: string;
  onTab: (id: string) => void;
  /** 「文件」页签 = 回开始屏幕。开始屏幕上没有页签，所以可以不传 */
  onBack?: () => void;
  /** 功能区之上、正文之下的一条：Word 的标尺、Excel 的编辑栏 */
  band?: ReactNode;
  /** 功能区之下、状态栏之上的一条：Excel 的工作表标签、PPT 的备注栏 */
  footBand?: ReactNode;
  /** 左边的窗格：Word 的导航窗格、PPT 的幻灯片栏 */
  side?: ReactNode;
  sideOpen?: boolean;
  /** 正文区。外面已经包好滚动容器（ReaderView） */
  children: ReactNode;
  statusLeft: ReactNode;
  statusRight: ReactNode;
  /** 状态栏右侧、缩放条前面那一串（Word 的专注 / 阅读视图 / 页面视图） */
  statusTools?: ReactNode;
  /**
   * 不画状态栏。Word 的开始屏幕（开始屏幕 = 一个没有打开文档的窗口）本来就没有状态栏，
   * 那一条上是「就绪」和缩放——两个在那一屏都没有意义的东西
   */
  hideStatus?: boolean;
  /** 缩放滑条：改的是正文字号，显示成百分比（见各 App 里的说明） */
  zoom: number;
  zoomRange: readonly [number, number];
  onZoom: (value: number) => void;
  onOpenSettings: () => void;
  /** 摸鱼模式 */
  dim: number;
  dimOn: boolean;
  onToggleDim: () => void;
  /**
   * 阅读视图（只有 Word 用）：把标题栏、功能区、状态栏一起收起来，只留正文。
   * 这是真 Word 里就有的功能，也是「窗口里只剩一张纸」那一下。
   */
  immersive?: boolean;
  /**
   * 这套外壳此刻占着 Esc（Word 的沉浸模式、PPT 的阅读视图）：根元素挂上
   * data-mn-esc-local，「退出阅读」那条命令看到它就让位，否则按一下 Esc
   * 既退出沉浸/阅读视图、又被踢回书架。
   */
  escLocal?: boolean;
}

export function OfficeFrame({
  fileName,
  savedHint,
  avatar,
  brand,
  titleTools,
  titleCenter,
  titleAlert,
  titleArt,
  tabActions,
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
  statusTools,
  hideStatus,
  zoom,
  zoomRange,
  onZoom,
  onOpenSettings,
  dim,
  dimOn,
  onToggleDim,
  immersive,
  escLocal,
}: OfficeFrameProps) {
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  // 功能区能整个收起来（真 Office 里功能区右下角那个小三角就是这个）。
  // 收起来只收起面板，页签那一行留着——不然连「文件」都点不到了。
  const [ribbonOpen, setRibbonOpen] = useState(true);
  // 没有页签 = 这是开始屏幕。真 Office 那两屏是分开的，标题栏也差一档
  // （Excel 的开始屏幕是 58 高，工作簿里是 44），所以这里挂一个类让 CSS 认。
  const start = tabs.length === 0;

  if (immersive) {
    return (
      <div
        className="mn-office mn-office--immersive"
        data-mn-esc-local={escLocal ? "" : undefined}
        style={{ ["--mn-dim" as string]: String(dim) }}
      >
        <main className="mn-office__main">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={cx("mn-office", start && "mn-office--start")}
      data-mn-esc-local={escLocal ? "" : undefined}
      style={{ ["--mn-dim" as string]: String(dim) }}
    >
      <header className="mn-office__title">
        {/* 装饰画放在最前面：它绝对定位压在最右边，DOM 里排在前面才画在底下
            （排在后面会盖住头像和那几个按钮） */}
        {titleArt ? (
          <div className="mn-office__title-art" aria-hidden>
            {titleArt}
          </div>
        ) : null}
        {/* 左侧一串包成一组：中间的搜索框是绝对居中的，这一串长了会钻到它底下，
            组上有个上界（见 office.css 的 --mn-office-search-half），到了就截文件名 */}
        <div className="mn-office__title-left">
          {brand ? <span className="mn-office__brand">{brand}</span> : null}
          {titleTools ? <div className="mn-office__qat">{titleTools}</div> : null}
          <div className="mn-office__file">
            <span className="mn-office__file-name" title={fileName}>
              {fileName}
            </span>
            {savedHint ? (
              <span className="mn-office__saved">{savedHint}</span>
            ) : null}
          </div>
        </div>
        {titleCenter ? (
          <div className="mn-office__title-center">{titleCenter}</div>
        ) : null}
        <div className="mn-office__title-actions">
          {titleAlert}
          <button
            type="button"
            className={cx("mn-office__title-btn", dimOn && "is-active")}
            title={dimOn ? "退出摸鱼模式" : "摸鱼模式（调暗正文区）"}
            aria-pressed={dimOn}
            onClick={onToggleDim}
          >
            {/* 月亮：设置弹窗里「摸鱼模式」那一栏用的也是它，两处一个意思 */}
            <IconDarkMode className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="mn-office__title-btn"
            title="阅读设置"
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
      {!start ? (
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
                className={cx(
                  "mn-ribbon__tab",
                  tab.id === active.id && "is-active",
                )}
                disabled={tab.disabled}
                title={
                  tab.disabled
                    ? "这个外壳里只有「开始」和「视图」两页"
                    : tab.label
                }
                onClick={() => onTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {tabActions ? (
              <div className="mn-ribbon__actions">{tabActions}</div>
            ) : null}
          </div>
          {ribbonOpen ? (
            <div className="mn-ribbon__panel">
              {(active.groups ?? []).map((group, index) => (
                // key 里带序号：Excel 上有两组都叫「OfficePLUS」（左右各一个），
                // 只用组名当 key 会撞车
                <RibbonGroupView key={`${group.label}-${index}`} group={group} />
              ))}
              <button
                type="button"
                className="mn-ribbon__collapse"
                title="收起功能区"
                aria-expanded
                onClick={() => setRibbonOpen(false)}
              >
                <IconChevron className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mn-ribbon__collapse mn-ribbon__collapse--folded"
              title="展开功能区"
              aria-expanded={false}
              onClick={() => setRibbonOpen(true)}
            >
              <IconChevron className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}
        </div>
      ) : null}

      {band}

      <div className="mn-office__body">
        {sideOpen && side ? (
          <aside className="mn-office__side">{side}</aside>
        ) : null}
        <main className="mn-office__main">{children}</main>
      </div>

      {footBand}

      {hideStatus ? null : (
        <footer className="mn-office__status">
          <div className="mn-office__status-left">{statusLeft}</div>
          <div className="flex-1" />
          <div className="mn-office__status-right">
            {statusRight}
            {statusTools}
            <span className="mn-office__zoom">
              <button
                type="button"
                className="mn-office__zoom-step"
                title="缩小"
                disabled={zoom <= zoomRange[0]}
                onClick={() => onZoom(Math.max(zoomRange[0], zoom - 1))}
              >
                −
              </button>
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
              <button
                type="button"
                className="mn-office__zoom-step"
                title="放大"
                disabled={zoom >= zoomRange[1]}
                onClick={() => onZoom(Math.min(zoomRange[1], zoom + 1))}
              >
                ＋
              </button>
              <span className="mn-office__zoom-value">{zoomPct(zoom)}</span>
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}

/** 字号 → 缩放百分比。16px 当 100%，和 Word 里「正文 12 磅」的观感对齐 */
export function zoomPct(fontSize: number): string {
  return `${Math.round((fontSize / 16) * 100)}%`;
}

/**
 * 外壳上的「⋯」菜单。
 *
 * 五套外壳都需要一个地方放「这个应用自己的东西」：阅读设置（主题就在里面）、
 * 摸鱼模式、全屏、回书架。Office 三件套把这些摊在标题栏和视图页签上，
 * 飞书和企业微信的顶栏放不下，就用这个 ⋯ 菜单——真飞书文档右上角也有一个 ⋯。
 */
/** 下拉与触发器之间留的空隙 */
const MENU_OFFSET = 4;
/** 菜单的最小宽度。和 styles/office.css 里 .mn-appmenu 的 min-width 是一个数 */
const MENU_MIN_WIDTH = 224;
/** 估算一行多高：菜单项 6 + 6 内边距 + 一行字。只用来判断往上还是往下弹 */
const MENU_ROW_ESTIMATE = 29;

interface MenuAnchor {
  left: number;
  /** 弹在下面时的 top */
  below: number;
  /** 弹在上面时的 bottom（从窗口底边算起，用起来和 CSS 的 bottom 一致） */
  above: number;
  placement: "below" | "above";
}

export interface AppMenuItem {
  label: string;
  hint?: string;
  separatorBefore?: boolean;
  /** 勾选态（「筛选」「显示设置」这种多选一/多选多的菜单要用） */
  checked?: boolean;
  onSelect: () => void;
}

export function AppMenu({
  items,
  label = "更多",
  trigger,
}: {
  items: AppMenuItem[];
  label?: string;
  /**
   * 触发器长什么样。不传就是那个 ⋯；首页上要给头像一个菜单，
   * 就把它传进来——菜单的行为（点外面关、Esc 关）只有这一份实现。
   */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * 量一次位置。
   *
   * 菜单挂上之后要再量一遍：第一次只能用「最小宽度」估，右侧对齐到触发器右边；
   * 真实宽度量出来之后再对一次，宽菜单才不会被窗口右边切掉。
   */
  const measure = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? MENU_MIN_WIDTH;
    const height =
      menuRef.current?.offsetHeight ?? items.length * MENU_ROW_ESTIMATE + 10;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_OFFSET;
    // 下面放不下、上面更宽敞时才往上弹
    const placement: MenuAnchor["placement"] =
      spaceBelow < height && rect.top > spaceBelow ? "above" : "below";
    const next: MenuAnchor = {
      left: Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      ),
      below: rect.bottom + MENU_OFFSET,
      above: window.innerHeight - rect.top + MENU_OFFSET,
      placement,
    };
    // 同一个位置就原样返回：否则 setAnchor 每次都造新对象，layout effect 会打转
    setAnchor((current) =>
      current &&
      current.left === next.left &&
      current.below === next.below &&
      current.above === next.above &&
      current.placement === next.placement
        ? current
        : next,
    );
  }, [items.length]);

  // layout effect 跑在 DOM 挂载之后、绘制之前：这里是量得到菜单真实宽高的第一拍，
  // 所以上面那个「先估一次」是不必要的——量一次就对，也不会先画错位置再跳
  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure]);

  // 窗口变化、外层滚动（功能区的横向滚动、页面滚动）时跟着走
  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    window.addEventListener("scroll", reposition, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // 菜单在 body 上（portal），所以两个盒子都要看
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      className="mn-appmenu"
      role="menu"
      style={{
        left: anchor?.left ?? 0,
        // 还没量到位置时先藏起来：宁可晚一帧，也别先画在左上角再飞过去
        visibility: anchor ? "visible" : "hidden",
        ...(anchor?.placement === "above"
          ? { bottom: anchor.above }
          : { top: anchor?.below ?? 0 }),
      }}
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.separatorBefore ? <div className="mn-appmenu__rule" /> : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            <span className="mn-appmenu__label">
              {item.checked !== undefined ? (
                <span className="mn-appmenu__check">
                  {item.checked ? "✓" : ""}
                </span>
              ) : null}
              <span>{item.label}</span>
            </span>
            {item.hint ? <kbd>{item.hint}</kbd> : null}
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div ref={wrapRef} className="mn-appmenu-wrap">
      <button
        ref={btnRef}
        type="button"
        className={cx(
          "mn-appmenu-btn",
          trigger ? "mn-appmenu-btn--bare" : null,
          open && "is-open",
        )}
        aria-label={label}
        aria-expanded={open}
        title={label}
        // 菜单开着时 Esc 先归它（data-mn-esc-local），别把「退出阅读」连带触发
        data-mn-esc-local={open ? "" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger ?? "⋯"}
      </button>
      {/*
        菜单挂在 body 上。**必须在 body 上**：功能区的面板（.mn-ribbon__panel）
        与侧栏都是 overflow 容器，绝对定位的下拉会被它们裁掉——2026-09-24 用户
        报的「上方菜单下拉框层级出错」就是这个（字体下拉只剩两行、被压在下排按钮下）。
        位置由 JS 按触发器的位置算（和 components/ui/Select 同一套做法）。
      */}
      {open ? createPortal(menu, document.body) : null}
    </div>
  );
}

/** 名次行（Word 的导航窗格、PPT 的节列表共用）：一行标题 + 可选的字数 */
export function NavRow({
  label,
  hint,
  active,
  onClick,
  className,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      className={cx("mn-navrow", active && "is-active", className)}
      aria-current={active}
      title={label}
      onClick={onClick}
    >
      <span className="mn-navrow__label">{label}</span>
      {hint ? <span className="mn-navrow__hint">{hint}</span> : null}
      {active ? <IconCheck className="mn-navrow__check h-3.5 w-3.5" /> : null}
    </button>
  );
}

/** 状态栏上的一项（Office 的状态栏就是一行小字，不是按钮——能点的另算） */
export function StatusText({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={cx("mn-office__status-text", className)} title={title}>
      {children}
    </span>
  );
}

/** 状态栏上能点的一项：视图切换、上下章这些 */
export function StatusButton({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "mn-office__status-text mn-office__status-btn",
        active && "is-active",
      )}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** 全屏按钮：Office 三套的视图页签里都有，做一份共用的配置 */
export function fullscreenButton(): RibbonButton {
  return {
    id: "fullscreen",
    icon: <IconFullscreen className="h-5 w-5" />,
    title: "全屏",
    onClick: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    },
  };
}

/** 评论：只读文档里 Word 也会灰掉它（我们连评论都没有） */
export const CommentButton: RibbonButton = {
  id: "comment",
  icon: <IconComment className="h-5 w-5" />,
  title: "评论（这个外壳里没有）",
  disabled: true,
};
