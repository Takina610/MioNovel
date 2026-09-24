/**
 * 办公外壳（五个形态）的验收。用法：bun run verify:apps
 *
 * 这一轮的代码分两层，验收也分两层：
 *
 * 1. **主题注册表**：五套应用 × 亮暗 = 10 套主题，每一套的 token 都得补全
 *    （缺一个值就是屏幕上某处没颜色），chrome 声明了 code / chat 的还必须带上
 *    那一层多出来的 token。形态和明暗的搭配也要齐：每个新形态都有亮色和暗色各一套。
 * 2. **正文形状**：块切分、聊天消息、表格行、幻灯片——都是纯函数（输入一段 HTML，
 *    输出一份数据），正是「不看屏幕就发现不了」的那一类。特别是**幻灯片**：
 *    一段文字被搬进标题、正文还是丢了，眼睛盯着屏幕看不出来，但「每一段都恰好
 *    出现一次」是可以逐份断言的——和 verify:decoy 里「行数要对齐」同一路数。
 *
 * 块切分要用 DOMParser，Bun 里没有，所以用 happy-dom 顶一个（和 verify:epub 一样）。
 */
import { Window } from 'happy-dom'

const testWindow = new Window({ url: 'http://localhost/' })
const globals = globalThis as unknown as Record<string, unknown>
globals.window = testWindow
globals.document = testWindow.document
globals.DOMParser = testWindow.DOMParser
globals.Node = testWindow.Node
globals.Element = testWindow.Element
globals.HTMLElement = testWindow.HTMLElement
globals.NodeFilter = testWindow.NodeFilter

const { chapterBlocks, looksLikeDialogue, prepareBody } = await import('../src/lib/blocks.ts')
const { chapterMessages, avatarInitial } = await import('../src/lib/chat.ts')
const { chapterRows, activeRowOf, rowsTotal } = await import('../src/lib/sheet.ts')
const { chapterSlides } = await import('../src/lib/slide.ts')
const { chapterFileName } = await import('../src/lib/code.ts')
const { fileNameFor, sectionNameOf, avatarOf, sheetNameOf } = await import('../src/lib/appdocs.ts')
const { getTheme, listThemes, buildThemeSheet, chromeOf } = await import('../src/themes/apply.ts')
const { CODE_TOKEN_VARS, CHAT_TOKEN_VARS, TOKEN_VARS } = await import('../src/themes/vars.ts')

let failures = 0
let checks = 0

function check(name: string, condition: boolean, detail = ''): void {
  checks++
  if (condition) console.log(`  \u2714 ${name}`)
  else {
    failures++
    console.log(`  \u2718 ${name}${detail ? `  ← ${detail}` : ''}`)
  }
}

/* ==========================================================================
   一、主题注册表
   ========================================================================== */

console.log('\n主题注册表')
{
  const themes = listThemes()
  const ids = themes.map((theme) => theme.id)
  check('id 不重复', new Set(ids).size === ids.length, ids.join(','))
  check('旧主题还在（日间 / 夜间 / 两套 VS Code）', ['day', 'night', 'vscode', 'vscode-light'].every((id) => ids.includes(id)))
  check('十套新主题都在', ['feishu', 'feishu-dark', 'wecom', 'wecom-dark', 'word', 'word-dark', 'excel', 'excel-dark', 'ppt', 'ppt-dark'].every((id) => ids.includes(id)))

  // 每个形态都要有亮有暗：只给一种的形态等于「这个主题只有半套」
  for (const chrome of ['doc', 'chat', 'page', 'sheet', 'slide']) {
    const list = themes.filter((theme) => chromeOf(theme) === chrome)
    check(
      `${chrome} 形态有亮色和暗色各一套`,
      list.some((t) => t.scheme === 'light') && list.some((t) => t.scheme === 'dark'),
      list.map((t) => t.id).join(','),
    )
  }

  const tokenKeys = Object.keys(TOKEN_VARS)
  const codeKeys = Object.keys(CODE_TOKEN_VARS)
  const chatKeys = Object.keys(CHAT_TOKEN_VARS)

  let missingTokens = 0
  let emptyTokens = 0
  let badChromeTokens = 0
  let badPreset = 0
  for (const theme of themes) {
    for (const key of tokenKeys) {
      const value = (theme.tokens as unknown as Record<string, string>)[key]
      if (value === undefined) missingTokens++
      else if (!String(value).trim()) emptyTokens++
    }
    if (theme.chrome === 'code' && !theme.code) badChromeTokens++
    if (theme.code) {
      for (const key of codeKeys) {
        if (!theme.code[key as keyof typeof theme.code]) badChromeTokens++
      }
    }
    if (theme.chrome === 'chat' && !theme.chat) badChromeTokens++
    if (theme.chat) {
      for (const key of chatKeys) {
        if (!theme.chat[key as keyof typeof theme.chat]) badChromeTokens++
      }
    }
    if (theme.preset) {
      const { fontSize, lineHeight, contentWidth, indent, paragraphGap } = theme.preset
      if (fontSize !== undefined && (fontSize < 10 || fontSize > 40)) badPreset++
      if (lineHeight !== undefined && (lineHeight < 1 || lineHeight > 3)) badPreset++
      if (contentWidth !== undefined && (contentWidth < 20 || contentWidth > 80)) badPreset++
      if (indent !== undefined && (indent < 0 || indent > 8)) badPreset++
      if (paragraphGap !== undefined && (paragraphGap < 0 || paragraphGap > 3)) badPreset++
    }
  }
  check('每套主题的 18 个主 token 一个不缺', missingTokens === 0, `缺 ${missingTokens} 个`)
  check('没有空值 token', emptyTokens === 0, `空 ${emptyTokens} 个`)
  check('声明了 code / chat 的主题把那一层的 token 也补全了', badChromeTokens === 0, `缺 ${badChromeTokens} 个`)
  check('每套主题自带的排版参数都在合理范围内', badPreset === 0, `越界 ${badPreset} 个`)

  const sheet = buildThemeSheet()
  check('样式表里每套主题都有一段', themes.every((theme) => sheet.includes(`:root[data-theme='${theme.id}']`)))
  check('样式表里写了 color-scheme（原生控件跟着明暗走）', sheet.includes('color-scheme: dark') && sheet.includes('color-scheme: light'))
  check('未知 id 回落到第一个内置主题', getTheme('不存在的主题').id === themes[0].id)
  check('聊天主题的 rail / bubble 进了样式表', sheet.includes('--mn-chat-rail') && sheet.includes('--mn-chat-bubble'))
}

/* ==========================================================================
   二、块切分（所有形态的共同起点）
   ========================================================================== */

const CHAPTER_HTML = `
<h2 class="mn-chapter-title">第3章 少年与灯</h2>
<p class="mn-blank"></p>
<p>他合上书，听见更夫的梆子声。</p>
<p class="mn-blank"></p>
<p>「走吧。」</p>
<p>她说：「我走了。」然后就离开了这间屋子，再也没有回来过。</p>
<h3>三、灯</h3>
<p>灯芯爆了一下，<ruby>少年<rt>shào nián</rt></ruby>没有回头。这是第 12 件事。</p>
<figure><img src="mnres://OEBPS/Images/pic.png" alt="插图"><figcaption>插图说明</figcaption></figure>
<p data-mn-lang="alt">少年は振り返らなかった。</p>
<blockquote>引文一段</blockquote>
`

console.log('\n块切分')
{
  const blocks = chapterBlocks(CHAPTER_HTML, { media: 'keep' })
  check('空行也切成块（编辑器要靠它占一行）', blocks.some((b) => b.text === ''))
  check('章标题认成标题块', blocks[0].kind === 'keyword' && blocks[0].level === 2, blocks[0].kind)
  check('嵌在里面的 h3 也是标题块', blocks.some((b) => b.level === 3))
  check('对话段靠引号认出来', blocks.some((b) => b.kind === 'string'), blocks.map((b) => b.kind).join(','))
  check('图注是注释块', blocks.some((b) => b.kind === 'comment' && b.text === '插图说明'))
  check('双语书的次要语言段被标记', blocks.some((b) => b.alt && b.text.startsWith('少年は')))
  check('<figure> 被拆开：图自己占一块、图注自己占一块', blocks.some((b) => b.kind === 'image') && blocks.some((b) => b.text === '插图说明'))
  check(
    '图片块里留的是 <img>（文档 / 幻灯片 / 聊天要显示图）',
    blocks.find((b) => b.kind === 'image')?.html.includes('<img') === true,
  )
  check(
    '字数是「去掉空白之后的文字长度」（标签不算）',
    blocks.every((block) => block.chars === Math.max(1, block.text.replace(/\s+/g, '').length)),
    blocks.map((b) => `${b.text.slice(0, 4)}:${b.chars}`).join(' '),
  )
  check(
    '注音（ruby）里的字算文字、标签不算',
    blocks.find((b) => b.text.startsWith('灯芯爆了'))?.text.includes('shào nián') === true,
  )

  const refBlocks = chapterBlocks(CHAPTER_HTML, { media: 'reference' })
  check(
    '表格 / 编辑器模式下图片变成一行引用',
    refBlocks.some((b) => b.kind === 'image' && b.text === '![插图](./OEBPS/Images/pic.png)'),
    refBlocks.find((b) => b.kind === 'image')?.text,
  )

  check(
    '引号占一半以上才算对话',
    looksLikeDialogue('「走吧。」') &&
      !looksLikeDialogue('他说：「我走了。」然后就离开了这间屋子，再也没有回来过。'),
  )
  const { elements } = prepareBody('<div><p>甲</p><p>乙</p></div>')
  check('外层 div 不算一块（最里层才是）', elements.length === 2 && elements[0].textContent === '甲')
}

/* ==========================================================================
   三、聊天：一段 = 一条消息
   ========================================================================== */

console.log('\n聊天（企业微信）')
{
  const blocks = chapterBlocks(CHAPTER_HTML)
  const messages = chapterMessages(blocks, '第3章 少年与灯')
  check('空行不变成空气泡', messages.every((m) => m.text !== '' || m.kind === 'image'), JSON.stringify(messages.map((m) => m.text.slice(0, 6))))
  check('开头的章标题不再重复出现', !messages.some((m) => m.divider && m.text === '第3章 少年与灯'))
  check('章内的小标题当分隔线', messages.some((m) => m.divider && m.text === '三、灯'))
  check('图片消息带得动内容', messages.some((m) => m.kind === 'image' && m.html.includes('<img')))
  check('次要语言段保留标记（双语模式要用）', messages.some((m) => m.alt))
  check('消息顺序和正文一致', messages[0].text.startsWith('他合上书'))
  check('头像取名字首字', avatarInitial('猫') === '猫' && avatarInitial('Cat') === 'C' && avatarInitial('  ') === '友')
}

/* ==========================================================================
   四、表格：一段 = 一行
   ========================================================================== */

console.log('\n表格（Excel）')
{
  const rows = chapterRows(chapterBlocks(CHAPTER_HTML, { media: 'reference' }), '第3章 少年与灯')
  check('正文从第 3 行开始（1 是章标题行、2 是字段名行）', rows[0].row === 3 && rows[0].address === 'A3', rows[0]?.address)
  check('空行不占行', rows.every((row) => row.text !== ''))
  check('开头的章标题不再占一行', !rows.some((row) => row.text === '第3章 少年与灯'))
  check('类型列给得出中文标签', rows.some((row) => row.kindLabel === '对话') && rows.some((row) => row.kindLabel === '标题'))
  check('字数逐行给得出', rows[0].chars > 0)
  check('求和等于各行之和', rowsTotal(rows) === rows.reduce((sum, row) => sum + row.chars, 0))
  check('当前行按章内比例换算（头尾都夹住）', activeRowOf(rows, 0) === rows[0].row && activeRowOf(rows, 1) === rows[rows.length - 1].row)
  check('工作表名截到 31 字以内', sheetNameOf('很长的章节名'.repeat(8), 0).length <= 31)
  check('工作表名去掉 Excel 不认的字符', !/[:\\/?*[\]]/.test(sheetNameOf('第1章：出发/归来', 0)))
}

/* ==========================================================================
   五、幻灯片：一段（或几段）= 一张
   ========================================================================== */

console.log('\n幻灯片（PPT）')
{
  for (const count of [3, 8, 20]) {
    const html = Array.from({ length: count }, (_, index) => `<p>第 ${index + 1} 段正文，用来把预算填满。</p>`).join('')
    const slides = chapterSlides(chapterBlocks(html), { title: '第一章', subtitle: '样例书 · 作者' })
    const texts = blocksOf(slides)
    check(`${count} 段的章能切出幻灯片`, slides.length >= 2, `${slides.length} 张`)
    check(`${count} 段：第一张是标题页`, slides[0].cover && slides[0].title === '第一章')
    check(`${count} 段：没有空张（每张都有正文）`, slides.every((slide) => slide.body.length > 0), slides.map((s) => s.body.length).join(','))
    check(
      `${count} 段：每一段恰好出现一次（没丢也没重复）`,
      sameMultiset(texts, Array.from({ length: count }, (_, index) => `第 ${index + 1} 段正文，用来把预算填满。`)),
    )
    check(`${count} 段：每张的字数不超过预算`, slides.every((slide) => slide.body.reduce((sum, part) => sum + part.text.length, 0) <= 220))
    check(`${count} 段：备注写的是这一张上的字`, slides.every((slide) => slide.notes.includes(slide.title)))
  }

  const slides = chapterSlides(chapterBlocks(CHAPTER_HTML), { title: '第3章 少年与灯' })
  check('章标题不重复进幻灯片（标题页上就是它）', !blocksOf(slides).includes('第3章 少年与灯'))
  check('章内标题自己起一张', slides.some((slide) => slide.title === '三、灯'))
  check('图片段落留在正文里', slides.some((slide) => slide.body.some((part) => part.kind === 'image')))
  check('图片没被拆成两段（figure 已拆）', !blocksOf(slides).some((text) => text.includes('插图说明') && text.includes('少年')))
}

/**
 * 一叠幻灯片里「正文那一半」的全部文字：标题 + 正文，**不算标题页**
 * （标题页上的副标题是书名，不是正文里的一段）。
 */
function blocksOf(slides: Array<{ title: string; body: Array<{ text: string }>; cover: boolean }>): string[] {
  const texts: string[] = []
  for (const slide of slides) {
    if (slide.cover) continue
    texts.push(slide.title)
    for (const part of slide.body) texts.push(part.text)
  }
  return texts
}

function sameMultiset(a: string[], b: string[]): boolean {
  const count = (list: string[]): Map<string, number> => {
    const map = new Map<string, number>()
    for (const item of list) map.set(item, (map.get(item) ?? 0) + 1)
    return map
  }
  const left = count(a)
  const right = count(b)
  if (left.size !== right.size) return false
  for (const [key, value] of right) if (left.get(key) !== value) return false
  return true
}

/* ==========================================================================
   六、文件与名字（标题栏、标签、状态栏上看到的那些）
   ========================================================================== */

console.log('\n文件名与标题')
{
  check('Word 文件名带 .docx', fileNameFor('page', '夜色温柔') === '夜色温柔.docx')
  check('Excel 文件名带 .xlsx', fileNameFor('sheet', '夜色温柔') === '夜色温柔.xlsx')
  check('PPT 文件名带 .pptx', fileNameFor('slide', '夜色温柔') === '夜色温柔.pptx')
  check('文件名去掉路径字符', !/[\\/:*?"<>|]/.test(fileNameFor('page', 'a/b:c*d?')))
  check('空书名有兜底', fileNameFor('sheet', '   ').includes('未命名'))
  check('节名有长度上限', sectionNameOf('很长'.repeat(30), 0).length <= 40)
  check('头像取作者首字，没作者写「我」', avatarOf('张三') === '张' && avatarOf('  ') === '我')
  check('编辑器形态的文件名照旧（一章一个 .md）', chapterFileName('第3章 少年与灯', 2) === '第3章 少年与灯.md')
}

/* ========================================================================== */

console.log(`\n${failures === 0 ? '全部通过' : '有失败项'}（${checks} 项断言，${failures} 项失败）`)
if (failures > 0) process.exit(1)
