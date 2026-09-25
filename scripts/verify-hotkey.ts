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
 *   5. 命令表本身：默认组合不重复、每条都合法、标签齐全、两条「伪装」功能是全局档，
 *      以及「这个功能在哪些形态下存在」（hotkeyLiveOn）——快捷键与设置面板共用它
 *
 * 用法：bun run verify:hotkey
 */
import {
  comboDisplay,
  comboFromEvent,
  comboProblem,
  DEFAULT_HOTKEYS,
  hotkeyCommandOf,
  hotkeyLiveOn,
  HOTKEY_COMMANDS,
  HOTKEY_LABELS,
  keyLabel,
  matchesCombo,
  parseCombo,
  resolveCombos,
} from '../src/lib/hotkey'

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
check('单个字母被挡下（全局快捷键要带修饰键）', plain !== null && plain.includes('Ctrl'), true)
const shiftOnly = comboProblem('Shift+Q')
check('只带 Shift 也被挡下', shiftOnly !== null && shiftOnly.includes('Ctrl'), true)
check('Alt+Q 可用', comboProblem('Alt+Q'), null)
check('Ctrl+Shift+J 可用', comboProblem('Ctrl+Shift+J'), null)
// 页面里的命令（focused）可以绑单键：它们只在没有输入焦点时响
check('focused 档允许单键', comboProblem('S', 'focused'), null)
check('focused 档仍然挡掉认不出来的串', comboProblem('Hyper+Q', 'focused'), '这个组合认不出来')
check('同一个单键在 global 档过不了', comboProblem('S', 'global') !== null, true)

// 5) 命令表：默认值、标签、作用域都要自洽
{
  const ids = HOTKEY_COMMANDS.map((command) => command.id)
  check('命令 id 不重复', new Set(ids).size, ids.length)
  // 一条命令可以绑多个组合（「下一页」默认就有四个）：所有默认组合摊开来看重复
  const defaultCombos = HOTKEY_COMMANDS.flatMap((command) => command.combos)
  check('默认组合不重复（两条命令抢同一个键，谁先响说不清）', new Set(defaultCombos).size, defaultCombos.length)
  check(
    '每条默认组合都合法（按它自己的作用域判）',
    HOTKEY_COMMANDS.every((command) =>
      command.combos.every((combo) => comboProblem(combo, command.scope) === null),
    ),
    true,
  )
  check(
    '每条默认组合都非空',
    HOTKEY_COMMANDS.every((command) => command.combos.length > 0),
    true,
  )
  check(
    '每条命令都有中文标签和一行说明',
    HOTKEY_COMMANDS.every((command) => command.label.trim().length > 0 && command.description.trim().length > 0),
    true,
  )
  check(
    '两条「伪装」功能是全局档（不带修饰键会在输入框里误触发）',
    HOTKEY_COMMANDS.filter((command) => command.scope === 'global').map((command) => command.id).join(','),
    'decoy,dim',
  )
  check(
    '页面命令全部是 focused 档',
    HOTKEY_COMMANDS.filter((command) => command.scope === 'focused').map((command) => command.id).join(','),
    'settings,toc,next-page,prev-page,prev-chapter,next-chapter,fullscreen,exit',
  )
  check('默认组合表和命令表一致（阅读设置）', DEFAULT_HOTKEYS.settings, ['S'])
  check('默认组合表和命令表一致（全屏改成了 F11）', DEFAULT_HOTKEYS.fullscreen, ['F11'])
  check('默认组合表和命令表一致（下一页有四个键）', DEFAULT_HOTKEYS['next-page'], ['ArrowDown', 'ArrowRight', 'Space', 'PageDown'])
  check('默认组合表和命令表一致（上一章）', DEFAULT_HOTKEYS['prev-chapter'], ['Ctrl+Alt+ArrowLeft'])
  check('默认组合表和命令表一致（退出阅读）', DEFAULT_HOTKEYS.exit, ['Escape'])
  check('标签表和命令表一致', HOTKEY_LABELS.toc, '目录 / 侧栏')
  check('查得到某条命令的作用域', hotkeyCommandOf('decoy').scope, 'global')

  // 「在不在」这一个判断，快捷键与设置面板共用（hotkeyLiveOn）。
  // 这一条是踩出来的：面板里五套办公外壳都有「摸鱼模式」开关，而它的键只在
  // 编辑器形态下响应，于是飞书里按 Alt+S 毫无反应。
  check('演示模式只在编辑器形态下存在', hotkeyLiveOn('decoy', 'code'), true)
  check('演示模式在飞书里不存在', hotkeyLiveOn('decoy', 'doc'), false)
  check('摸鱼模式在编辑器形态下存在', hotkeyLiveOn('dim', 'code'), true)
  check(
    '摸鱼模式在五套办公外壳里都存在',
    ['doc', 'chat', 'page', 'sheet', 'slide'].every((chrome) => hotkeyLiveOn('dim', chrome)),
    true,
  )
  check(
    '两个「伪装」功能在普通阅读形态下都不存在',
    hotkeyLiveOn('decoy', 'plain') === false && hotkeyLiveOn('dim', 'plain') === false,
    true,
  )
  check(
    '没写 presence 的命令到处都在（登记在哪个页面就在哪儿生效）',
    hotkeyLiveOn('settings', 'plain') && hotkeyLiveOn('toc', 'doc'),
    true,
  )
  check(
    '有 presence 的两条必须是 global 档（页面里的命令由登记决定，不看这个）',
    HOTKEY_COMMANDS.filter((command) => command.presence).every((command) => command.scope === 'global'),
    true,
  )
}

// 6) 一命令多组合：解析出「生效中」的组合与展示形态
{
  check(
    '生效组合丢掉认不出来的条目',
    resolveCombos(['Alt+Q', 'Hyper+Q'], 'decoy'),
    ['Alt+Q'],
  )
  check(
    '生效组合丢掉不符合作用域的条目（global 里混进单键）',
    resolveCombos(['Alt+Q', 'Q'], 'decoy'),
    ['Alt+Q'],
  )
  check('重复条目只留一个', resolveCombos(['Alt+Q', 'Alt+Q'], 'decoy'), ['Alt+Q'])
  check('没设置过（undefined）回落到空', resolveCombos(undefined, 'dim'), [])
  // 空数组 = 用户把键全删了，是合法状态，不许偷偷把默认值塞回去
  check('键全删了就是没有键（不回退默认）', resolveCombos([], 'dim'), [])
  check('focused 档的单键合法', resolveCombos(['S', 'Ctrl+Shift+S'], 'settings'), ['S', 'Ctrl+Shift+S'])
  check('上一页的默认键都是 focused 单键', resolveCombos(DEFAULT_HOTKEYS['prev-page'], 'prev-page'), ['ArrowUp', 'ArrowLeft', 'PageUp'])

  check('展示形态：方向键翻成箭头', comboDisplay('ArrowDown'), '↓')
  check('展示形态：Escape 写成 Esc', comboDisplay('Escape'), 'Esc')
  check('展示形态：修饰键和键一起翻', comboDisplay('Ctrl+Alt+ArrowLeft'), 'Ctrl+Alt+←')
  check('展示形态：普通键原样', comboDisplay('Ctrl+Shift+S'), 'Ctrl+Shift+S')
  check('展示形态：认不出的串原样奉还', comboDisplay('Hyper+Q'), 'Hyper+Q')

  // 章节跳转键与翻页键是物理键（ArrowLeft / PageUp），按 code 判定照样命中
  check('Ctrl+Alt+← 命中上一章', matchesCombo(keyEvent({ code: 'ArrowLeft', ctrl: true, alt: true }), 'Ctrl+Alt+ArrowLeft'), true)
  check('PageDown 命中下一页', matchesCombo(keyEvent({ code: 'PageDown', key: 'PageDown' }), 'PageDown'), true)
  check('空格命中下一页', matchesCombo(keyEvent({ code: 'Space', key: ' ' }), 'Space'), true)
}

if (problems.length === 0) {
  console.log(`快捷键验收通过（${checked} 项断言）`)
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const problem of problems) console.log(`  ✗ ${problem}`)
  process.exit(1)
}
