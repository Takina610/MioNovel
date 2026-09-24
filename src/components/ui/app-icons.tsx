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
