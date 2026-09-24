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
import { readFileSync, readdirSync } from 'node:fs'
import { Window } from 'happy-dom'
import type { BookRecord } from '../src/db/db'

const testWindow = new Window({ url: 'http://localhost/' })
const globals = globalThis as unknown as Record<string, unknown>
globals.window = testWindow
globals.document = testWindow.document
globals.DOMParser = testWindow.DOMParser
globals.Node = testWindow.Node
globals.Element = testWindow.Element
globals.HTMLElement = testWindow.HTMLElement
globals.NodeFilter = testWindow.NodeFilter

const { chapterBlocks, looksLikeDialogue, prepareBody, mediaLinesHtml, mediaModeFor } = await import('../src/lib/blocks.ts')
const { chapterMessages, avatarInitial, chatSender, messageSender, CHAT_ME, CHAT_RAIL, sessionTag, sessionUnread } = await import('../src/lib/chat.ts')
const { chapterRows, activeRowOf, rowsTotal, SHEET_COLUMNS, SHEET_HEAD } = await import('../src/lib/sheet.ts')
const { chapterSlides, slideBudget } = await import('../src/lib/slide.ts')
const { chapterFileName } = await import('../src/lib/code.ts')
const { fileNameFor, sectionNameOf, avatarOf, sheetNameOf, readStateOf, docTimeText, homeRows, pinnedBook, docOwnerOf, DOC_TABS, DOC_FILTERS, WORD_TABS, WORD_STYLES, WORD_HOME_TABS, WORD_NAV_TABS, wordHomeRows, wordDateText, EXCEL_TABS, EXCEL_HOME_TABS, excelHomeRows, greetingText, PPT_TABS, PPT_HOME_TABS, PPT_TEMPLATES, pptHomeRows, slideStatusText } = await import('../src/lib/appdocs.ts')
const { markFinds, clearFinds, countFinds, FIND_MARK } = await import('../src/lib/find.ts')
const { getTheme, listThemes, buildThemeSheet, chromeOf } = await import('../src/themes/apply.ts')
const { CODE_TOKEN_VARS, CHAT_TOKEN_VARS, PAGE_TOKEN_VARS, SHEET_TOKEN_VARS, SLIDE_TOKEN_VARS, TOKEN_VARS } = await import('../src/themes/vars.ts')

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
  const pageKeys = Object.keys(PAGE_TOKEN_VARS)
  const chatKeys = Object.keys(CHAT_TOKEN_VARS)
  const sheetKeys = Object.keys(SHEET_TOKEN_VARS)
  const slideKeys = Object.keys(SLIDE_TOKEN_VARS)

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
    if (theme.chrome === 'page' && !theme.page) badChromeTokens++
    if (theme.page) {
      for (const key of pageKeys) {
        if (!theme.page[key as keyof typeof theme.page]) badChromeTokens++
      }
    }
    if (theme.chrome === 'sheet' && !theme.sheet) badChromeTokens++
    if (theme.sheet) {
      for (const key of sheetKeys) {
        if (!theme.sheet[key as keyof typeof theme.sheet]) badChromeTokens++
      }
    }
    if (theme.chrome === 'slide' && !theme.slide) badChromeTokens++
    if (theme.slide) {
      for (const key of slideKeys) {
        if (!theme.slide[key as keyof typeof theme.slide]) badChromeTokens++
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
  check('声明了 code / chat / page / sheet / slide 的主题把那一层的 token 也补全了', badChromeTokens === 0, `缺 ${badChromeTokens} 个`)
  check('每套主题自带的排版参数都在合理范围内', badPreset === 0, `越界 ${badPreset} 个`)

  const sheet = buildThemeSheet()
  check('样式表里每套主题都有一段', themes.every((theme) => sheet.includes(`:root[data-theme='${theme.id}']`)))
  check('样式表里写了 color-scheme（原生控件跟着明暗走）', sheet.includes('color-scheme: dark') && sheet.includes('color-scheme: light'))
  check('未知 id 回落到第一个内置主题', getTheme('不存在的主题').id === themes[0].id)
  check('聊天主题的 rail / bubble 进了样式表', sheet.includes('--mn-chat-rail') && sheet.includes('--mn-chat-bubble'))
  check('表格主题的网格 / 选中框进了样式表', sheet.includes('--mn-sheet-grid') && sheet.includes('--mn-sheet-select'))
  check(
    '演示文稿主题的工作区 / 选中橙进了样式表',
    sheet.includes('--mn-ppt-canvas') && sheet.includes('--mn-ppt-select'),
  )
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
    'keep 模式下图片块里留的是 <img>（页面 / 幻灯片放图）',
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

  // 飞书形态（chrome: 'doc'）也不显示图：整章图片换成一行引用，和编辑器形态同一条约定
  const docHtml = mediaLinesHtml(CHAPTER_HTML, () => 'OEBPS/Images/pic.png')
  check('飞书形态的正文里没有 <img> / <svg> 了', !/<img|<svg/i.test(docHtml))
  const mediaAt = docHtml.indexOf('![')
  check(
    '图片写成一行引用，路径是书里的原始路径',
    docHtml.includes('![插图](./OEBPS/Images/pic.png)'),
    mediaAt >= 0 ? docHtml.slice(mediaAt, mediaAt + 40) : '(没有引用行)',
  )
  check('图注还留着（拆 figure 之后它自己一行）', docHtml.includes('插图说明'))
  check(
    '标题、对话、双语段、引文一个都没丢',
    ['第3章 少年与灯', '他合上书', '少年は振り返らなかった', '引文一段'].every((piece) => docHtml.includes(piece)),
  )
  check('空 HTML 不会被弄坏', mediaLinesHtml('') === '')
}

/* ==========================================================================
   三、聊天：一段 = 一条消息
   ========================================================================== */

console.log('\n聊天（企业微信）')
{
  const blocks = chapterBlocks(CHAPTER_HTML)
  const messages = chapterMessages(blocks, '第3章 少年与灯')
  check('空行不变成空气泡', messages.every((m) => m.text !== '' || m.kind === 'image'), JSON.stringify(messages.map((m) => m.text.slice(0, 6))))
  check('发信人写书里的作者，没作者才写「书友」', chatSender('川端康成') === '川端康成' && chatSender('  ') === '书友' && chatSender(undefined) === '书友')

  // 聊天形态（chrome: 'chat'）也不显示图：整章图片换成一行引用，和编辑器、飞书同一条约定。
  // 三条断言和飞书那三条一一对应——「替换」最容易顺手吃掉东西，所以原文一个字都不能少
  const chatRef = chapterMessages(chapterBlocks(CHAPTER_HTML, { media: 'reference' }), '第3章 少年与灯')
  check('聊天形态的消息里没有 <img> / <svg> 了', !chatRef.some((m) => /<img|<svg/i.test(m.html)))
  check(
    '图片写成一条引用消息，路径是书里的原始路径',
    chatRef.some((m) => m.text === '![插图](./OEBPS/Images/pic.png)'),
    chatRef.find((m) => m.text.startsWith('!['))?.text,
  )
  check(
    '标题、对话、双语段、引文一个都没丢',
    ['他合上书', '少年は振り返らなかった', '引文一段'].every((piece) => chatRef.some((m) => m.text.includes(piece))) &&
      chatRef.some((m) => m.divider && m.text === '三、灯'),
  )
  check('开头的章标题不再重复出现', !messages.some((m) => m.divider && m.text === '第3章 少年与灯'))
  check('章内的小标题当分隔线', messages.some((m) => m.divider && m.text === '三、灯'))
  check('给它的图片块原样带过来（chapterMessages 自己不动 html）', messages.some((m) => m.kind === 'image' && m.html.includes('<img')))
  check('次要语言段保留标记（双语模式要用）', messages.some((m) => m.alt))
  check('消息顺序和正文一致', messages[0].text.startsWith('他合上书'))
  // 双语书的原文段当「我发的消息」：发信人写「我」，其余写书的作者。
  // 「哪几行算我发的」不看屏幕发现不了（少写一行、多写一行都只是看着不对），所以断言它
  const altMessages = chatRef.filter((m) => m.alt)
  check('有次要语言段可供断言（样例里那一行日文）', altMessages.length > 0)
  check(
    '原文段写「我」，其余写作者',
    altMessages.every((m) => messageSender(m, '川端康成') === CHAT_ME) &&
      chatRef.filter((m) => !m.alt).every((m) => messageSender(m, '川端康成') === '川端康成'),
  )
  check('头像取名字首字', avatarInitial('猫') === '猫' && avatarInitial('Cat') === 'C' && avatarInitial('  ') === '友')

  // 功能栏那 13 格：顺序、哪几格是真的、灰着的有没有说清为什么。
  // 这几件事对着屏幕扫一眼都未必看得出来（少一格、某一格悄悄变成能点的），
  // 但它们是「这个外壳诚不诚实」的全部依据，所以逐条断言。
  check('功能栏 13 格，顺序照桌面版企业微信', CHAT_RAIL.length === 13 && CHAT_RAIL.map((item) => item.label).join(' ') === '消息 邮件 文档 日程 待办 会议 智能文档 智能总结 工作台 通讯录 微盘 高级功能 分组')
  const real = CHAT_RAIL.filter((item) => item.view)
  check('真的只有 4 格（消息 / 日程 / 通讯录 / 微盘）', real.length === 4 && real.map((item) => item.view).join(',') === 'msg,schedule,contacts,drive')
  check(
    '真的那 4 格站在企业微信的位置上（0 / 3 / 9 / 10）',
    CHAT_RAIL.findIndex((item) => item.view === 'msg') === 0 &&
      CHAT_RAIL.findIndex((item) => item.view === 'schedule') === 3 &&
      CHAT_RAIL.findIndex((item) => item.view === 'contacts') === 9 &&
      CHAT_RAIL.findIndex((item) => item.view === 'drive') === 10,
  )
  check(
    '其余 9 格全是灰的，而且每一格都说清了为什么',
    CHAT_RAIL.filter((item) => !item.view).length === 9 &&
      CHAT_RAIL.every((item) => (item.view ? !item.why : !!item.why)),
  )

  /** 四章、共 1000 字的假会话：标签和角标都只看进度，不看正文 */
  const chatBook = (over: Partial<BookRecord>): BookRecord => ({
    id: 'c',
    state: 'ready',
    title: '会话',
    author: '',
    format: 'txt',
    addedAt: 0,
    lastReadAt: 0,
    totalChars: 1000,
    chapterCount: 4,
    charOffsets: [],
    groups: [],
    progress: null,
    fileName: 'a.txt',
    fileSize: 1,
    signature: 's',
    ...over,
  })
  check('会话标签：正开着的那本写「在读」', sessionTag(chatBook({ progress: { chapterIndex: 1, ratio: 0.5, updatedAt: 0 } }), 'c') === '在读')
  check('会话标签：正开着但已经读完的那本写「已读完」（读完了更准）', sessionTag(chatBook({ progress: { chapterIndex: 3, ratio: 1, updatedAt: 0 } }), 'c') === '已读完')
  check('会话标签：读完了写「已读完」', sessionTag(chatBook({ id: 'y', progress: { chapterIndex: 3, ratio: 1, updatedAt: 0 } })) === '已读完')
  check('会话标签：没打开过的不写标签（不编一个「未读」出来）', sessionTag(chatBook({ id: 'z', progress: null })) === '')
  check('会话标签：导入中 / 解析失败的也不写', sessionTag(chatBook({ id: 'i', state: 'importing' })) === '' && sessionTag(chatBook({ id: 'e', state: 'error' })) === '')
  check('角标：没读过的等于总章数', sessionUnread(chatBook({ progress: null })) === 4)
  check('角标：读掉两章就少两个', sessionUnread(chatBook({ progress: { chapterIndex: 1, ratio: 0.5, updatedAt: 0 } })) === 2)
  check('角标：读完了不显示角标', sessionUnread(chatBook({ progress: { chapterIndex: 3, ratio: 1, updatedAt: 0 } })) === 0)
  check('角标：还没解析出来的不显示（章数还不算数）', sessionUnread(chatBook({ state: 'importing' })) === 0)
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
  // 列标题（A / B / C）与字段名（正文 / 字数 / 类型）必须一一对上：分开写两边就会
  // 各说各话，而屏幕上只看得到「A」底下那一列写着什么
  check(
    '三列的字母是 A / B / C，和字段名一一对应（正文在 A 列）',
    SHEET_COLUMNS.length === SHEET_HEAD.length &&
      SHEET_COLUMNS.join('') === 'ABC' &&
      rows.every((row) => row.address.startsWith(SHEET_COLUMNS[0])),
    SHEET_COLUMNS.join(','),
  )
}

/* ==========================================================================
   四之二、Excel 的页签、开始屏幕与问候语
   --------------------------------------------------------------------------
   和 Word 那一套同一个道理：页签的顺序、哪几页是真的、开始屏幕上哪一栏是空的、
   问候语按什么钟点换——对着屏幕扫一眼看不出对错，但它们是「这个外壳诚不诚实」
   的全部依据，所以逐条断言。
   ========================================================================== */

console.log('\nExcel 的页签与开始屏幕')
{
  // 三本书：一本中文、一本日文（原文件名是罗马字）、一本没有作者的书。
  // 时间用固定值——「按最近读的排」这条规则要能一眼看出来对不对
  const DAY = 86_400_000
  const now = new Date(2026, 8, 24, 15, 0).getTime()
  const shelf = [
    { id: 'yuki', title: '雪国', author: '川端康成', fileName: 'yuki.txt', addedAt: now - 10 * DAY, lastReadAt: now - DAY },
    { id: 'xue', title: '雪落香杉树', author: '大卫·伽特森', fileName: 'xue.txt', addedAt: now - 3 * DAY, lastReadAt: 0 },
    { id: 'empty', title: '无名之书', author: '', fileName: '无名.txt', addedAt: now - 20 * DAY, lastReadAt: now - 2 * DAY },
  ] as never as BookRecord[]

  check(
    '页签的顺序照截图（开始 / OfficePLUS / 插入 / 绘图 / 页面布局 / 公式 / 数据 / 审阅 / 视图 / PDF工具箱 / 帮助）',
    EXCEL_TABS.map((tab) => tab.label).join(' ') ===
      '开始 OfficePLUS 插入 绘图 页面布局 公式 数据 审阅 视图 PDF工具箱 帮助',
    EXCEL_TABS.map((tab) => tab.label).join(' '),
  )
  check(
    '只有「开始」和「视图」两页是真的，其余九页灰着',
    EXCEL_TABS.filter((tab) => !tab.disabled).map((tab) => tab.id).join(',') === 'home,view',
    EXCEL_TABS.filter((tab) => !tab.disabled).map((tab) => tab.id).join(','),
  )
  check('「文件」不在页签表里（由 OfficeFrame 单独画）', !EXCEL_TABS.some((tab) => tab.label === '文件'))

  check(
    '开始屏幕三栏是 最近 / 收藏夹 / 与我共享',
    EXCEL_HOME_TABS.map((tab) => tab.label).join(' ') === '最近 收藏夹 与我共享',
    EXCEL_HOME_TABS.map((tab) => tab.label).join(' '),
  )
  check(
    '「收藏夹」「与我共享」老实空着（本地文件没有收藏与共享）',
    excelHomeRows(shelf, { tab: 'starred' }).length === 0 &&
      excelHomeRows(shelf, { tab: 'shared' }).length === 0 &&
      EXCEL_HOME_TABS.every((tab) => tab.empty.length > 0),
  )
  check(
    '「最近」与 Word 那一屏是同一份规则（同一批数据排出来一模一样）',
    excelHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(',') ===
      wordHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(','),
    excelHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(','),
  )
  {
    const all = excelHomeRows(shelf, { tab: 'recent' })
    const found = excelHomeRows(shelf, { tab: 'recent', query: '雪' })
    check(
      '搜到的那几本仍然按最近读的排（搜索不打乱顺序）',
      found.length > 0 && found.every((book) => all.includes(book)),
    )
    check(
      '搜索按书名、作者、原文件名三样匹配',
      excelHomeRows(shelf, { tab: 'recent', query: '雪' }).length === 2 &&
        excelHomeRows(shelf, { tab: 'recent', query: '川端' }).length === 1 &&
        excelHomeRows(shelf, { tab: 'recent', query: 'yuki' }).length === 1 &&
        excelHomeRows(shelf, { tab: 'recent', query: '不存在的书' }).length === 0,
      '雪 2 / 川端 1 / yuki 1 / 无 0',
    )
  }

  // 问候语读的是这台设备现在的钟点（不是编的）。四个分界都要对得住
  const at = (hour: number) => greetingText(new Date(2026, 8, 24, hour, 30).getTime())
  check(
    '问候语按钟点换（0-4 晚上好 / 5-11 早上好 / 12-17 下午好 / 18-23 晚上好）',
    at(3) === '晚上好' &&
      at(5) === '早上好' &&
      at(11) === '早上好' &&
      at(12) === '下午好' &&
      at(17) === '下午好' &&
      at(18) === '晚上好' &&
      at(23) === '晚上好',
    [3, 5, 12, 18].map(at).join(','),
  )
}

/* ==========================================================================
   四之二、PPT 的页签、模板与开始屏幕（2026-09-24 按截图复刻）
   --------------------------------------------------------------------------
   和 Word / Excel 那两节同一个道理：页签的顺序、哪几页是真的、开始屏幕上那一排
   模板有几张哪一张点得动、状态栏那行字怎么写——对着屏幕扫一眼看不出对错
   （少一页、某一页悄悄变成能点的、模板卡顺序换了、状态栏写成「第 1/1 张」），
   但它们是「这个外壳诚不诚实」的全部依据，所以逐条断言。
   ========================================================================== */

console.log('\nPPT 的页签、模板与开始屏幕')
{
  // 三本书的样本和上面 Excel 那一节是同几本（同一批数据，看的就是两份规则一致）
  const DAY = 86_400_000
  const now = new Date(2026, 8, 24, 15, 0).getTime()
  const shelf = [
    { id: 'yuki', title: '雪国', author: '川端康成', fileName: 'yuki.txt', addedAt: now - 10 * DAY, lastReadAt: now - DAY },
    { id: 'xue', title: '雪落香杉树', author: '大卫·伽特森', fileName: 'xue.txt', addedAt: now - 3 * DAY, lastReadAt: 0 },
    { id: 'empty', title: '无名之书', author: '', fileName: '无名.txt', addedAt: now - 20 * DAY, lastReadAt: now - 2 * DAY },
  ] as never as BookRecord[]

  check(
    '页签的顺序照截图（开始 / OfficePLUS / 插入 / 绘图 / 设计 / 切换 / 动画 / 幻灯片放映 / 记录 / 审阅 / 视图 / PDF工具箱 / 帮助）',
    PPT_TABS.map((tab) => tab.label).join(' ') ===
      '开始 OfficePLUS 插入 绘图 设计 切换 动画 幻灯片放映 记录 审阅 视图 PDF工具箱 帮助',
    PPT_TABS.map((tab) => tab.label).join(' '),
  )
  check(
    '只有「开始」和「视图」两页是真的，其余十一页灰着',
    PPT_TABS.filter((tab) => !tab.disabled).map((tab) => tab.id).join(',') === 'home,view',
    PPT_TABS.filter((tab) => !tab.disabled).map((tab) => tab.id).join(','),
  )
  check('「文件」不在页签表里（由 OfficeFrame 单独画）', !PPT_TABS.some((tab) => tab.label === '文件'))

  check(
    '开始屏幕三栏是 最近 / 收藏夹 / 与我共享',
    PPT_HOME_TABS.map((tab) => tab.label).join(' ') === '最近 收藏夹 与我共享',
    PPT_HOME_TABS.map((tab) => tab.label).join(' '),
  )
  check(
    '模板卡八张、顺序照截图',
    PPT_TEMPLATES.map((item) => item.label).join(' ') ===
      '空白演示文稿 欢迎使用 PowerPoint 麦迪逊 地图集 花园锦簇 城市单色 亚洲设计演示文稿 朴实灵感',
    PPT_TEMPLATES.map((item) => item.label).join(' '),
  )
  check(
    '只有「空白演示文稿」是真的（它就是导入一本本地书），其余七张是 PowerPoint 的内置模板、都灰着',
    PPT_TEMPLATES.filter((item) => item.blank).map((item) => item.id).join(',') === 'blank' &&
      PPT_TEMPLATES.filter((item) => !item.blank).every((item) => item.art.title.length > 0),
    PPT_TEMPLATES.filter((item) => item.blank).map((item) => item.id).join(','),
  )
  check(
    '「收藏夹」「与我共享」老实空着（本地文件没有收藏与共享）',
    pptHomeRows(shelf, { tab: 'starred' }).length === 0 &&
      pptHomeRows(shelf, { tab: 'shared' }).length === 0 &&
      PPT_HOME_TABS.every((tab) => tab.empty.length > 0),
  )
  check(
    '「最近」与 Word / Excel 的开始屏幕是同一份规则（同一批数据排出来一模一样）',
    pptHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(',') ===
      excelHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(','),
    pptHomeRows(shelf, { tab: 'recent' }).map((book) => book.title).join(','),
  )
  check(
    '搜索按书名、作者、原文件名三样匹配',
    pptHomeRows(shelf, { tab: 'recent', query: '雪' }).length === 2 &&
      pptHomeRows(shelf, { tab: 'recent', query: 'yuki' }).length === 1 &&
      pptHomeRows(shelf, { tab: 'recent', query: '不存在的书' }).length === 0,
    '雪 2 / yuki 1 / 无 0',
  )
  check(
    '状态栏第一格写「幻灯片 第 3 张，共 12 张」（截图里就是这么写的）',
    slideStatusText(3, 12) === '幻灯片 第 3 张，共 12 张',
    slideStatusText(3, 12),
  )
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
// 一张装多少字跟着字号走：字号越大装得越少，否则版心会把多出来的字裁掉
// ——在阅读器里那就是「正文少了一段」（编辑视图里一「页」就是一张 16:9 的幻灯片）
{
  const small = slideBudget(12)
  const normal = slideBudget(18)
  const large = slideBudget(34)
  check(
    '字号正常时预算仍是 220（不该因为这条多切张）',
    normal.maxChars === 220 && normal.maxParts === 5,
    `${normal.maxChars}/${normal.maxParts}`,
  )
  check(
    '字号越大，一张装得越少（120000 ÷ 字号² 那个估算）',
    small.maxChars === 220 && large.maxChars === 104 && large.maxChars < normal.maxChars,
    `12px→${small.maxChars} 18px→${normal.maxChars} 34px→${large.maxChars}`,
  )
  check(
    '再大的字也保底 80 字一张（不然一页只剩一句话）',
    slideBudget(60).maxChars === 80 && slideBudget(200).maxChars === 80,
    `${slideBudget(60).maxChars}`,
  )
  // 预算真的管用：把一章按大字号切出来，每张的正文都不超过那个数
  const dense = chapterBlocks(
    Array.from({ length: 12 }, (_, i) => `<p>${'灯'.repeat(200)}${i}</p>`).join(''),
  )
  const loose = chapterSlides(dense, { title: '第一章', ...slideBudget(12) })
  const tight = chapterSlides(dense, { title: '第一章', ...slideBudget(34) })
  const longest = Math.max(...dense.map((block) => block.text.length))
  check(
    '预算真的在管：同一章按大字号切出来的张数更多',
    tight.length > loose.length,
    `${loose.length} → ${tight.length} 张`,
  )
  check(
    '每一张的正文都在预算之内（最多超出一整块——一块是不可切的最小单位）',
    tight.every(
      (slide) =>
        slide.body.reduce((sum, part) => sum + part.text.length, 0) <= slideBudget(34).maxChars + longest,
    ),
    tight.map((s) => s.body.reduce((sum, p) => sum + p.text.length, 0)).join(','),
  )

  // 标题那一条：短的当标题、长的进正文。理由是版心——标题框里那行字 3.2em，
  // 一段长正文塞进去尾巴会被裁掉（在阅读器里就是正文少了几个字）
  {
    const short = chapterSlides(chapterBlocks('<p>一个短段落</p><p>又一段</p>'), { title: '第一章' })
    check(
      '短段落当标题（标题就是它，正文里不再重复一遍）',
      short.some(
        (slide) =>
          slide.title === '一个短段落' && !slide.body.some((part) => part.text === '一个短段落'),
      ),
      short.map((s) => `${s.title}/${s.body.length}`).join(','),
    )
    const long = '长'.repeat(120)
    const longDeck = chapterSlides(chapterBlocks(`<p>${long}</p><p>后面一段</p>`), { title: '第一章' })
    const target = longDeck.find((slide) => slide.body.some((part) => part.text === long))
    check(
      '长段落不当标题（标题留空、整段进正文，版心裁不掉它的尾巴）',
      Boolean(target) && target?.title === '',
      longDeck.map((s) => `${s.title.slice(0, 4)}/${s.body.length}`).join(','),
    )
    check(
      '长段落进了正文之后，一个字都没少',
      longDeck.reduce((sum, slide) => sum + slide.body.reduce((n, part) => n + part.text.length, 0), 0) >= 120,
      String(longDeck.reduce((sum, slide) => sum + slide.body.reduce((n, part) => n + part.text.length, 0), 0)),
    )
  }
}

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

/* ==========================================================================
   六、云文档首页：页签、筛选、排序、那一列时间（飞书形态的书架）
   ========================================================================== */

console.log('\n云文档首页（飞书）')
{
  const DAY = 86_400_000
  const now = new Date(2026, 8, 24, 15, 0, 0).getTime() // 2026-09-24 15:00
  /** 四章、共 1000 字的假书：进度一算就知道该落在哪一档 */
  const book = (over: Partial<BookRecord>): BookRecord => ({
    id: 'b',
    state: 'ready',
    title: '未命名',
    author: '',
    format: 'txt',
    addedAt: now,
    lastReadAt: now,
    totalChars: 1000,
    chapterCount: 4,
    charOffsets: [0, 250, 500, 750, 1000],
    groups: [],
    progress: null,
    fileName: 'x.txt',
    fileSize: 1,
    signature: 's',
    ...over,
  })

  check('读到一半算「在读」', readStateOf(book({ progress: { chapterIndex: 1, ratio: 0.5, updatedAt: 0 } })) === 'reading')
  check('最后一章读完算「已读完」', readStateOf(book({ progress: { chapterIndex: 3, ratio: 1, updatedAt: 0 } })) === 'done')
  check('没读过的算「未读」', readStateOf(book({ progress: null })) === 'todo')
  check('打开过但停在第一行也算「未读」（不是「读完了」）', readStateOf(book({ progress: { chapterIndex: 0, ratio: 0, updatedAt: 0 } })) === 'todo')
  check('最后一章读一半不算「已读完」', readStateOf(book({ progress: { chapterIndex: 3, ratio: 0.5, updatedAt: 0 } })) === 'reading')

  check('今天的写「今天 时:分」', docTimeText(new Date(2026, 8, 24, 9, 9).getTime(), now) === '今天 09:09')
  check('昨天的写「昨天 时:分」', docTimeText(new Date(2026, 8, 23, 21, 40).getTime(), now) === '昨天 21:40')
  check('今年的写「几月几日 时:分」', docTimeText(new Date(2026, 3, 15, 9, 7).getTime(), now) === '4月15日 09:07')
  check('跨年的补上年份', docTimeText(new Date(2025, 11, 31, 8, 5).getTime(), now) === '2025年12月31日 08:05')
  check('凌晨也补零（03:04 不是 3:4）', docTimeText(new Date(2026, 8, 24, 3, 4).getTime(), now) === '今天 03:04')

  const older = book({ id: 'old', title: '老书', addedAt: now - 10 * DAY, lastReadAt: now - 5 * DAY })
  const newer = book({ id: 'new', title: '新书', addedAt: now - DAY, lastReadAt: now - DAY })
  // 这两本的时间刻意差一秒：时间一样时按书名兜底那条另有断言，
  // 混在一起测的话排序结果会变成「拼音顺序」而不是「时间顺序」
  const reading = book({ id: 'reading', title: '在读的书', addedAt: now, lastReadAt: now, progress: { chapterIndex: 1, ratio: 0.5, updatedAt: 0 } })
  const done = book({ id: 'done', title: '读完的书', addedAt: now - 1000, lastReadAt: now - 1000, progress: { chapterIndex: 3, ratio: 1, updatedAt: 0 } })
  const shelf = [older, newer, reading, done]

  check(
    '「最近访问」按最近读的排（默认倒序）',
    homeRows(shelf, { tab: 'recent', filter: 'all', sortKey: 'recent', direction: 'desc' }).map((b) => b.id).join(',') ===
      'reading,done,new,old',
  )
  check(
    '「归我所有」按加入时间排',
    homeRows(shelf, { tab: 'mine', filter: 'all', sortKey: 'created', direction: 'desc' }).map((b) => b.id).join(',') ===
      'reading,done,new,old',
  )
  check(
    '箭头点一下换方向',
    homeRows(shelf, { tab: 'recent', filter: 'all', sortKey: 'recent', direction: 'asc' })[0].id === 'old',
  )
  check(
    '筛选「未读」只留没读过的（老书、新书）',
    homeRows(shelf, { tab: 'recent', filter: 'todo', sortKey: 'recent', direction: 'desc' }).every((b) => b.progress === null),
  )
  check(
    '筛选「已读完」只留读完了的',
    homeRows(shelf, { tab: 'recent', filter: 'done', sortKey: 'recent', direction: 'desc' }).map((b) => b.id).join(',') === 'done',
  )
  check(
    '「与我共享」「收藏」老实空着（本地文件没有这两个东西）',
    homeRows(shelf, { tab: 'shared', filter: 'all', sortKey: 'recent', direction: 'desc' }).length === 0 &&
      homeRows(shelf, { tab: 'starred', filter: 'all', sortKey: 'recent', direction: 'desc' }).length === 0,
  )
  check('时间一样时按书名兜底（顺序稳定）', (() => {
    const same = [book({ id: 'a', title: '乙' }), book({ id: 'b', title: '甲' })]
    const rows = homeRows(same, { tab: 'recent', filter: 'all', sortKey: 'recent', direction: 'desc' })
    return rows[0].title === '甲'
  })())
  check('「置顶文档」是最近读的那本', pinnedBook(shelf)?.id === 'reading')
  check('一本书都没有时不摆置顶行', pinnedBook([]) === undefined)
  check('所有者：没有作者就写「我」', docOwnerOf(book({ author: '' })) === '我' && docOwnerOf(book({ author: '张三' })) === '张三')
  check('四个页签、四档筛选都写的是中文标签', DOC_TABS.length === 4 && DOC_FILTERS.length === 4 && DOC_TABS.every((t) => !!t.label))
}

/* ==========================================================================
   七、Word 外壳：页签、样式库、章内查找
   ========================================================================== */

console.log('\nWord 外壳')
{
  // 页签这一排：顺序照截图（开始之后插的是 OfficePLUS，最后是 PDF工具箱），
  // 「文件」不在表里——它是回开始屏幕那个按钮，由 OfficeFrame 单独画
  check(
    '页签顺序照截图',
    WORD_TABS.map((tab) => tab.label).join(' ') ===
      '开始 OfficePLUS 插入 设计 布局 引用 邮件 审阅 视图 PDF工具箱 帮助',
    WORD_TABS.map((tab) => tab.label).join(' '),
  )
  check('真的只有「开始」和「视图」两页', WORD_TABS.filter((tab) => !tab.disabled).map((tab) => tab.id).join(',') === 'home,view')
  check(
    '其余页签全灰着，而且都有自己的名字（灰按钮要说得出为什么）',
    WORD_TABS.filter((tab) => tab.disabled).length === 9 &&
      WORD_TABS.every((tab) => (tab.disabled ? !!tab.label : !!tab.label)),
  )

  // 样式库：当前那一个只能有一个，不然「这一段用的是哪个样式」就说不清了
  check('样式库里有「正文」', WORD_STYLES.some((style) => style.id === 'body'))
  check('当前样式恰好一个', WORD_STYLES.filter((style) => style.current).length === 1)
  check(
    '当前那一个是正文（我们读的是小说正文，不是标题样式）',
    WORD_STYLES.find((style) => style.current)?.id === 'body',
  )
  check(
    '标题样式的字更大（样式库照 Word 把标题画大一号）',
    WORD_STYLES.filter((style) => style.heading).length > 0 &&
      WORD_STYLES.filter((style) => style.heading).every((style) => !style.current),
  )
}

console.log('\n章内查找')
{
  /** 一份小正文：两个自然段 + 一个注音 + 章末那对翻章按钮 */
  const html =
    '<p>雪国では、夜の底が白くなった。</p>' +
    '<p>「雪」という字が三度出てくる。雪、雪。</p>' +
    '<p>つづりは snow と書く。Snow も同じ。</p>' +
    '<p><ruby>雪<rt>ゆき</rt></ruby>の朝</p>' +
    '<nav class="mn-chapter-nav"><button data-mn-nav="next">下一章</button></nav>'
  const root = document.createElement('div')
  root.innerHTML = html
  const plain = root.textContent ?? ''

  check('数得出命中几处（含注音那个「雪」，一共 5 处）', countFinds(root, '雪') === 5, String(countFinds(root, '雪')))
  check('英文忽略大小写', countFinds(root, 'SNOW') === 2, String(countFinds(root, 'SNOW')))
  check('不搜我们自己拼进去的翻章按钮', countFinds(root, '下一章') === 0)
  check('不搜注音（rt 里的字不是书里的正文）', countFinds(root, 'ゆき') === 0)
  check('查不到就是 0（不是抛错）', countFinds(root, '不存在的词') === 0)
  check('空查询不数', countFinds(root, '   ') === 0)

  const marks = markFinds(root, '雪')
  check('标出来的和数出来的一样多', marks.length === 5, String(marks.length))
  check('每一处标的就是查的那个词', marks.every((mark) => mark.textContent === '雪'))
  check('标记顺序按正文出现顺序', marks[0].textContent === '雪' && marks[4].textContent === '雪')
  check('标记落在正文里（第一篇就是第一个）', root.querySelectorAll(`mark.${FIND_MARK}`).length === 5)
  check('原文一个字都没变', (root.textContent ?? '') === plain)

  const again = markFinds(root, '雪')
  check('再查一次不会套娃（不会出现标记套标记）', again.length === 5 && root.querySelectorAll('mark mark').length === 0)
  check('再查一次原文也还是没变', (root.textContent ?? '') === plain)

  check('清干净之后正文里没有 mark 了', clearFinds(root) === 5 && root.querySelectorAll('mark').length === 0)
  check('清完原文仍然一个字不差', (root.textContent ?? '') === plain)

  const none = markFinds(root, '不存在的词')
  check('查不到时不留标记', none.length === 0 && root.querySelectorAll('mark').length === 0)

  markFinds(root, '雪')
  markFinds(root, '')
  check('把搜索框清空等于清掉标记', root.querySelectorAll('mark').length === 0)
}

/* ==========================================================================
   七、Word 开始屏幕与视图页签（2026-09-24 按截图复刻的那一屏）
   ========================================================================== */

console.log('\nWord 开始屏幕')
{
  check(
    '三栏的顺序与名字照截图',
    WORD_HOME_TABS.map((tab) => tab.label).join(' ') === '最近 收藏夹 与我共享',
    WORD_HOME_TABS.map((tab) => tab.label).join(' '),
  )
  check(
    '每一栏空着时都说得出为什么（收藏夹 / 与我共享不摆假内容）',
    WORD_HOME_TABS.every((tab) => !!tab.empty),
  )
  check(
    '「收藏夹」「与我共享」老实空着（本地文件没有收藏与共享）',
    wordHomeRows([{ id: 'a' } as never], { tab: 'starred' }).length === 0 &&
      wordHomeRows([{ id: 'a' } as never], { tab: 'shared' }).length === 0,
  )

  /** 四本假书：时间刻意错开，排序一算就知道对不对 */
  const DAY = 86_400_000
  const now = new Date(2026, 8, 24, 15, 0, 0).getTime()
  const book = (over: Partial<BookRecord>): BookRecord => ({
    id: 'b',
    state: 'ready',
    title: '未命名',
    author: '',
    format: 'txt',
    addedAt: now,
    lastReadAt: now,
    totalChars: 1000,
    chapterCount: 4,
    charOffsets: [],
    groups: [],
    progress: null,
    fileName: 'x.txt',
    fileSize: 1,
    signature: 's',
    ...over,
  })
  const older = book({ id: 'old', title: '老书', addedAt: now - 10 * DAY, lastReadAt: now - 5 * DAY })
  const newer = book({ id: 'new', title: '新书', addedAt: now - DAY, lastReadAt: now - DAY })
  const reading = book({ id: 'reading', title: '在读的书', addedAt: now - 2 * DAY, lastReadAt: now - 1000 })
  const shelf = [older, newer, reading]

  check(
    '「最近」按最近读的排（倒序）',
    wordHomeRows(shelf, { tab: 'recent' }).map((item) => item.id).join(',') === 'reading,new,old',
    wordHomeRows(shelf, { tab: 'recent' }).map((item) => item.id).join(','),
  )
  check(
    '没读过的按导入时间算（lastReadAt 是 0 的时候不能全挤在最前面）',
    wordHomeRows([book({ id: 'never', lastReadAt: 0, addedAt: now })], { tab: 'recent' })[0].id === 'never',
  )
  check(
    '搜索按书名、作者、文件名三样匹配',
    wordHomeRows(shelf, { tab: 'recent', query: '在读' })[0].id === 'reading' &&
      wordHomeRows(shelf, { tab: 'recent', query: 'x.txt' }).length === 3 &&
      wordHomeRows(shelf, { tab: 'recent', query: '不存在的书' }).length === 0,
  )
  check(
    '搜到的东西仍然按最近读的排（搜索不打乱顺序）',
    wordHomeRows(shelf, { tab: 'recent', query: '书' }).map((item) => item.id).join(',') === 'reading,new,old',
  )
  check(
    '时间一样时按书名兜底（顺序稳定）',
    wordHomeRows(
      [book({ id: 'a', title: '乙' }), book({ id: 'b', title: '甲' })],
      { tab: 'recent' },
    )[0].title === '甲',
  )

  check('今天写「今天」', wordDateText(new Date(2026, 8, 24, 9, 9).getTime(), now) === '今天')
  check('昨天写「昨天」', wordDateText(new Date(2026, 8, 23, 21, 40).getTime(), now) === '昨天')
  check('今年写「M月D日」', wordDateText(new Date(2026, 3, 15).getTime(), now) === '4月15日')
  check('跨年写「YYYY/M/D」', wordDateText(new Date(2025, 11, 31).getTime(), now) === '2025/12/31')
  check('跨月的昨天也算昨天（不是「上个月的最后一天」）', wordDateText(new Date(2026, 7, 31, 23, 0).getTime(), new Date(2026, 8, 1, 9, 0).getTime()) === '昨天')

  check(
    '导航窗格三页是标题 / 查找 / 替换',
    WORD_NAV_TABS.map((tab) => tab.label).join(' ') === '标题 查找 替换',
  )
  check(
    '替换是灰的，而且说清了为什么（只读文档改不了字）',
    WORD_NAV_TABS.filter((tab) => tab.disabled).length === 1 &&
      WORD_NAV_TABS.find((tab) => tab.disabled)?.id === 'replace' &&
      !!WORD_NAV_TABS.find((tab) => tab.disabled)?.why,
  )
}

console.log('\n放真图的形态')
{
  // 「哪一屏显示小说插图」只在一处定义（lib/blocks.ts 的 mediaModeFor）。
  // 这条规矩踩过三次：先是企业微信、再是 Word、最后是幻灯片还在放图，
  // 而改动只落到一个调用点。所以直接断言那张表：
  // **放真图的只有普通阅读器一个**，其余六个形态一律写引用行。
  const shells = ['plain', 'code', 'doc', 'chat', 'page', 'sheet', 'slide'] as const
  const keeping = shells.filter((shell) => mediaModeFor(shell) === 'keep')
  check(
    '只有普通阅读器放真图，其余六个形态一律写 ![](./路径)',
    keeping.length === 1 && keeping.join(',') === 'plain',
    keeping.join(','),
  )
  check(
    '报过的那三个形态（企业微信 / Word / 幻灯片）都不放图',
    mediaModeFor('chat') === 'reference' &&
      mediaModeFor('page') === 'reference' &&
      mediaModeFor('slide') === 'reference',
  )
  check(
    '编辑器、文档、表格也写引用行',
    mediaModeFor('code') === 'reference' &&
      mediaModeFor('doc') === 'reference' &&
      mediaModeFor('sheet') === 'reference',
  )

  // 幻灯片里那行引用真的落在正文里：一张带图的章切出来，图是 `![](./路径)`，
  // 而不是一个 <img>（这一轮用户报的就是它）
  const deck = chapterSlides(
    chapterBlocks(
      '<p>图前面那一段话在这里，写得够长，不会被当成标题。</p>' +
        // src 用渲染时的 blob 地址：引用行里要写回书里的原始路径（resolve 干的活）
      '<figure><img src="blob:http://localhost/9f1" alt="插图"><figcaption>图注</figcaption></figure>',
      { media: mediaModeFor('slide'), resolve: () => 'OEBPS/Images/pic.png' },
    ),
    { title: '第一章' },
  )
  const texts = deck.flatMap((slide) => [slide.title, ...slide.body.map((part) => part.text)])
  check(
    '幻灯片里的图变成一行引用（写的是书里的原始路径），没有一个 <img>',
    texts.some((text) => text.includes('](./OEBPS/Images/pic.png)')) &&
      !deck.some((slide) => slide.body.some((part) => /<img|<figure/i.test(part.html))),
    texts.filter((text) => text.includes('![')).join(' | '),
  )
}

/* ==========================================================================
   七、界面文案：不许写操作指南与自我说明
   ========================================================================== */

console.log('\n界面文案')
{
  // 用户明确要求过：界面上只留具体事实，不写「点一下就能……」这类旁白，
  // 也不写「全是本地文件，不上传」这类自我说明（规矩见 AGENTS.md）。
  // 下面这几句是删过的，别再回来——它们是那个毛病的典型写法。
  const banned = [
    '点一下文档就能进阅读器',
    '全是本地文件，不上传',
    '拖一本小说进来，或者',
    '用存着的原始文件重跑',
    '不用再拖一次',
  ]
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((name) => /\.tsx?$/.test(name))
  const hits: string[] = []
  for (const name of files) {
    const text = readFileSync(`src/${name}`, 'utf8')
    // 只看会出现给人看的那些行：注释里写「别这么写」是允许的
    const visible = text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*')
      })
      .join('\n')
    for (const phrase of banned) if (visible.includes(phrase)) hits.push(`${name}: ${phrase}`)
  }
  check('界面文案里没有操作指南 / 自我说明式的句子', hits.length === 0, hits.join(' | '))
}

/* ========================================================================== */

console.log(`\n${failures === 0 ? '全部通过' : '有失败项'}（${checks} 项断言，${failures} 项失败）`)
if (failures > 0) process.exit(1)
