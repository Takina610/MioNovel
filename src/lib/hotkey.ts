/**
 * 快捷键组合的解析与匹配。
 *
 * 组合存成**给人看的一行字**（`Alt+Q`）：菜单里要显示它，设置里要显示它，
 * 存成 `{ctrl:false, alt:true, code:'KeyQ'}` 那种结构只会多一层翻译。
 *
 * 匹配按**物理键位**（`event.code`）而不是 `event.key`：Alt 按住时 `key`
 * 会跟着键盘布局变（德语布局里 Alt+S 打出的是 ß），只有 code 说的是「你按了哪个键」。
 * 用户录键时也按 code 记，所以录进来什么、按什么能触发，两边是同一套判定。
 */

export interface ComboParts {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** 组合里那个「真正的键」，例如 Q / 1 / F2 / ArrowUp */
  label: string
}

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

/** 修饰键自己的 code。它们只是前缀，单独按下不算一个组合 */
const MODIFIER_CODE = /^(Control|Alt|Shift|Meta)(Left|Right)$/

/** code → 给人看的那一段。`KeyQ` 写成 Q，`Digit1` 写成 1，其余照抄（F2、ArrowUp、Slash…） */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  return code
}

/** 上一条的逆运算：能一对一还原的按规则还原，还原不了的（Numpad1、Slash）本来就和 label 同名 */
function codeOf(label: string): string {
  if (/^[A-Z]$/.test(label)) return `Key${label}`
  if (/^[0-9]$/.test(label)) return `Digit${label}`
  return label
}

/**
 * `'Alt+Shift+Q'` → 结构化。
 * 结构对不上（空串、重复修饰键、不认识的修饰键）返回 null。
 * 注意**不带修饰键也不算结构错误**（`'K'` 是能解析的，只是不该被绑定）：
 * 那是 comboProblem 的判定，报错文案不一样（「要带上 Ctrl 或 Alt」）。
 */
export function parseCombo(combo: string): ComboParts | null {
  const segments = combo.split('+').filter(Boolean)
  if (segments.length === 0) return null
  const label = segments[segments.length - 1]
  const mods = segments.slice(0, -1)
  if (new Set(mods).size !== mods.length) return null
  if (mods.some((mod) => !(MODIFIERS as readonly string[]).includes(mod))) return null
  return {
    ctrl: mods.includes('Ctrl'),
    alt: mods.includes('Alt'),
    shift: mods.includes('Shift'),
    meta: mods.includes('Meta'),
    label,
  }
}

/**
 * 一个按下的事件 → 组合串。只按了修饰键时返回 null（那还不是一个组合，
 * 录键要等用户按真正那个键）。
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (!event.code || MODIFIER_CODE.test(event.code)) return null
  const label = keyLabel(event.code)
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(label)
  return parts.join('+')
}

/** 这一次按键是不是就是这个组合。修饰键**要完全一致**：多按一个 Shift 就不算 */
export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = parseCombo(combo)
  if (!parts) return false
  if (event.ctrlKey !== parts.ctrl || event.altKey !== parts.alt) return false
  if (event.shiftKey !== parts.shift || event.metaKey !== parts.meta) return false
  if (event.code && codeOf(parts.label) === event.code) return true
  // code 为空（少数虚拟键盘）时的兜底：按字符比。Alt 组合下 key 可能是别的字符，
  // 所以它只在 code 这条路走不通时才用。
  return event.key.length === 1 && event.key.toUpperCase() === parts.label
}

/**
 * 能不能当快捷键用。返回不可用的原因，可用返回 null。
 *
 * 必须带 Ctrl / Alt / ⌘ 之一：只带 Shift 的话，在输入框里打一个大写字母就会触发，
 * 而全局快捷键是**不管焦点在哪都会响**的（见 hooks/useGlobalHotkeys）。
 */
export function comboProblem(combo: string, scope: HotkeyScope = 'global'): string | null {
  const parts = parseCombo(combo)
  if (!parts) return '这个组合认不出来'
  if (scope === 'global' && !parts.ctrl && !parts.alt && !parts.meta) return '要带上 Ctrl 或 Alt'
  return null
}

/* ==========================================================================
   命令表
   --------------------------------------------------------------------------
   哪些功能有快捷键、各是什么组合、属于哪一档生效范围——这张表是**唯一事实来源**。
   设置面板、菜单上的键位提示、冲突检查都从它推出来；加一个快捷键 = 这里加一条
   + 在页面上用 `useHotkey(id, …)` 登记一下（见 hooks/useHotkeys）。
   ========================================================================== */

/**
 * 一个快捷键的生效范围。
 *
 *   focused  只在「没有在输入框里打字」时响应，所以**可以是不带修饰键的单键**
 *            （S / T / F）：它们只在该页面里、且焦点不在输入框时生效。
 *   global   不管焦点在哪都会响，所以**必须带一个真修饰键**——否则在搜索框里
 *            打一个 s 就会把设置面板开出来（见 hooks/useGlobalHotkeys）。
 */
export type HotkeyScope = 'focused' | 'global'

export type HotkeyId = 'settings' | 'toc' | 'fullscreen' | 'decoy' | 'dim'

/**
 * 这个功能在哪些形态下存在。
 *
 * 有些功能只属于某几种形态——**只要这个功能在那一屏上看得见、按下去有反应，
 * 它的键就该在那儿响**，两处不能各判各的（这一条是踩出来的：设置面板里
 * 五套办公外壳都有「摸鱼模式」开关，而它的键只在编辑器形态下响应，
 * 于是飞书里按 Alt+S 毫无反应）。
 *
 *   editor   只有编辑器形态（VS Code 那两套）：演示模式
 *   shells   所有带外壳的形态（编辑器 + 五套办公外壳）：摸鱼模式——
 *            它们都有「正文那一片」可压。也是设置面板里那一栏出现的条件
 *   （不写） 到处都在：页面里的 S / T / F，登记在哪个页面就在哪儿生效
 */
export type HotkeyPresence = 'editor' | 'shells'

export interface HotkeyCommand {
  id: HotkeyId
  label: string
  /** 默认组合。存的是给人看的一行字，和用户改过之后的格式完全一样 */
  combo: string
  scope: HotkeyScope
  presence?: HotkeyPresence
}

export const HOTKEY_COMMANDS: readonly HotkeyCommand[] = [
  { id: 'settings', label: '阅读设置', combo: 'S', scope: 'focused' },
  { id: 'toc', label: '目录 / 侧栏', combo: 'T', scope: 'focused' },
  { id: 'fullscreen', label: '全屏', combo: 'F', scope: 'focused' },
  { id: 'decoy', label: '演示模式', combo: 'Alt+Q', scope: 'global', presence: 'editor' },
  { id: 'dim', label: '摸鱼模式', combo: 'Alt+S', scope: 'global', presence: 'shells' },
]

export const DEFAULT_HOTKEYS = Object.fromEntries(
  HOTKEY_COMMANDS.map((command) => [command.id, command.combo]),
) as Record<HotkeyId, string>

/** 菜单提示与错误文案里要把功能的名字说出来，所以标签也放这儿，和默认值挨着 */
export const HOTKEY_LABELS = Object.fromEntries(
  HOTKEY_COMMANDS.map((command) => [command.id, command.label]),
) as Record<HotkeyId, string>

export function hotkeyCommandOf(id: HotkeyId): HotkeyCommand {
  return HOTKEY_COMMANDS.find((command) => command.id === id) ?? HOTKEY_COMMANDS[0]
}

/**
 * 这个功能此刻在不在。`chrome` 取 `<html>` 上的 data-chrome（见 themes/apply.ts）。
 *
 * **快捷键和设置面板都读这一个函数**：只在看得见、按得响的地方响应，
 * 而不是「键还占着，但状态改在你看不见的地方」。普通阅读形态（plain）
 * 没有内容区可压，所以这些功能在那儿整个不存在。
 */
export function hotkeyLiveOn(id: HotkeyId, chrome: string): boolean {
  const presence = hotkeyCommandOf(id).presence
  if (!presence) return true
  if (presence === 'editor') return chrome === 'code'
  // shells：编辑器 + 五套办公外壳，也就是「不是普通阅读形态」
  return chrome !== '' && chrome !== 'plain'
}
