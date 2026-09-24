import type { ReactNode } from 'react'
import type { BookRecord } from '../db/db'
import type { TocRow } from '../hooks/useToc'
import type { ReaderSettings } from '../store/settings'

/**
 * 五套办公外壳的形态名。
 *
 * AppChrome（themes/types.ts）里那个还把 code 算进来——它也是「带外壳的形态」，
 * 只是外壳在 components/code 那边、历史更久。这一层分开写，是为了让办公外壳
 * 的组件不必处理「code 分支不可能发生」这件事。
 */
export type AppShellChrome = 'doc' | 'chat' | 'page' | 'sheet' | 'slide'

/**
 * 五个办公外壳共用的契约。
 *
 * 和编辑器形态一样，外壳**只认 chrome，不认主题 id**：同一副 Word 外壳
 * 由亮色和暗色两套主题各自上色。所以这里没有一处提到颜色的名字，
 * 只有「要显示什么」和「点了要做什么」。
 *
 * 三件事每个外壳都要做，做法也一样：
 *
 * 1. **回书架**（onBack）：各自用各自的方式——Office 是「文件」页签，
 *   飞书是左上角的返回箭头，企业微信是功能栏里的图标。
 * 2. **换章**（onChapter）：Office 是导航窗格 / 工作表标签 / 节，
 *   飞书是文档大纲，企业微信是聊天记录。
 * 3. **压暗**（dim）：摸鱼模式的黑纱，盖在正文区上（--mn-dim + styles/office.css 的 .mn-veil）。
 */
export interface AppFrameProps {
  chrome: AppShellChrome
  book: BookRecord
  /** 整个书架。企业微信的会话列表、通讯录、微盘都要它 */
  books?: BookRecord[]
  /** 目录（章）。可能还没读出来——外壳要对 undefined 有耐心 */
  chapters?: TocRow[]
  chapterIndex: number
  /** 一共多少章。章节列表还没读出来时由调用方给个准数（书上记着） */
  chapterCount: number
  chapterTitle: string
  /** 这一章（还没被解析成块之前）的 HTML。Word 的「复制」按钮要它 */
  chapterHtml?: string
  /** 这一章的字数（状态栏用）。目录还没读出来时是 undefined */
  chapterChars?: number
  /**
   * 渲染时的 blob 图片地址 → 书里的原始路径。表格形态里图片要写成
   * `![](./路径)`，靠它把 blob 地址换回原路径（见 lib/blocks.ts）
   */
  resolveMedia?: (src: string) => string | undefined
  /** 全书进度 0-1（状态栏上「已读 18%」那个） */
  percent: number
  /**
   * 章内进度 0-1。表格的「当前行」、幻灯片的「当前这张」按它算——
   * 按全书进度算的话，翻到第 3 章时表格里的高亮行和编辑栏会各说各话
   * （正文那边用的是章内比例）。
   */
  chapterPercent: number
  /** 这本书生效的阅读设置。Word / Excel / PPT 的功能区直接改它 */
  settings: ReaderSettings
  onSettingsChange: (patch: Partial<ReaderSettings>) => void
  onChapter: (index: number) => void
  onSeek: (percent: number) => void
  onBack: () => void
  onOpenSettings: () => void
  /** 导入文件（企业微信输入区那个回形针、Office 开始屏幕的「新建」都用它） */
  onImport?: () => void
  /** 换一本书（企业微信的会话列表用）。不传就表示这个外壳不能换书 */
  onOpenBook?: (book: BookRecord) => void
  /** 摸鱼模式的压暗程度 0-1 与开关（功能区和标题栏上各有一个入口） */
  dim: number
  dimOn: boolean
  onToggleDim: () => void
  /** 正文。由各自形态决定怎么摆（页面、网格、幻灯片、聊天流） */
  children: ReactNode
}

/** 章标题取不到时的兜底名 */
export function chapterName(title: string, index: number): string {
  return title && title.trim() ? title.trim() : `第 ${index + 1} 章`
}
