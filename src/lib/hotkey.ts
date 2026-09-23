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
export function comboProblem(combo: string): string | null {
  const parts = parseCombo(combo)
  if (!parts) return '这个组合认不出来'
  if (!parts.ctrl && !parts.alt && !parts.meta) return '要带上 Ctrl 或 Alt'
  return null
}
