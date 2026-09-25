import type { ReaderTheme, ThemeChrome } from './types'
import { chromeOf } from './apply'

/**
 * 主题选择器的类别。20 套主题全摆在一张网格里找不到东西，
 * 按软件的类型分四类：常规（普通阅读器）、编辑器（VS Code）、
 * 通讯（飞书 / 企业微信 / 1688 客服工作台——都是「跟人说话」的那类软件）、
 * Office（Word / Excel / PPT 三件套）。
 *
 * 类别**从形态（chrome）推导，不认主题 id**：往 builtin.ts 加一套主题，
 * 只要 chrome 声明对了，它就自动落进对的类别，这里和 ThemePicker 都不用改。
 */
export interface ThemeGroup {
  label: string
  /** 落进这一组的形态。四组的 chromes 互不重叠，一个主题只属于一组 */
  chromes: ThemeChrome[]
  /** 组内主题，保持注册表（builtin.ts）的顺序 */
  themes: ReaderTheme[]
}

const GROUP_DEFS: ReadonlyArray<{ label: string; chromes: ThemeChrome[] }> = [
  { label: '常规', chromes: ['plain'] },
  { label: '编辑器', chromes: ['code'] },
  { label: '通讯', chromes: ['doc', 'chat', 'desk'] },
  { label: 'Office', chromes: ['page', 'sheet', 'slide'] },
]

/** 把主题按类别分组。没有主题的组不返回 */
export function groupThemes(themes: ReaderTheme[]): ThemeGroup[] {
  return GROUP_DEFS.map((def) => ({
    label: def.label,
    chromes: def.chromes,
    themes: themes.filter((theme) => def.chromes.includes(chromeOf(theme))),
  })).filter((group) => group.themes.length > 0)
}
