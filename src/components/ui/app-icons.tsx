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
