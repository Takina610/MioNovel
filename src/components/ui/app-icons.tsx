import { Svg, type IconProps } from './icons'

/**
 * 办公外壳的图标。
 *
 * 和 ui/icons.tsx 那批分开：那一批是这个应用自己的界面（书架、阅读器、设置），
 * 这一批只服务五个办公形态——Word 的功能区、Excel 的编辑栏、PPT 的幻灯片组、
 * 企业微信的功能栏。规格完全一致（24 格、1.75 描边、圆头、currentColor），
 * 所以两批放在一起也看不出来自两个地方。
 *
 * 一条自我约束：**只画真有功能的按钮需要的图标**。功能区里绝大多数按钮是禁用
 * 状态（文档是只读的，真 Office 里那些命令也是灰的），它们的图标只需要「看起来
 * 是那一格的命令」——粘贴、格式刷、字体颜色这些，画简单点就够；
 * 而真正会响的那几个（字号、行距、缩进、对齐、视图切换）画准一点。
 */

/* ---- 剪贴板组 ---- */
/** 粘贴：写字板 + 一张纸 */
export function IconPaste(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h2" />
    </Svg>
  )
}

export function IconScissors(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <path d="M8.1 7.6 19 18M19 6 8.1 16.4" />
    </Svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M15 6.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1.5" />
    </Svg>
  )
}

/** 格式刷：一把刷子 */
export function IconBrush(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 4.5 19 8l-6 6-3.5-3.5z" />
      <path d="M9.5 10.5 6 14v5.5" />
    </Svg>
  )
}

/* ---- 字体组 ---- */

/** 字体颜色：A + 底下一条色带 */
export function IconFontColor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16 12 5l6 11" />
      <path d="M8.6 12.4h6.8" />
      <path d="M4.6 20h14.8" strokeWidth="2.6" />
    </Svg>
  )
}

/** 高亮：荧光笔头 */
export function IconHighlight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 14 14.5 7.5a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L11 17z" />
      <path d="M5 19h14" />
    </Svg>
  )
}

export function IconIndentLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 12h10M4 18h16" />
      <path d="M7.5 9.5 5 12l2.5 2.5" />
    </Svg>
  )
}

export function IconIndentRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 12h10M4 18h16" />
      <path d="M5 9.5 7.5 12 5 14.5" />
    </Svg>
  )
}

/** 行距：几行字 + 右侧双向箭头 */
export function IconLineSpacing(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h9M4 12h9M4 18h9" />
      <path d="M18 6v12M15.6 8.4 18 6l2.4 2.4M15.6 15.6 18 18l2.4-2.4" />
    </Svg>
  )
}

export function IconAlignLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
    </Svg>
  )
}

export function IconAlignCenter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
    </Svg>
  )
}

export function IconAlignRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
    </Svg>
  )
}

export function IconAlignJustify(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </Svg>
  )
}

export function IconBullets(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconNumbering(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 4.6h1.2V8M4 14.6c0-.9 1.6-.9 1.6 0 0 .8-1.6 1-1.6 2.2h1.8" />
    </Svg>
  )
}

/** 查找：放大镜 + 一行字（查找替换在功能区里是灰的） */
export function IconFindReplace(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="4.5" />
      <path d="m14 14 5 5" />
      <path d="M4 4h8" />
    </Svg>
  )
}

/* ---- 表格与单元格（Excel） ---- */

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M4 14.5h16M9.5 5v14M15 5v14" />
    </Svg>
  )
}

/** 合并后居中：中间一块跨两格 */
export function IconMerge(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 12h16" />
      <path d="M12 8.5v7" />
      <path d="M9.6 10.2 12 8.5l2.4 1.7M9.6 13.8 12 15.5l2.4-1.7" />
    </Svg>
  )
}

/** 自动换行：折行的箭头 */
export function IconWrapText(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h11a3 3 0 0 1 0 6h-3" />
      <path d="m14 15.8-2.6 2.2 2.6 2.2" />
      <path d="M4 18h5" />
    </Svg>
  )
}

/** 填充颜色：油漆桶 */
export function IconFill(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 5.5 8a1.4 1.4 0 0 0 0 2l5 5a1.4 1.4 0 0 0 2 0l4-4z" />
      <path d="M19 15c0 1.1-.9 2-2 2s-2-.9-2-2 2-3.5 2-3.5S19 13.9 19 15z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 筛选：漏斗 */
export function IconFunnel(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h16l-6 6.5V19l-4-2v-5.5z" />
    </Svg>
  )
}

/** 排序：小大箭头（带字母的那版在 ui/icons 里） */
export function IconSortAZ(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7h6M5 12h4M5 17h2" />
      <path d="M17 5v14M14 16l3 3 3-3" />
    </Svg>
  )
}

/* ---- 视图与窗口（Word / Excel / PowerPoint 共用） ---- */

export function IconUndo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 9.5h9a5 5 0 0 1 0 10H8" />
      <path d="m8 5.5-3.5 4L8 13.5" />
    </Svg>
  )
}

export function IconRedo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.5 9.5h-9a5 5 0 0 0 0 10H16" />
      <path d="m16 5.5 3.5 4L16 13.5" />
    </Svg>
  )
}

export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5h11l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 5v5h7" />
      <rect x="8" y="13" width="8" height="7" rx="0.6" />
    </Svg>
  )
}

/** 导航窗格：左边一列 + 右边正文 */
export function IconNavPane(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M10 5v14" />
      <path d="M5.4 8.4h2.4M5.4 11.4h2.4" />
    </Svg>
  )
}

/** 阅读视图：一本翻开的书 */
export function IconReadView(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 7.5S10 5.8 6.5 5.8c-1.2 0-2 .4-2 .4v11.2s.8-.4 2-.4c3.5 0 5.5 1.7 5.5 1.7s2-1.7 5.5-1.7c1.2 0 2 .4 2 .4V6.2s-.8-.4-2-.4C14 5.8 12 7.5 12 7.5z" />
      <path d="M12 7.5v10.8" />
    </Svg>
  )
}

/** 页面视图：一张竖版纸 */
export function IconPageView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.5" y="4" width="11" height="16" rx="1.2" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </Svg>
  )
}

/** 幻灯片浏览：两格缩略图 */
export function IconSlideSorter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="7" height="6" rx="1" />
      <rect x="13" y="5" width="7" height="6" rx="1" />
      <rect x="4" y="13" width="7" height="6" rx="1" />
      <rect x="13" y="13" width="7" height="6" rx="1" />
    </Svg>
  )
}

/** 幻灯片放映 */
export function IconSlideshow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="11.5" rx="1.4" />
      <path d="M12 16.5V20M8.5 20h7" />
      <path d="M10.5 8.6v4l3.6-2z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 版式：一张幻灯片分成标题 + 内容 */
export function IconLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.4" />
      <path d="M6.5 9h7" />
      <path d="M6.5 12.5h11M6.5 15.5h11" />
    </Svg>
  )
}

/** 节：两道横条（PPT 的节标签） */
export function IconSection(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="3.2" rx="1" fill="currentColor" stroke="none" />
      <rect x="4" y="12" width="16" height="3.2" rx="1" opacity="0.45" fill="currentColor" stroke="none" />
      <path d="M6.5 19h11" opacity="0.45" />
    </Svg>
  )
}

/** 备注：几行小字 */
export function IconNotes(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M7 9.5h10M7 12.5h10M7 15.5h6" />
    </Svg>
  )
}

/* ---- 分享、评论、链接 ---- */

export function IconShare(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="17.5" cy="6" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path d="m8.9 10.7 6.3-3.4M8.9 13.3l6.3 3.4" />
    </Svg>
  )
}

export function IconComment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H12l-5 3.5v-3.5H6a1.5 1.5 0 0 1-1.5-1.5z" />
    </Svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 13.8a3.2 3.2 0 0 1 0-4.5l2.4-2.4a3.2 3.2 0 0 1 4.5 4.5l-1.1 1.1" />
      <path d="M14 10.2a3.2 3.2 0 0 1 0 4.5l-2.4 2.4a3.2 3.2 0 0 1-4.5-4.5l1.1-1.1" />
    </Svg>
  )
}

export function IconPicture(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4.5 17 4.5-4.5 3 3 3.5-3 4 4" />
    </Svg>
  )
}

export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.4" />
      <path d="M3.5 9.7h17M3.5 14.3h17M9.2 5v14M14.8 5v14" />
    </Svg>
  )
}

export function IconCheckbox(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.4" />
      <path d="m6.4 8 1.4 1.4 2.6-2.8" />
      <path d="M14 7h5.5M14 17h5.5M4.5 14.5h7v7h-7z" />
    </Svg>
  )
}

export function IconDivider(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="M6.5 7h11M6.5 17h11" opacity="0.45" />
    </Svg>
  )
}

export function IconThumbUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 10.5 11.5 5c1.2 0 2 .9 2 2v3.5h4.2a1.6 1.6 0 0 1 1.6 1.9l-1 5a1.6 1.6 0 0 1-1.6 1.3H9z" />
      <path d="M9 10.5H5.6a1 1 0 0 0-1 1V17a1 1 0 0 0 1 1H9z" />
    </Svg>
  )
}

export function IconOutline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h7M4 12h5M4 18h7" />
      <path d="M13 6h7M13 12h7M13 18h7" opacity="0.5" />
      <path d="M11 4v16" opacity="0.5" />
    </Svg>
  )
}

export function IconGrid2x2(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="7" rx="1.4" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" />
      <rect x="13" y="13" width="7" height="7" rx="1.4" />
    </Svg>
  )
}

export function IconContacts(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19.5c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M16 8.2a2.6 2.6 0 0 1 0 5M18.5 19.5c0-2.2-1-3.9-2.6-4.6" />
    </Svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v3M15.5 3.5v3" />
    </Svg>
  )
}

export function IconCloud(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 18.5a4 4 0 0 1-.4-8A5.2 5.2 0 0 1 17.4 10a3.7 3.7 0 0 1 .6 7.3" />
      <path d="M12 12v6M9.8 15.5 12 17.8l2.2-2.3" />
    </Svg>
  )
}

export function IconChatBubble(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11.5c0 4-3.6 7-8 7-1 0-2-.2-2.9-.5L5 19.5l1-3.2C5 15 4 13.4 4 11.5c0-4 3.6-7 8-7s8 3 8 7z" />
    </Svg>
  )
}

export function IconPhone(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4.5h2.4l1.4 3.4-2 1.6a10 10 0 0 0 5.2 5.2l1.6-2 3.4 1.4V17a2 2 0 0 1-2.2 2A13.5 13.5 0 0 1 4 6.7 2 2 0 0 1 6 4.5z" />
    </Svg>
  )
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="7" width="12" height="10" rx="1.6" />
      <path d="m15.5 11.5 5-2.6v6.2l-5-2.6z" />
    </Svg>
  )
}

export function IconSmile(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 14.2c.8.9 1.8 1.3 3 1.3s2.2-.4 3-1.3" />
      <path d="M9.3 9.6h.01M14.7 9.6h.01" strokeWidth="2.4" />
    </Svg>
  )
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12 20 5l-6 15-2.6-5.4z" />
      <path d="m11.4 14.6 8.6-9.6" />
    </Svg>
  )
}

/** 一份文档（云文档列表、文件夹里的文件） */
export function IconDoc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
      <path d="M13.3 4.6V9h4.5" />
      <path d="M8 12.5h7M8 15.5h5" />
    </Svg>
  )
}

/** 一张幻灯片（缩略图、开始屏幕的「空白演示文稿」） */
export function IconSlide(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="11.5" rx="1.4" />
      <path d="M12 17v2.8M8.5 20h7" />
    </Svg>
  )
}

/** 一张空白工作簿（开始屏幕的「新建」） */
export function IconBookBlank(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 9.5h16M9.5 9.5V20M15 9.5V20" />
    </Svg>
  )
}

/** 全屏（角标） */
export function IconFullscreen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9V5.5a1.5 1.5 0 0 1 1.5-1.5H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </Svg>
  )
}

export function IconRuler(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="8.5" width="18" height="7" rx="1.2" />
      <path d="M7 8.5v2.6M11 8.5v2.6M15 8.5v2.6M19 8.5v2.6" />
    </Svg>
  )
}

export function IconTheme(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.2-2.9h2A4 4 0 0 0 20.5 10 7.6 7.6 0 0 0 12 3.5z" />
      <path d="M8 9h.01M12 7.5h.01M15.5 10h.01" strokeWidth="2.4" />
    </Svg>
  )
}

/* ==========================================================================
   飞书云文档（chrome: 'doc' 的首页）
   --------------------------------------------------------------------------
   这一批是「云文档首页」那一屏上的记号：商标、左侧导航、三张卡片上的
   彩色图标、列表里的文件图标。

   规格和上面那批一样（24 格、1.75 描边、圆头、currentColor），**只有三处例外**，
   都是有意的：

   1. **商标**（IconFeishuMark）写死了三个色号。商标就是商标——飞书自己的
      深色模式里它也还是这三个颜色，跟着主题变色就不像那个产品了。
      和 public/MioNovel.png 同一个道理。
   2. **三张卡片的彩色图标**（新建 / 上传 / 模板库）写死了飞书那套插图色。
      它们不是界面控件，是产品的插图，换成主题色就不是它了。
   3. 实心色块上的白线（列表里的文件图标、徽标里的加号与箭头）写死 #fff：
      那是记号自己的墨色，不是界面的颜色。徽标外圈那道「挖空」例外——
      它露出来的必须是卡片自己的底色，所以取 var(--mn-surface)。
   ========================================================================== */

/**
 * 飞书云文档的商标：青绿的一撇 + 蓝色的一弯 + 深蓝的一刀。
 * 三个色号取自产品页面：主蓝 #3370FF、深蓝 #133C9A、青绿 #00D6B9。
 */
export function IconFeishuMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M10.1 4.7c3.3-.9 6.5-.6 9.4.9-1.3 3.3-3.1 6-5.6 8.2-1.9-2.7-3.2-5.7-3.8-9.1z" fill="#00D6B9" />
      <path d="M2.5 10.4c3.7 2.9 7.8 3.7 12.2 2.4 1.5-.4 2.9-1 4.1-1.7-.6 4.4-3 7.5-7.1 9.1-4.4 1.7-7.6-.9-9.2-9.8z" fill="#3370FF" />
      <path d="M15.7 12.7c2.2-.8 4-2 5.4-3.6.9 2.7.3 5.1-1.9 7.1-1.3-1.3-2.5-2.5-3.5-3.5z" fill="#133C9A" />
    </svg>
  )
}

/** 收起侧边栏：两条横线 + 一个向左的实心三角 */
export function IconSideToggle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 7.4h9.4M4.6 12h5.4" />
      <path d="M11.6 9.4 15.8 12l-4.2 2.6z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 主页：实心的房子，底下留一道门 */
export function IconHomeFilled(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.7 4.2 4.2 9.4c-.5.4-.7.9-.7 1.5V19a1.7 1.7 0 0 0 1.7 1.7h3.6v-4.9a1.4 1.4 0 0 1 1.4-1.4h3.6a1.4 1.4 0 0 1 1.4 1.4v4.9h3.6A1.7 1.7 0 0 0 20.5 19v-8.1c0-.6-.2-1.1-.7-1.5l-6.5-5.2a2.1 2.1 0 0 0-2.6 0z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

/** 云盘：圆角方框里一个播放三角 */
export function IconCloudDrive(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.2 4.4h11.6a2 2 0 0 1 2 2v11.2a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2z" />
      <path d="M10.3 8.6v6.8l5.6-3.4z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 知识库：一页文档，右下角还压着一页 */
export function IconWiki(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.6 4.3H6.6a1.2 1.2 0 0 0-1.2 1.2v13a1.2 1.2 0 0 0 1.2 1.2h10.8a1.2 1.2 0 0 0 1.2-1.2V9.5z" />
      <path d="M12.4 4.4v5h5.8" />
      <path d="M7.8 14.6h4.6v3.4H7.8z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 智能纪要：三行字，中间那行右边缀一颗四角星（「智能」那一笔） */
export function IconMinutes(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 6.6h14.8M4.6 12h5.6M4.6 17.4h14.8" />
      <path d="m15.9 9.1 1 2.1 2.1 1-2.1 1-1 2.1-1-2.1-2.1-1 2.1-1z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 云文档：实心圆角方块 + 两道白线。列表里的文件图标 */
export function IconDocFilled(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="currentColor" stroke="none" />
      <path d="M7.4 9h9.2M7.4 13h5.6" stroke="#fff" strokeWidth="1.9" />
    </Svg>
  )
}

/** 置顶文档/知识问答那一行的小图标：描边的一页纸 + 折角 */
export function IconDocLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.1 3.9H6.5a1.2 1.2 0 0 0-1.2 1.2v13.6a1.2 1.2 0 0 0 1.2 1.2h11a1.2 1.2 0 0 0 1.2-1.2V9.3z" />
      <path d="M12.9 4v5.1h5.6" />
      <path d="M8 13.6h5.2v3.2H8z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 细加号（侧栏那两个小按钮）。比功能区里的加号细一档 */
export function IconPlusThin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.6v12.8M5.6 12h12.8" strokeWidth="1.5" />
    </Svg>
  )
}

/** 两行「圈 + 线」：列表设置那一类的记号，侧栏「我的文档库」右边那个 */
export function IconListDots(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.8" cy="9.2" r="2.1" />
      <path d="M11.6 9.2h7.6" />
      <circle cx="6.8" cy="15" r="2.1" />
      <path d="M11.6 15h7.6" />
    </Svg>
  )
}

/** 侧栏底部那三个：打印 / 工具箱 / 回收站。图标照画，动作在这个外壳里没有 */
export function IconDockPrint(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.4 8.6V5.2a.8.8 0 0 1 .8-.8h5.6a.8.8 0 0 1 .8.8v3.4" />
      <path d="M6.6 8.6h10.8a1.3 1.3 0 0 1 1.3 1.3v5.4a1.3 1.3 0 0 1-1.3 1.3h-1.6" />
      <path d="M7.9 8.6H6.6a1.3 1.3 0 0 0-1.3 1.3v5.4a1.3 1.3 0 0 0 1.3 1.3h6.4" />
      <path d="M7.9 14.4h6.7a1 1 0 0 1 1 1v4.2a1 1 0 0 1-1 1H7.9a1 1 0 0 1-1-1v-4.2a1 1 0 0 1 1-1z" />
      <path d="M9.4 17.4h1M12.4 17.4h1.4" strokeWidth="1.6" />
    </Svg>
  )
}

export function IconDockTools(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 8.6h12a1.6 1.6 0 0 1 1.6 1.6v7.6a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6v-7.6A1.6 1.6 0 0 1 6 8.6z" />
      <path d="M9.4 8.6V7.1a2 2 0 0 1 2-2h1.2a2 2 0 0 1 2 2v1.5" />
      <circle cx="12" cy="13.8" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconDockTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.4 7.6h13.2" />
      <path d="M9.4 7.6V5.9a1.3 1.3 0 0 1 1.3-1.3h2.6a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M7.3 7.6l.7 10.3a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4l.7-10.3" />
      <path d="M10.2 15.1h3.6" strokeWidth="1.6" />
    </Svg>
  )
}

/** 关系图：三个节点连起来（顶栏第一个图标） */
export function IconNodeGraph(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="6.2" r="2.5" />
      <circle cx="6.2" cy="17.3" r="2.5" />
      <circle cx="17.8" cy="17.3" r="2.5" />
      <path d="M10.8 8.4 7.4 15M13.2 8.4l3.4 6.6M8.7 17.3h6.6" />
    </Svg>
  )
}

/** 灯泡：帮助/灵感那一类（顶栏） */
export function IconBulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.3 16.4a6.1 6.1 0 1 1 5.4 0v1.9a1.3 1.3 0 0 1-1.3 1.3h-2.8a1.3 1.3 0 0 1-1.3-1.3z" />
      <path d="M10.3 21.6h3.4" />
    </Svg>
  )
}

/** 九宫格：应用中心（顶栏最后一个） */
export function IconGridDots(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <rect x="3.8" y="3.8" width="4" height="4" rx="1.2" />
        <rect x="10" y="3.8" width="4" height="4" rx="1.2" />
        <rect x="16.2" y="3.8" width="4" height="4" rx="1.2" />
        <rect x="3.8" y="10" width="4" height="4" rx="1.2" />
        <rect x="10" y="10" width="4" height="4" rx="1.2" />
        <rect x="16.2" y="10" width="4" height="4" rx="1.2" />
        <rect x="3.8" y="16.2" width="4" height="4" rx="1.2" />
        <rect x="10" y="16.2" width="4" height="4" rx="1.2" />
        <rect x="16.2" y="16.2" width="4" height="4" rx="1.2" />
      </g>
    </Svg>
  )
}

/**
 * 新建：蓝色的一页纸（右上角折了一下）+ 右下角一个「+」徽标。
 * 徽标外圈那道白环是拿**卡片自己的底色**画的（见文件头第 3 条），
 * 所以深色主题下它也不会露出一圈白。
 */
export function IconNewDoc(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M7.4 3.4h5.2c.5 0 .9.2 1.2.5l4.5 4.6c.3.3.5.7.5 1.2v6.5a2 2 0 0 1-2 2H7.4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="16.6" cy="16.4" r="5.2" fill="none" strokeWidth="2.2" style={{ stroke: 'var(--mn-surface)' }} />
      <circle cx="16.6" cy="16.4" r="4" fill="currentColor" stroke="none" />
      <path d="M16.6 14.5v3.8M14.7 16.4h3.8" stroke="#fff" strokeWidth="1.8" />
    </Svg>
  )
}

/** 上传：橙色的一朵云 + 右下角一个向上的箭头徽标 */
export function IconUploadBlob(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8.6 16.6a4.4 4.4 0 0 1-.7-8.7 5.7 5.7 0 0 1 10.7 1.3 3.6 3.6 0 0 1-.5 7.4z"
        fill="#FF811A"
        stroke="none"
      />
      <circle cx="16.4" cy="16.4" r="5.2" fill="none" strokeWidth="2.2" style={{ stroke: 'var(--mn-surface)' }} />
      <circle cx="16.4" cy="16.4" r="4" fill="#ED6D0C" stroke="none" />
      <path d="M16.4 18.3v-3.9M14.6 16.2l1.8-1.8 1.8 1.8" stroke="#fff" strokeWidth="1.8" />
    </Svg>
  )
}

/** 模板库：三个形状叠在一起（蓝圆、黄块、红三角）——飞书那张插图的样子 */
export function IconTemplates(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.2" cy="13.6" r="4.8" fill="#5B65F5" stroke="none" />
      <path d="M13.4 4.4h6.4l-1.9 7.9h-6.4z" fill="#FCCA03" stroke="none" />
      <path d="m15.4 10.6 5.6 9.4H9.8z" fill="#F54A45" stroke="none" />
    </Svg>
  )
}

/** 文件夹：列表里「位置」那一列 */
export function IconFolderLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.8 7.4a1.6 1.6 0 0 1 1.6-1.6h3.3l1.9 2.3h7.8a1.6 1.6 0 0 1 1.6 1.6v7.5a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6z" />
    </Svg>
  )
}

/** 显示设置：几行字，其中一行挂着一个小方块（列设置就是这个意思） */
export function IconDisplaySettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 6.6h15.2M4.4 12h6.6M4.4 17.4h15.2" />
      <rect x="14.6" y="10.2" width="3.8" height="3.8" rx="1.1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 列表视图：三行「小方块 + 线」 */
export function IconViewList(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <rect x="3.8" y="5.4" width="2.8" height="2.8" rx="0.9" />
        <rect x="3.8" y="10.6" width="2.8" height="2.8" rx="0.9" />
        <rect x="3.8" y="15.8" width="2.8" height="2.8" rx="0.9" />
      </g>
      <path d="M9.2 6.8h11M9.2 12h11M9.2 17.2h11" strokeWidth="1.9" />
    </Svg>
  )
}

/** 排序箭头（表头上那个）。向上是展开的另一档，由调用方转 180° */
export function IconSortDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.4v13.2M7.4 13.8 12 18.4l4.6-4.6" strokeWidth="1.6" />
    </Svg>
  )
}

/* ==========================================================================
   企业微信功能栏那 13 格（第一卷：真有功能的四格在 ChatApp 里另有映射）
   --------------------------------------------------------------------------
   桌面版企业微信最左一列是「图标 + 一行小字」，13 格挨着排。这里画的是其中
   9 格**这个阅读器里没有的**：它们照原样画出来（那一列本来就该有这些东西），
   但按钮是灰的、title 里说清为什么——见 apps/ChatApp.tsx 的 CHAT_RAIL。
   ========================================================================== */

/** 邮件：信封 */
export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="5.6" width="17.2" height="12.8" rx="1.6" />
      <path d="m4.6 7.4 7.4 5.4 7.4-5.4" />
    </Svg>
  )
}

/** 待办：勾选框里一个勾 */
export function IconTodo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.8" y="5.4" width="16.4" height="13.2" rx="2.2" />
      <path d="m8.2 12 2.6 2.6 5-5.4" />
    </Svg>
  )
}

/** 会议：一块屏幕 + 麦克风 */
export function IconMeeting(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="12.2" height="9" rx="1.8" />
      <path d="m15.6 9 5-2.6v6.2l-5-2.6z" />
      <path d="M8.4 17.4h4.4M10.6 13.6v3.8" />
    </Svg>
  )
}

/** 智能文档：一页纸 + 右上角一颗星 */
export function IconSmartDoc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.6 5.4h7.2L17 9.6v9a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1V6.4a1 1 0 0 1 1-1z" />
      <path d="M12.6 5.5v4.2h4.3" />
      <path d="M18.8 3.2l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 智能总结：四角星的闪光 */
export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.4c.5 3.4 1.6 5.4 2.7 6.5 1.1 1.1 3.1 2.2 6.5 2.7-3.4.5-5.4 1.6-6.5 2.7-1.1 1.1-2.2 3.1-2.7 6.5-.5-3.4-1.6-5.4-2.7-6.5-1.1-1.1-3.1-2.2-6.5-2.7 3.4-.5 5.4-1.6 6.5-2.7 1.1-1.1 2.2-3.1 2.7-6.5z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

/** 工作台：四块方块（企业微信的工作台是一块一块的应用） */
export function IconWorkbench(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.4" height="6.4" rx="1.6" />
      <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6" />
      <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6" />
      <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6" />
    </Svg>
  )
}

/** 高级功能：一个「V」形的入口记号 */
export function IconChevronWide(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.8 5.2 12 18.8l8.2-13.6" strokeWidth="2.6" />
    </Svg>
  )
}

/** 分组：一个标签牌 */
export function IconTag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11.2 3.6H19a1.4 1.4 0 0 1 1.4 1.4v7.8L12.6 20a1.4 1.4 0 0 1-2 0L3.9 13.4a1.4 1.4 0 0 1 0-2z" />
      <circle cx="16.2" cy="7.8" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 红包 / 转账（企业微信输入区那一排里的钱袋位置） */
export function IconWallet(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 8.4h16.8v9.8a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M6.6 8.4c0-2.6 2.4-4.6 5.4-4.6s5.4 2 5.4 4.6" />
      <circle cx="15.6" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 联系人卡片（输入区里那个「把人拉进来」的记号） */
export function IconContactCard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="5.2" width="13.2" height="13.6" rx="2" />
      <circle cx="10" cy="10.6" r="2.2" />
      <path d="M6.6 16.2c.6-1.6 1.9-2.5 3.4-2.5s2.8.9 3.4 2.5" />
      <path d="M19.4 8.6v6.8" />
    </Svg>
  )
}

/* ==========================================================================
   Word 形态（chrome: 'page'）
   --------------------------------------------------------------------------
   这一批是 2026-09-24 按截图一比一复刻 Word 外壳时补的：功能区的全部格子、
   标题栏那一串（保存 / 撤销 / 重做 / 升级计划）、状态栏右边那三个视图按钮。

   规格和上面两批完全一致（24 格、1.75 描边、圆头、currentColor），**只有三处例外**
   是有意的，都是产品记号，不是界面控件：

   1. **Word 的商标**（IconWordMark）写死了三个蓝：那是 Word 的标识。
   2. **保存那个紫盘子**（IconSaveFloppy）：Office 自己的保存图标就是紫的，
      跟着主题变色就不像它了。
   3. **四个加载项的图标**（OfficePLUS 的 AI 助手 / 字体 / 模板，论文查重、
      加载项、PDF 转换）：它们是**别的产品的记号**，颜色照截图取。
      其余（查找、替换、选择、边框、底纹……）一律 currentColor。
   ========================================================================== */

/** Word 的商标：一页浅蓝纸 + 左下角深蓝方块里的 W（三个蓝是产品色） */
export function IconWordMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M6.4 2.6h7.2l4.4 4.6v11.4a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 18.6V5a2.4 2.4 0 0 1 2.4-2.4z" fill="#2B7CD3" />
      <path d="M6.4 2.6h7.2l4.4 4.6H8.6a2.2 2.2 0 0 1-2.2-2.2z" fill="#3BD5FF" />
      <rect x="2" y="8.4" width="11.6" height="10" rx="1.6" fill="#07279B" />
      <path d="M4.2 10.8 6 16.2l1.5-3.6 1.5 3.6 1.8-5.4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 保存：一张软盘。紫是 Office 保存图标自己的颜色（产品记号） */
export function IconSaveFloppy(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.2 4.6h10.4l3.2 3.2v11.6a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z" style={{ stroke: '#922E9B' }} />
      <path d="M7.6 4.6h6.2v4.2H7.6z" style={{ stroke: '#922E9B' }} />
      <rect x="7.6" y="12.4" width="7.4" height="8" rx="0.8" style={{ stroke: '#922E9B' }} />
    </Svg>
  )
}

/** 快速访问工具栏右边那个小三角（自定义工具栏）。灰着的记号 */
export function IconQatMore(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5.6h11" strokeWidth="2.6" />
      <path d="m8.4 10.8 3.6 3.6 3.6-3.6" />
    </Svg>
  )
}

/** 对话框启动器：组右下角那个「往角落里拐」的记号 */
export function IconLauncher(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 4v9.4a2.6 2.6 0 0 1-2.6 2.6H8" />
      <path d="M11.6 12.4 8 16l3.6 3.6" />
    </Svg>
  )
}

/** 编辑：一支铅笔（页签行右端那个「编辑」） */
export function IconEditPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.4 4.6l4 4L8.6 19.4l-4.6 1 1-4.6z" />
      <path d="m13.4 6.6 4 4" />
    </Svg>
  )
}

/* ---- 字体组 ---- */

/** 增大字号：A + 右上角向上的箭头 */
export function IconFontGrow(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 19 10 6.4 15.6 19" />
      <path d="M6.6 14.6h6.8" />
      <path d="M18.6 9.6V3.4M16.2 5.8l2.4-2.4 2.4 2.4" />
    </Svg>
  )
}

/** 缩小字号：A + 右上角向下的箭头 */
export function IconFontShrink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 19 10 6.4 15.6 19" />
      <path d="M6.6 14.6h6.8" />
      <path d="M18.6 3.4v6.2M16.2 7.2l2.4 2.4 2.4-2.4" />
    </Svg>
  )
}

/** 清除格式：一个 A + 一块橡皮（Word 里橡皮是粉紫的，这里跟文字同色） */
export function IconClearFormat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 17.4 9.4 6l4.8 11.4" />
      <path d="M6.6 13.2h5.6" />
      <path d="m15.4 12.2 3.6-3.6a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-3.6 3.6z" />
      <path d="m15.4 15.2 3 3" />
    </Svg>
  )
}

/** 查找替换区：查找 = 放大镜 + 一行字（在 app-icons 上方已有），这里是替换 */
export function IconReplace(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.4" width="7.2" height="5.2" rx="1.2" />
      <rect x="13.4" y="14.4" width="7.2" height="5.2" rx="1.2" />
      <path d="M6.8 9.8v3.8a2.6 2.6 0 0 0 2.6 2.6h3.4" />
      <path d="m10.8 14 2.2 2.2-2.2 2.2" />
    </Svg>
  )
}

/** 选择：一个箭头光标 */
export function IconSelectCursor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.6 4.2 18 12.6l-5.2 1 2.8 5.6-2.4 1.1-2.8-5.6-3.8 3.6z" />
    </Svg>
  )
}

/** 字符底纹：一个 A 压在一块底色上 */
export function IconCharShading(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="1.4" fill="currentColor" opacity="0.18" stroke="none" />
      <path d="M7.4 17 12 7.6 16.6 17" />
      <path d="M9.2 13.4h5.6" />
    </Svg>
  )
}

/** 字符边框：一个 A 装在一个框里 */
export function IconCharBorder(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="1.2" />
      <path d="M8.2 16.4 12 8.4l3.8 8" />
      <path d="M9.6 13.6h4.8" />
    </Svg>
  )
}

/** 带圈字符：一个字装在一个圈里 */
export function IconCircledChar(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.6 9.8h6.8M12 9.8v5.4M9.2 15.2h5.6M9.8 12.4h4.4" />
    </Svg>
  )
}

/* ---- 段落组 ---- */

/** 多级列表：三行字，越往下越缩进 */
export function IconMultilevelList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h2.4M8.8 6H20M6.6 12H9M11.8 12H20M4 18h5.2M12.6 18H20" />
    </Svg>
  )
}

/** 显示/隐藏编辑标记：一个段落符 ¶ */
export function IconParagraphMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.6 4.4H10a3.6 3.6 0 0 0 0 7.2h4.6" />
      <path d="M14.6 4.4v15.2M11.4 11.6v8" />
    </Svg>
  )
}

/** 分散对齐：几行字被两个箭头往两边撑开 */
export function IconAlignDistribute(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.6 4.6h14.8M4.6 19.4h14.8" />
      <path d="M6.6 9.4 4.4 12l2.2 2.6M17.4 9.4l2.2 2.6-2.2 2.6" />
      <path d="M8.6 12h6.8" />
    </Svg>
  )
}

/** 边框：一桶漆浇在一条线上（Word 的「边框」就是这个记号） */
export function IconBorders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.2 4.2 6.4 8a1.4 1.4 0 0 0 0 2l4.6 4.6a1.4 1.4 0 0 0 2 0l3.8-3.8z" />
      <path d="M18.4 12.6c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8 1.8-3 1.8-3 1.8 2 1.8 3z" fill="currentColor" stroke="none" />
      <path d="M4.6 18.4h14.8" strokeWidth="2.4" />
    </Svg>
  )
}

/** 底纹：一块方子的四个角 + 里面几点墨（点的密度就是深浅） */
export function IconShading(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.4 8.4V4.4h4M15.6 4.4h4v4M19.6 15.6v4h-4M8.4 19.6h-4v-4" />
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="9" r="0.9" />
        <circle cx="12" cy="9" r="0.9" />
        <circle cx="15" cy="9" r="0.9" />
        <circle cx="9" cy="12" r="0.9" />
        <circle cx="12" cy="12" r="0.9" />
        <circle cx="15" cy="12" r="0.9" />
        <circle cx="9" cy="15" r="0.9" />
        <circle cx="12" cy="15" r="0.9" />
        <circle cx="15" cy="15" r="0.9" />
      </g>
    </Svg>
  )
}

/* ---- OfficePLUS 与三个加载项（产品记号，颜色照截图取） ---- */

/** AI 助手：一只橙色的机器人猫（OfficePLUS 那个记号） */
export function IconAiHelper(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M7.4 8.6 5.6 3.4l4.2 2.4M16.6 8.6l1.8-5.2-4.2 2.4" fill="none" stroke="#F36A2F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5.2c4.6 0 8 3.4 8 8s-3.4 7.6-8 7.6S4 17.3 4 13.2s3.4-8 8-8z" fill="none" stroke="#DD4809" strokeWidth="1.9" />
      <path d="M8.6 12.4h.02M15.4 12.4h.02" stroke="#DD4809" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9.6 16c1.6 1 3.2 1 4.8 0" fill="none" stroke="#DD4809" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.6 10.2c1.4-.8 2.6.2 2.6 1.6 0 1.4-1.2 2-2.4 1.4z" fill="#54A6F7" stroke="none" />
    </svg>
  )
}

/** 字体（OfficePLUS 的字库）：一个橙色的 A 搭一个「字」 */
export function IconFontLibrary(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M3.4 19.4 9.6 4.6l6.2 14.8" fill="none" stroke="#F36A2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.9 14.4h7.4" fill="none" stroke="#F36A2F" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.6 8.6h5.8M18.5 8.6v9.8M16.4 13h4.2" fill="none" stroke="#DD4809" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** 模板（OfficePLUS）：一页折角的纸 + 几行字 */
export function IconTemplateDoc(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M13.6 3.4H7.4a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.4z" fill="none" stroke="#DD4809" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M13.4 3.6v5h5" fill="none" stroke="#DD4809" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M8.6 12.4h6.8M8.6 15.2h6.8M8.6 18h4" fill="none" stroke="#F36A2F" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

/** 论文查重：一页字 + 一个放大镜（论文助手那个记号） */
export function IconDupeCheck(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M14.2 3.4H6.6a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h4" fill="none" stroke="#1978D7" strokeWidth="1.9" />
      <path d="M7.6 7.6h6M7.6 11h3.4" fill="none" stroke="#3D91E5" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="14.6" cy="14.2" r="4.2" fill="none" stroke="#1978D7" strokeWidth="1.9" />
      <path d="m17.8 17.4 2.6 2.6" fill="none" stroke="#1978D7" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}

/** 加载项：四格方块（那个红记号） */
export function IconAddinGrid(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#D83B01" strokeWidth="1.9">
        <rect x="4.2" y="4.2" width="6.6" height="6.6" rx="1" />
        <rect x="13.2" y="4.2" width="6.6" height="6.6" rx="1" />
        <rect x="4.2" y="13.2" width="6.6" height="6.6" rx="1" />
        <rect x="13.2" y="13.2" width="6.6" height="6.6" rx="1" />
      </g>
    </svg>
  )
}

/** PDF 转换：一个 PDF 牌子 + 一叠纸（PDF 工具箱那个记号） */
export function IconPdfConvert(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="2.4" y="6.2" width="12.6" height="11.4" rx="1.4" fill="none" stroke="#1978D7" strokeWidth="1.9" />
      <path d="M5 13.6V10h1.4a1.1 1.1 0 0 1 0 2.2H5M9.6 10h1.1a1.8 1.8 0 0 1 0 3.6H9.6zM13.3 10h2.4M13.3 11.8h1.8" fill="none" stroke="#1978D7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.6 9.4h5a1.4 1.4 0 0 1 1.4 1.4v6.4a1.4 1.4 0 0 1-1.4 1.4h-5a1.4 1.4 0 0 1-1.4-1.4v-6.4a1.4 1.4 0 0 1 1.4-1.4z" fill="none" stroke="#3D91E5" strokeWidth="1.9" />
      <path d="M16.6 14.2h4M16.6 16.6h2.6" fill="none" stroke="#3D91E5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/* ---- 状态栏右边那三格 ---- */

/** 专注：一对方括号框住的一个人 */
export function IconFocus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.4 3.8H5.2a1.4 1.4 0 0 0-1.4 1.4v3.2M15.6 3.8h3.2a1.4 1.4 0 0 1 1.4 1.4v3.2M20.2 15.6v3.2a1.4 1.4 0 0 1-1.4 1.4h-3.2M8.4 20.2H5.2a1.4 1.4 0 0 1-1.4-1.4v-3.2" />
      <circle cx="12" cy="10.4" r="2.2" />
      <path d="M8.2 16.6c.6-1.6 2.1-2.5 3.8-2.5s3.2.9 3.8 2.5" />
    </Svg>
  )
}

/** 页宽 / 缩放：一页纸 + 一个放大镜 */
export function IconPageZoom(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.4" y="4.4" width="12.2" height="15.2" rx="1.4" />
      <circle cx="15.2" cy="15.2" r="3.6" fill="none" />
      <path d="m18 18 2.4 2.4" />
    </Svg>
  )
}

/** 字号框右边那一对上下小三角（Word 的字号框里就是这个） */
export function IconSpin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.4 10.2 2.6-3 2.6 3z" fill="currentColor" stroke="none" />
      <path d="m9.4 13.8 2.6 3 2.6-3z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/* ==========================================================================
   Word 的开始屏幕、视图页签与导航窗格（2026-09-24，决定记录 35）
   --------------------------------------------------------------------------
   规格同上（24 格、1.75 描边、圆头、currentColor）。这一批里有**两张插图**
   （解锁高级模板的封面、书法字帖的样张）：真 Word 里那是两张位图，我们不用位图，
   所以按同一个意思自己画一张**用主题色**的——它们是界面里的插图，不是商标，
   跟着主题走才对（飞书那三张卡片是商标插图，那才写死色号）。
   ========================================================================== */

/** 开始：一间房子（开始屏幕左栏第一格） */
export function IconHomeLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.2 10.4 12 4.2l7.8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.6A1.4 1.4 0 0 1 4.2 19z" />
      <path d="M9.6 20.4v-5.2a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v5.2" />
    </Svg>
  )
}

/** 打开：一个敞开的文件夹（开始屏幕左栏第三格） */
export function IconFolderOpen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 6.4a1.6 1.6 0 0 1 1.6-1.6h3.4l1.9 2.3h6.3a1.6 1.6 0 0 1 1.6 1.6v1.1" />
      <path d="M3.9 8.9h14.6a1.5 1.5 0 0 1 1.45 1.9l-1.35 6a1.5 1.5 0 0 1-1.45 1.2H5.2A1.5 1.5 0 0 1 3.7 16.7z" />
    </Svg>
  )
}

/** 账户：一个人（本地文件没有账户，这一格是灰的） */
export function IconAccount(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="9" r="3.6" />
      <path d="M5.2 20c0-3.4 3-6 6.8-6s6.8 2.6 6.8 6" />
    </Svg>
  )
}

/** 选项：一个齿轮 */
export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="6.2" />
      <circle cx="12" cy="12" r="2.4" />
      {/* 六颗轮齿：贴着外圈往外长（不贴外圈的话看着像太阳，不像齿轮） */}
      <path
        d="M12 4.4V2.6M12 21.4v-1.8M3.6 12h1.8M18.6 12h1.8M6.1 6.1 4.8 4.8M17.9 6.1l1.3-1.3M6.1 17.9l-1.3 1.3M17.9 17.9l1.3 1.3"
        strokeWidth="2.1"
      />
    </Svg>
  )
}

/** 图钉：置顶到列表最上面（本地书架没有置顶这一说，这一格是灰的） */
export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.4 3.8h5.2l-.9 4 2.4 2.1v1.5H7.9v-1.5l2.4-2.1z" />
      <path d="M12 11.4v8.8" />
    </Svg>
  )
}

/** 星（收藏）：收藏夹那一栏用的是它 */
export function IconStarLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 4.2 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z" />
    </Svg>
  )
}

/**
 * Word 文档的图标：一页纸 + 左下角一个「W」徽标。
 * 徽标用主题的强调色（它是界面上的一枚文件类型记号，不是 Word 的商标——
 * 真正的商标是 IconWordMark 那个蓝方块，只在标题栏上出现一次）。
 */
export function IconWordFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.4 3.4h8.2l4 4v10.2a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2z" />
      <path d="M14.2 3.6v4h4" />
      <g fill="currentColor" stroke="none">
        <rect x="2.6" y="13.4" width="10" height="7" rx="1.4" style={{ fill: 'var(--mn-accent)' }} />
      </g>
      <path d="M4.6 15.2 5.9 18.6l1.35-2.6 1.35 2.6 1.3-3.4" stroke="#fff" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** 解锁高级模板的封面（插图：真 Word 里是一张位图封面，这里用主题色画一张） */
export function IconTemplateCover(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.6" y="3" width="18.8" height="18" rx="1.6" />
      <path d="M2.6 15.4h18.8v5.6" opacity="0.5" />
      <rect x="5.4" y="6" width="8.6" height="10.6" rx="0.8" style={{ fill: 'var(--mn-surface)', stroke: 'var(--mn-fg-muted)' }} />
      <path d="M6.8 8.2h5.8M6.8 10.2h4.6M6.8 12.2h5.8M6.8 14.2h3.4" strokeWidth="1.3" />
      <path d="M16.4 8.6h3.2M16.4 11h3.2M16.4 13.4h2" strokeWidth="1.4" opacity="0.75" />
    </Svg>
  )
}

/** 书法字帖的样张（插图：一页格子里写着字，旁边一支笔） */
export function IconCalligraphyPage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="3" width="14.4" height="18" rx="1.4" />
      <path d="M3.4 9h14.4M3.4 15h14.4M10.6 3v18" strokeWidth="1.3" opacity="0.6" />
      <path d="M6.2 6.6c1.6-1 3 1 4.6 0M12.6 12.6c1.6-1 3 1 4.6 0M6.2 17.4c1.6-1 3 1 4.6 0" strokeWidth="1.4" />
      <path d="m16.6 11.2 4.2 4.2-3 3-4.2-4.2z" style={{ fill: 'var(--mn-accent)' }} stroke="none" />
      <path d="m15.4 16.6 2 2-3.2 1z" style={{ fill: 'var(--mn-fg-muted)' }} stroke="none" />
    </Svg>
  )
}

/** 沉浸式阅读器：一本摊开的书 + 一个喇叭（真 Word 里它是「朗读」那一档） */
export function IconImmersiveReader(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 7.6S9.2 6 6.2 6c-1 0-1.7.3-1.7.3v9.4s.7-.3 1.7-.3c3 0 4.8 1.4 4.8 1.4s1.8-1.4 4.8-1.4c1 0 1.7.3 1.7.3V6.3s-.7-.3-1.7-.3c-3 0-4.8 1.6-4.8 1.6z" />
      <path d="M11 7.6v9.2" />
      <path d="M15.6 9.6 18 8v5.4l-2.4-1.6z" fill="currentColor" stroke="none" />
      <path d="M18 8v5.4" />
    </Svg>
  )
}

/** 缩放到 100%：一个框里写着 100（真 Word 那个记号就是这么画的） */
export function IconZoom100(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.6" y="6.4" width="14.8" height="11.2" rx="2.2" />
      <text
        x="12"
        y="14.4"
        textAnchor="middle"
        fontSize="7.2"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        100
      </text>
    </Svg>
  )
}

/** 页眉和页脚：一页纸，上下两条带（书里的每一页都没有，这一格是灰的） */
export function IconHeaderFooter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.2" y="3.6" width="13.6" height="16.8" rx="1.4" />
      <rect x="7.4" y="6" width="9.2" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="7.4" y="15.4" width="9.2" height="2.6" rx="0.7" fill="currentColor" stroke="none" opacity="0.55" />
    </Svg>
  )
}

/** 脚注：Ab 后面挂一个上标 1（真 Word 那个记号） */
export function IconFootnoteMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 18 8.6 6.4 13.6 18" />
      <path d="M5.4 14.4h6.4" />
      <path d="M15.4 13.6c.2-1.6 1.4-2.6 3-2.6 1.7 0 2.9 1 2.9 2.4 0 1.7-1.6 2.2-2.4 3.2M18.4 4.4h.02" strokeWidth="1.5" />
      <path d="M17.6 4.2h1.6l-.5 3.6" strokeWidth="1.5" />
    </Svg>
  )
}

/** 尾注：一页纸 + 右下角一个记号 */
export function IconEndnoteMark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.4 3.6h7.8L18 7.4v13H6.4a1.6 1.6 0 0 1-1.6-1.6V5.2a1.6 1.6 0 0 1 1.6-1.6z" />
      <path d="M14 3.7v4h4" />
      <path d="M7.6 15.4h6" />
      <path d="M15.4 17.6h.02" strokeWidth="2.2" />
    </Svg>
  )
}

/** 深色模式：一个半明半暗的圆 */
export function IconDarkMode(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 导航窗格（视图页签的「显示」那一组）：左边一列 + 正文那一块 */
export function IconNavRows(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.6" />
      <path d="M9.8 4.6v14.8" />
      <rect x="3.4" y="4.6" width="6.4" height="14.8" rx="1.6" fill="currentColor" stroke="none" opacity="0.3" />
      <path d="M12.4 8.6h5.4M12.4 12h5.4M12.4 15.4h3.4" strokeWidth="1.5" />
    </Svg>
  )
}

/** 放大镜（缩放那一组的记号）。比查找那个细一档：它是「缩放」不是「查找」 */
export function IconZoomIn(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.6" cy="10.6" r="5.6" />
      <path d="m14.8 14.8 4.6 4.6" />
    </Svg>
  )
}

/* ==========================================================================
   Excel 形态（2026-09-24，决定记录 36）
   --------------------------------------------------------------------------
   规格同上（24 格、1.75 描边、圆头、currentColor）。这一批按一张 Excel 截图
   一比一复刻：功能区的十组格子、编辑栏、行列标题、视图页签那几格。

   记号分三类：

   1. **字**：对齐方式里的「ab」「方向」「自动换行」、数字组里的小数位、
      「VLOOKUP」——真 Excel 里它们本来就是字，所以用 <text> 画
      （和 IconZoom100 同一个路子）；字号按 24 格里墨迹 60% 的口径给。
   2. **网格**：样式组与单元格组那几格都是「一个格子 + 一点动作」
      （条件格式 = 格子里两块变色、插入 = 箭头进格子、删除 = 格子上一个叉）。
      这些是**同一个记号**的变体，所以下面那几支画法刻意保持一致。
   3. **别的产品的记号**（OfficePLUS 的表格美化、便捷工具那六格、图片转文字）：
      颜色照截图取（绿 / 橙），和 IconAiHelper 那三支一样写死——它们是加载项的
      招牌，不是界面的一部分。其余一律 currentColor。
   ========================================================================== */

/* ---- Excel 的商标与文件 ---- */

/**
 * Excel 的商标：一块深绿的方块，右上角一块亮绿，中间一个白 X。
 * 三个绿都是产品色（#185C37 / #21A366 / #FFFFFF），跟着主题变色就不像它了。
 */
export function IconExcelMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M4.4 3.6h9.2l6 6v10.8a2.4 2.4 0 0 1-2.4 2.4H4.4A2.4 2.4 0 0 1 2 20.4V6a2.4 2.4 0 0 1 2.4-2.4z" fill="#185C37" />
      <path d="M13.6 3.6 19.6 9.6h-4.4a1.6 1.6 0 0 1-1.6-1.6z" fill="#21A366" />
      <path d="M2 12.4h11.6v9.2H4.4A2.4 2.4 0 0 1 2 19.2z" fill="#107C41" />
      <path d="m5.4 8.6 2.4 3.9-2.5 3.9M8 8.6l-2.6 3.9L8 16.4M4.2 8.6h1.4M6.6 8.6h1.4M4.6 16.4H6M7 16.4h1.4" stroke="#fff" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 工作簿的图标：一页纸 + 左下角一个绿方块里的 X。
 * 徽标用主题的强调色（和 IconWordFile 同一个道理：它是文件类型记号，不是商标）。
 */
export function IconExcelFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.4 3.4h8.2l4 4v10.2a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2z" />
      <path d="M14.2 3.6v4h4" />
      <rect x="2.6" y="13.4" width="10" height="7" rx="1.4" style={{ fill: 'var(--mn-accent)' }} stroke="none" />
      <path d="m4.8 15.2 2.3 3.4M7.1 15.2l-2.3 3.4M9.2 15.2h1.9" stroke="#fff" strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** 开始使用（开始屏幕左栏那个「>」方框，真 Excel 里是漫游向导） */
export function IconTour(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m10 7.6 4.4 4.4-4.4 4.4" />
    </Svg>
  )
}

/**
 * 标题栏右上角那片水印（开始屏幕）。
 *
 * 真 Excel 那里是**放大了几十倍的商标**，只露出一角：所以看上去是一圈圈同心圆
 * 与斜条纹，而不是一个完整的图标。这里就照那个样子画**几何**（不带品牌色）——
 * 它是标题栏上的装饰，颜色跟 currentColor 走，暗色主题下自己就暗下去。
 */
export function IconExcelWatermark(props: IconProps) {
  return (
    <svg viewBox="0 0 620 58" fill="none" stroke="currentColor" focusable="false" {...props}>
      <circle cx="654" cy="29" r="150" strokeWidth="26" opacity="0.55" />
      <circle cx="654" cy="29" r="96" strokeWidth="20" opacity="0.55" />
      <path d="M470 -40 560 -40M446 6 566 6M446 52 566 52M470 98 560 98" strokeWidth="22" opacity="0.5" />
      <path d="M330 -30 396 24M310 40 376 94" strokeWidth="18" opacity="0.45" />
      <path d="M214 -26 268 16M198 34 252 76M182 94 236 136" strokeWidth="14" opacity="0.4" />
    </svg>
  )
}

/* ---- 字体组 ---- */

/** 拼音指南：一个「文」上面标着拼音（截图里是 wén 两个字头） */
export function IconPhoneticGuide(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="12" y="9" textAnchor="middle" fontSize="6.4" fill="currentColor" stroke="none">
        wén
      </text>
      <path d="M4.4 12.6h15.2M7.2 12.6v7.2M12 12.6v7.4M16.8 12.6v5.4M7.2 16h4.8" strokeWidth="1.5" />
    </Svg>
  )
}

/* ---- 对齐方式组 ---- */

/** 方向（文字方向）：一个小「ab」加一个斜着往上的箭头 */
export function IconOrientation(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="2.6" y="19" fontSize="8" fontWeight="600" fill="currentColor" stroke="none">
        ab
      </text>
      <path d="M9.6 17.4c1.8-.6 3-2 3.6-4.2" />
      <path d="m17 7.6 1.8 2.2-2.6.6M18.8 9.8c-.9 3.4-3.2 5.5-7.2 6.4" />
    </Svg>
  )
}

/** 自动换行：「ab」下面一条折回来的箭头（Excel 那个记号） */
export function IconWrapAb(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="4.6" y="10.6" fontSize="8" fontWeight="600" fill="currentColor" stroke="none">
        ab
      </text>
      <path d="M4.4 14.6h9.4a2.8 2.8 0 0 1 0 5.6h-2.6" />
      <path d="m13.4 18 2.4 2.2-2.4 2.2" />
    </Svg>
  )
}

/** 顶端对齐：三行字贴着上边。左边那道竖线是「这一格」的边 */
export function IconAlignTop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 4.6v14.8" />
      <path d="M7 6.6h13M7 10.4h9M7 14.2h11" />
    </Svg>
  )
}

/** 垂直居中：三行字在正中间 */
export function IconAlignMiddle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 4.6v14.8" />
      <path d="M7 8.6h13M7 12.4h9M7 16.2h11" />
    </Svg>
  )
}

/** 底端对齐：三行字贴着下边 */
export function IconAlignBottom(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 4.6v14.8" />
      <path d="M7 10.6h13M7 14.4h9M7 18.2h11" />
    </Svg>
  )
}

/* ---- 数字组 ---- */

/** 货币：一个带框的币种记号 + 右下角一枚硬币 */
export function IconCurrency(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.4" y="4.2" width="14" height="10.4" rx="1.4" />
      <text x="9.4" y="12.2" textAnchor="middle" fontSize="8.6" fontWeight="600" fill="currentColor" stroke="none">
        ¥
      </text>
      <circle cx="17.4" cy="16.8" r="3.6" fill="currentColor" stroke="none" />
      <path
        d="M14.6 16.8h5.6M17.4 14v5.6"
        strokeWidth="1.4"
        style={{ stroke: 'var(--mn-surface)' }}
      />
    </Svg>
  )
}

/** 增加小数位数：.00 左边一只向左的箭头（真 Excel 那个记号就是这么画的） */
export function IconDecimalUp(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="0.4" y="14.4" fontSize="9" fill="currentColor" stroke="none">
        .00
      </text>
      <path d="M15.8 8.4h6M18 6.2l-2.2 2.2 2.2 2.2" strokeWidth="1.6" />
      <text x="13.6" y="20.4" fontSize="7.6" fill="currentColor" stroke="none">
        0
      </text>
    </Svg>
  )
}

/** 减少小数位数：往右再补一位 */
export function IconDecimalDown(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="0.4" y="14.4" fontSize="9" fill="currentColor" stroke="none">
        .00
      </text>
      <path d="M15.8 8.4h6M19.6 6.2l2.2 2.2-2.2 2.2" strokeWidth="1.6" />
      <text x="23.6" y="20.4" textAnchor="end" fontSize="7.6" fill="currentColor" stroke="none">
        0
      </text>
    </Svg>
  )
}

/* ---- 样式组与单元格组：一个格子 + 一点动作 ---- */

/** 条件格式：格子里两块变色（Excel 的记号是红蓝各一块） */
export function IconCondFormat(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="1.2" />
      <path d="M3.4 9.4h17.2M3.4 14.6h17.2M9.1 4.4v15.2M14.8 4.4v15.2" strokeWidth="1.3" />
      <rect x="3.9" y="4.9" width="4.7" height="4" fill="currentColor" stroke="none" />
      <rect x="15.3" y="15.1" width="4.7" height="4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 套用表格格式：格子 + 一支刷子 */
export function IconTableStyle(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="1.2" />
      <path d="M3.4 9.4h17.2M9.1 4.4v15.2M14.8 4.4v15.2" strokeWidth="1.3" />
      <path d="M3.9 4.9h4.7v4H3.9zM9.6 4.9h4.7v4H9.6zM15.3 4.9h4.7v4h-4.7z" fill="currentColor" stroke="none" />
      <path d="m13.4 13.2 4.4 4.4-2.8 2.8-4.4-4.4z" style={{ fill: 'var(--mn-surface)' }} />
      <path d="m10.6 16 2.8 2.8" strokeWidth="1.5" />
    </Svg>
  )
}

/** 单元格样式：格子中间那一块被刷过 */
export function IconCellStyles(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="1.2" />
      <path d="M3.4 9.4h17.2M3.4 14.6h17.2M9.1 4.4v15.2M14.8 4.4v15.2" strokeWidth="1.3" />
      <rect x="9.6" y="9.9" width="4.7" height="4.2" fill="currentColor" stroke="none" />
      <path d="m12.6 13.6 5 5-2.8 2.8-5-5z" style={{ fill: 'var(--mn-surface)' }} />
      <path d="m9.8 16.4 2.8 2.8" strokeWidth="1.5" />
    </Svg>
  )
}

/** 插入单元格：一个箭头从左上角进格子 */
export function IconCellInsert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.4 4.6h10.2a1.2 1.2 0 0 1 1.2 1.2v13.6a1.2 1.2 0 0 1-1.2 1.2H9.4" />
      <path d="M9.4 4.6v16.8" strokeWidth="1.5" />
      <path d="M9.4 12.4h5.4" strokeWidth="1.5" />
      <path d="M4 8.2 1.8 12 4 15.8" strokeWidth="1.5" />
      <path d="M1.8 12h6.4" strokeWidth="1.5" />
    </Svg>
  )
}

/** 删除单元格：格子上一个叉 */
export function IconCellDelete(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.6" y="4.8" width="14.8" height="14.4" rx="1.2" />
      <path d="M4.6 9.6h14.8M4.6 14.4h14.8M9.8 4.8v14.4M14.4 4.8v14.4" strokeWidth="1.3" />
      <path d="m9 9.9 6 6M15 9.9l-6 6" strokeWidth="2" />
    </Svg>
  )
}

/** 单元格格式：格子里那一行被选中（一条粗横杠） */
export function IconCellFormat(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.6" y="4.8" width="14.8" height="14.4" rx="1.2" />
      <path d="M4.6 9.6h14.8M4.6 14.4h14.8M9.8 4.8v14.4M14.4 4.8v14.4" strokeWidth="1.3" />
      <path d="M4.6 14.4h14.8" strokeWidth="2.4" />
    </Svg>
  )
}

/* ---- 编辑组 ---- */

/** 填充：一个框 + 一个往下落的箭头 */
export function IconFillDown(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.6" width="14" height="7.4" rx="1.2" />
      <path d="M12 12.6v8.6" strokeWidth="1.9" />
      <path d="m8.6 18 3.4 3.4L15.4 18" strokeWidth="1.9" />
    </Svg>
  )
}

/** 清除：一块橡皮（真 Excel 里它是紫的，这里跟文字同色） */
export function IconClearAll(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m11.6 3.8 8.6 8.6-7.4 7.4H7.6l-4.2-4.2z" />
      <path d="M4.4 20.2h15.2" strokeWidth="2.4" />
      <path d="m8.4 7 8.6 8.6" strokeWidth="1.5" />
    </Svg>
  )
}

/** 排序和筛选：AZ 加一个漏斗（Excel 里这两件事就在一格上） */
export function IconSortFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <text x="0.8" y="12" fontSize="9.4" fontWeight="600" fill="currentColor" stroke="none">
        AZ
      </text>
      <path d="M2.2 15.2h6.6M5.5 14v6.4M2.6 20.4l2.9-6.4 2.9 6.4" strokeWidth="1.4" />
      <path d="M13 4.6h8.6l-3.3 4.2v5.4l-2 .9V8.8z" />
    </Svg>
  )
}

/* ---- 视图页签 ---- */

/** 普通视图：一张网格，格子占满（这就是我们现在的样子） */
export function IconNormalView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.2" />
      <path d="M3.4 9.8h17.2M3.4 15h17.2M9.1 4.6v14.8M14.8 4.6v14.8" strokeWidth="1.3" />
    </Svg>
  )
}

/** 页面布局：一页纸上有一条页眉与一条页脚 */
export function IconPageLayoutView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.6" width="14" height="16.8" rx="1.2" />
      <path d="M5 7.6h14M5 16.4h14" strokeWidth="1.5" />
      <path d="M7.4 10.6h6M7.4 13h4" strokeWidth="1.4" />
    </Svg>
  )
}

/** 分页预览：网格上两条虚线（哪里分页） */
export function IconPageBreakView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.2" />
      <path d="M3.4 10.4h17.2M10.8 4.6v14.8" strokeDasharray="2.4 2.2" strokeWidth="1.3" />
      <path d="M3.4 15.6h17.2" strokeWidth="1.3" />
    </Svg>
  )
}

/** 自定义视图：网格 + 一支笔（保存下来的视图） */
export function IconCustomViews(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.2" />
      <path d="M3.4 9.8h17.2M9.1 4.6v14.8" strokeWidth="1.3" />
      <path d="m14.6 12.2 3.4 3.4-1.6 1.6-3.4-3.4z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 网格线：一张网格，线画得比别处清楚 */
export function IconGridLines(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.2" strokeWidth="1.4" />
      <path d="M3.4 9.6h17.2M3.4 14.6h17.2M9.1 4.6v14.8M14.8 4.6v14.8" />
    </Svg>
  )
}

/** 编辑栏：一个框里写着 fx */
export function IconFormulaBar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.6" y="6.6" width="18.8" height="10.8" rx="1.6" />
      <text x="7" y="14.6" fontSize="7.4" fontStyle="italic" fontWeight="600" fill="currentColor" stroke="none">
        fx
      </text>
      <path d="M11.6 8.8v6.4" strokeWidth="1.3" />
    </Svg>
  )
}

/** 标题（行列标题）：网格上头多一排 A B C */
export function IconSheetHeaders(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="3.6" width="17.2" height="16.8" rx="1.2" />
      <path d="M3.4 8.4h17.2M9.1 8.4v12M14.8 8.4v12" />
      <text x="6.3" y="7.2" textAnchor="middle" fontSize="4.6" fill="currentColor" stroke="none">
        A
      </text>
      <text x="12" y="7.2" textAnchor="middle" fontSize="4.6" fill="currentColor" stroke="none">
        B
      </text>
      <text x="17.6" y="7.2" textAnchor="middle" fontSize="4.6" fill="currentColor" stroke="none">
        C
      </text>
    </Svg>
  )
}

/** 冻结窗格：网格上头那一条被一条实线钉住（下头那两条是虚线） */
export function IconFreezePanes(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="1.2" />
      <path d="M3.4 9.6h17.2" strokeWidth="2.2" />
      <path d="M9.1 9.6v9.8M14.8 9.6v9.8M3.4 14.6h17.2" strokeDasharray="2.4 2.2" strokeWidth="1.3" />
    </Svg>
  )
}

/** 工作表标签：底下一条标签条，当前那一张挑出来（Excel 的标签栏记号） */
export function IconSheetTab(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="10.4" rx="1.2" />
      <path d="M3.4 18.6h4.4a1.2 1.2 0 0 0 1.2-1.2v-1.4h6.4v1.4a1.2 1.2 0 0 0 1.2 1.2h4.4" />
    </Svg>
  )
}

/* ---- 加载项那几格（别的产品的记号，颜色照截图取） ---- */

/** 表格美化（OfficePLUS）：一张绿格子 + 一支绿刷子 */
export function IconTableBeautify(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.6" y="4.6" width="13.6" height="13.2" rx="1" />
        <path d="M2.6 9h13.6M2.6 13.4h13.6M7.2 4.6v13.2M11.8 4.6v13.2" />
      </g>
      <path d="M14.6 9.4c3.4 0 5.8 1.6 5.8 3.8 0 1.4-1 2.4-2.4 3.4l-2.2 1.6c-1 .8-2.4.4-2.8-.8-.2-.6 0-1.2.4-1.6.8-.8 2-1.4 2-2.6 0-1.2-1.4-2-3.2-2.2z" fill="#107C41" stroke="none" />
    </svg>
  )
}

/** 高级筛选：绿格子 + 漏斗 */
export function IconAdvFilter(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.6" y="4.6" width="12.8" height="12.8" rx="1" />
        <path d="M2.6 9h12.8M7 4.6v12.8" />
      </g>
      <path d="M13.4 12.4h8l-3 3.8v4.2l-2-.9v-3.3z" fill="#107C41" stroke="none" />
    </svg>
  )
}

/** 文本提取：一页纸上的 A + 一颗宝石 */
export function IconTextExtract(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M15.6 3.8H7.4a1.6 1.6 0 0 0-1.6 1.6v13.2a1.6 1.6 0 0 0 1.6 1.6h4" fill="none" stroke="#107C41" strokeWidth="1.7" />
      <path d="M8.4 4.2 11.4 13 14.4 4.2M9.4 9.6h4" fill="none" stroke="#107C41" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15.8 12.6 3 3-3 3-3-3z" fill="#2CA36A" stroke="none" />
      <path d="M17.4 19.4v1.8" stroke="#107C41" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 查找录入：绿格子 + 一个放大镜 */
export function IconFindEntry(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.8" y="4.4" width="13.2" height="13.2" rx="1" />
        <path d="M2.8 9h13.2M7.4 4.4v13.2" />
      </g>
      <circle cx="15.4" cy="15.4" r="4" fill="none" stroke="#2CA36A" strokeWidth="1.8" />
      <path d="m18.4 18.4 2.6 2.6" fill="none" stroke="#2CA36A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** 拆分合并：两块格子，一个箭头从中间穿过去 */
export function IconSplitMerge(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.8" y="3.6" width="8" height="7.6" rx="1" />
        <rect x="13.2" y="12.8" width="8" height="7.6" rx="1" />
      </g>
      <path d="M13.4 4.6h5.2v5.2" fill="none" stroke="#2CA36A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.6 19.4H5.4v-5.2" fill="none" stroke="#2CA36A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 批量删除：绿格子 + 一个叉 */
export function IconBatchDelete(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.8" y="4.4" width="13.2" height="13.2" rx="1" />
        <path d="M2.8 9h13.2M7.4 4.4v13.2" />
      </g>
      <path d="m14.4 13.4 5.4 5.4M19.8 13.4l-5.4 5.4" fill="none" stroke="#D83B01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** VLOOKUP：绿格子 + 一列往下找的箭头 */
export function IconVlookup(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.6" y="4.4" width="13.6" height="13.2" rx="1" />
        <path d="M2.6 8.8h13.6M2.6 13.2h13.6M7.2 4.4v13.2M11.8 4.4v13.2" />
      </g>
      <path d="m17.6 3.6 2.8 3.4-2.8 3.4" fill="none" stroke="#2CA36A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.4 7h-6.6" fill="none" stroke="#2CA36A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** 图片转文字：一张照片 + 一页写着字 */
export function IconImageToText(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" stroke="#107C41" strokeWidth="1.7">
        <rect x="2.4" y="3.6" width="11.4" height="9" rx="1" />
        <path d="M2.4 10.2 5.6 7l2.6 2.8 2-1.8 3.6 4" />
        <circle cx="6" cy="6" r="1" fill="#107C41" stroke="none" />
      </g>
      <rect x="12.6" y="11.6" width="9" height="9.4" rx="1" fill="none" stroke="#2CA36A" strokeWidth="1.7" />
      <path d="M14.6 18.4 16.4 14l1.8 4.4M15.3 17h2.2M18.8 14h1.4" fill="none" stroke="#2CA36A" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
