/**
 * 快捷键的验收脚本。
 *
 * 这段逻辑的失败方式是「某一组键按下去没反应」或者更糟——「按下去触发了别的功能」，
 * 两种都不看屏幕就发现不了（一个要在真键盘上按，另一个要盯着屏幕看它到底变没变）。
 * 所以按解析器那套办法办：把判定拉出来逐条断言。
 *
 * 覆盖四类：
 *   1. 组合串的解析与规范化（修饰键顺序、重复、不认识的修饰键）
 *   2. code → 标签 的来回换算（KeyQ / Digit1 / F2 / Slash / Numpad1）
 *   3. 一次按键能不能匹配组合：多按一个修饰键不算、德语布局下 Alt+S 仍要命中
 *   4. 录键时要挡掉的东西：只有修饰键、只带 Shift、认不出来的串
 *
 * 用法：bun run verify:hotkey
 */
import { comboFromEvent, comboProblem, keyLabel, matchesCombo, parseCombo } from '../src/lib/hotkey'

let checked = 0
const problems: string[] = []

function check(name: string, actual: unknown, expected: unknown): void {
  checked++
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) problems.push(`${name}：得到 ${a}，期望 ${e}`)
}

/** 一个最小的事件替身。只需要判定用到的那几个字段 */
function keyEvent(init: {
  code: string
  key?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}): KeyboardEvent {
  return {
    code: init.code,
    key: init.key ?? '',
    ctrlKey: init.ctrl ?? false,
    altKey: init.alt ?? false,
    shiftKey: init.shift ?? false,
    metaKey: init.meta ?? false,
  } as KeyboardEvent
}

// 1) 解析：修饰键可以任意顺序，规范化交给 comboFromEvent（录键时生成的就是它）
check('解析 Alt+Q', parseCombo('Alt+Q')?.label, 'Q')
check('解析 Alt+Q 的 alt', parseCombo('Alt+Q')?.alt, true)
check('解析 Ctrl+Alt+K', parseCombo('Ctrl+Alt+K'), {
  ctrl: true,
  alt: true,
  shift: false,
  meta: false,
  label: 'K',
})
check('解析 Shift+Meta+J', parseCombo('Shift+Meta+J')?.shift, true)
check('空串解析不出来', parseCombo(''), null)
check('重复修饰键解析不出来', parseCombo('Alt+Alt+Q'), null)
check('不认识的修饰键解析不出来', parseCombo('Hyper+Q'), null)

// 2) code ↔ 标签
check('KeyQ → Q', keyLabel('KeyQ'), 'Q')
check('Digit1 → 1', keyLabel('Digit1'), '1')
check('F2 原样', keyLabel('F2'), 'F2')
check('Slash 原样', keyLabel('Slash'), 'Slash')
check('Numpad1 原样', keyLabel('Numpad1'), 'Numpad1')

check(
  'Alt+KeyQ → Alt+Q',
  comboFromEvent(keyEvent({ code: 'KeyQ', key: 'q', alt: true })),
  'Alt+Q',
)
check(
  '修饰键顺序规范成 Ctrl+Alt+Shift+Meta',
  comboFromEvent(keyEvent({ code: 'KeyJ', key: 'J', alt: true, ctrl: true, meta: true, shift: true })),
  'Ctrl+Alt+Shift+Meta+J',
)
check('只按修饰键不算组合', comboFromEvent(keyEvent({ code: 'AltLeft' })), null)
check('只按 ControlLeft 不算组合', comboFromEvent(keyEvent({ code: 'ControlLeft' })), null)
check('code 为空不算组合', comboFromEvent(keyEvent({ code: '' })), null)

// 3) 匹配
check('Alt+Q 命中 Alt+Q', matchesCombo(keyEvent({ code: 'KeyQ', key: 'q', alt: true }), 'Alt+Q'), true)
check(
  '多按一个 Shift 就不算',
  matchesCombo(keyEvent({ code: 'KeyQ', key: 'q', alt: true, shift: true }), 'Alt+Q'),
  false,
)
check(
  '少按 Alt 就不算',
  matchesCombo(keyEvent({ code: 'KeyQ', key: 'q' }), 'Alt+Q'),
  false,
)
check(
  '别的键不算',
  matchesCombo(keyEvent({ code: 'KeyW', key: 'w', alt: true }), 'Alt+Q'),
  false,
)
check(
  // 德语布局里 Alt+S 打出来的是 ß：按 code 判，所以照样命中
  'Alt+S 在别的布局下仍命中（键位判定）',
  matchesCombo(keyEvent({ code: 'KeyS', key: 'ß', alt: true }), 'Alt+S'),
  true,
)
check('Ctrl+Alt+K 命中自己', matchesCombo(keyEvent({ code: 'KeyK', ctrl: true, alt: true }), 'Ctrl+Alt+K'), true)
check('认不出来的组合不匹配', matchesCombo(keyEvent({ code: 'KeyQ', alt: true }), 'Hyper+Q'), false)

// 4) 录键校验
const plain = comboProblem('K')
check('单个字母被挡下（提示要带修饰键）', plain !== null && plain.includes('Ctrl'), true)
const shiftOnly = comboProblem('Shift+Q')
check('只带 Shift 也被挡下', shiftOnly !== null && shiftOnly.includes('Ctrl'), true)
check('Alt+Q 可用', comboProblem('Alt+Q'), null)
check('Ctrl+Shift+J 可用', comboProblem('Ctrl+Shift+J'), null)

if (problems.length === 0) {
  console.log(`快捷键验收通过（${checked} 项断言）`)
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const problem of problems) console.log(`  ✗ ${problem}`)
  process.exit(1)
}
