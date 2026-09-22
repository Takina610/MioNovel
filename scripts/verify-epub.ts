/**
 * EPUB 解析验收。用法：bun run verify:epub
 *
 * EPUB 解析要用 DOMParser 和 DOMPurify，Bun 里没有，所以这里用 happy-dom 顶一个最小 DOM。
 * 为什么值得为它多装一个 devDependency：EPUB 这条链路上有太多「只有真实文件才会暴露」
 * 的细节——图片相对路径重写、spine 文档归并、跨章脚注链接、封面回退链、书自带样式的剥除。
 * 这些靠肉眼看一遍是检不出来的。
 *
 * 样例 sample.epub 由 make-samples.ts 生成，里面刻意塞了脏东西：
 * 章内 <style>、class 属性、指向不存在尺寸的 img style、跨章脚注链接、
 * 不在目录里的凑数 spine 文档、ruby 注音。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Window } from 'happy-dom'

// DOM 必须在导入被测模块之前就位：dompurify 在模块初始化时就会去抓全局 window
const testWindow = new Window({ url: 'http://localhost/' })
const globals = globalThis as unknown as Record<string, unknown>
globals.window = testWindow
globals.document = testWindow.document
globals.DOMParser = testWindow.DOMParser
globals.Node = testWindow.Node
globals.Element = testWindow.Element
globals.HTMLElement = testWindow.HTMLElement
globals.NodeFilter = testWindow.NodeFilter

const { parseEpubForTest } = await import('./epub-harness.ts')

const SAMPLE = join(import.meta.dir, '..', 'samples', 'sample.epub')

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

const bytes = readFileSync(SAMPLE)
const blob = Object.assign(new Blob([bytes]), { name: 'sample.epub' }) as unknown as File

const result = await parseEpubForTest(blob)
const { head, chapters, resources } = result

console.log(`\n解析结果：${head.chapterCount} 章 / ${head.totalChars} 字 / ${resources.length} 个资源\n`)

console.log('元数据')
{
  check('书名取自 dc:title', head.meta.title === '样例书：风起', head.meta.title)
  check('作者取自 dc:creator', head.meta.author === '样例作者', head.meta.author)
  check('语言取自 dc:language', head.meta.language === 'zh-CN', head.meta.language)
  check('出版社取自 dc:publisher', head.meta.publisher === '样例出版社', head.meta.publisher)
  check('抽出了封面', head.meta.cover instanceof Blob && head.meta.cover.size > 0)
}

console.log('\n章节归并（spine 里的凑数文档要并进上一章，不能自成章节）')
{
  check('章节数为 3', head.chapterCount === 3, String(head.chapterCount))
  check('首章标题来自目录', chapters[0]?.title === '第一章 少年与灯', chapters[0]?.title)
  check('次章标题来自目录', chapters[1]?.title === '第二章 落雪', chapters[1]?.title)
  check(
    '不在目录里的 spine 文档并进了第一章',
    chapters[0]?.html.includes('它不该变成独立的一章') === true,
  )
  check(
    '它没有变成单独的一章',
    !chapters.some((chapter) => chapter.title.includes('（无标题）')),
  )
  check(
    '目录里没有链接的分组标题被保留为卷',
    head.groups.length === 1 && head.groups[0].label === '第一部 起点',
    JSON.stringify(head.groups),
  )
  check(
    '卷节点指向第一章',
    head.groups[0]?.chapterIndex === 0,
    String(head.groups[0]?.chapterIndex),
  )
  check(
    '嵌套目录里的章缩进一级',
    chapters.every((chapter) => chapter.depth === 1),
    chapters.map((chapter) => chapter.depth).join(','),
  )
}

console.log('\n图片与样式')
{
  check(
    '图片 src 重写成内部协议',
    chapters[0]?.html.includes('src="mnres://OEBPS/Images/pic.png"') === true,
  )
  check(
    '抽出了插图资源',
    resources.some((item) => item.path === 'OEBPS/Images/pic.png' && item.blob.size > 0),
    JSON.stringify(resources.map((item) => item.path)),
  )
  // 下面这几条验的是 scrubDocument()——我们自己的那一层净化。
  // 它的意义在于不依赖 DOMPurify：DOMPurify 在 happy-dom 下是空转的
  // （连 <script> 都不删），所以能在这里通过说明了第一层是有效的。
  check('书自带的 <style> 被删掉', chapters[0]?.html.includes('<style') === false)
  check('书自带的 class 被删掉', chapters[0]?.html.includes('class="chapter-title"') === false)
  check(
    '危险的个别内联样式被剥离，只留语义样式',
    chapters[0]?.html.includes('font-size: 4em') === false &&
      chapters[0]?.html.includes('line-height: 5') === false &&
      chapters[0]?.html.includes('text-align: center') === true,
    chapters[0]?.html.match(/style="[^"]*"/g)?.join(' | '),
  )
  check(
    '带 url() 的内联样式被拒绝',
    chapters[0]?.html.includes('url(') === false,
  )
  check('保留 ruby 注音', chapters[0]?.html.includes('<ruby>') === true)
  check('保留 figcaption', chapters[0]?.html.includes('<figcaption>') === true)
  check('保留表格', chapters[1]?.html.includes('<table>') === true)
}

console.log('\n恶意内容（第一层净化必须挡住，不能指望第三方库）')
{
  const nasty = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>
<script>window.__pwned = 1</script>
<p onclick="window.__pwned = 2" onerror="window.__pwned = 3">正文</p>
<a href="javascript:window.__pwned = 4">链接</a>
<iframe src="https://example.com"></iframe>
<img src="javascript:window.__pwned = 5"/>
<img src="data:image/png;base64,iVBORw0KGgo=" />
<object data="x.swf"></object>
</body></html>`

  const { transformChapterHtml } = await import('../src/parsers/epub/html.ts')
  const result = transformChapterHtml(nasty, {
    chapterPath: 'OEBPS/Text/x.xhtml',
    chapterIndexOf: () => null,
    isResource: () => false,
  })

  check('script 标签被删掉', !result.html.includes('<script'))
  check('iframe 被删掉', !result.html.includes('<iframe'))
  check('object 被删掉', !result.html.includes('<object'))
  check('onclick 之类的内联事件被删掉', !/on\w+=/i.test(result.html), result.html)
  check('javascript: 协议的链接被摘掉 href', !result.html.includes('javascript:'))
  check(
    'javascript: 协议的图片被摘掉 src',
    !/src="javascript:/i.test(result.html),
  )
  check('data: 内联图保留（它本来就在文件里）', result.html.includes('data:image/png'))
  check('正文本身保留', result.html.includes('正文') && result.html.includes('链接'))
}

console.log('\n链接重写')
{
  check(
    '跨章链接指到正确的章号',
    chapters[1]?.html.includes('#mnref-2:fn1') === true,
    chapters[1]?.html.match(/href="[^"]*"/g)?.join(' | '),
  )
  check(
    '同章锚点保持原样',
    chapters[1]?.html.includes('href="#note1"') === true,
  )
  check('脚注目标 id 保留', chapters[2]?.html.includes('id="fn1"') === true)
}

console.log('\n进度数据')
{
  const last = chapters[chapters.length - 1]
  check(
    'charOffsets 与总字数自洽',
    head.charOffsets[0] === 0 &&
      head.charOffsets[head.chapterCount - 1] + last.charCount === head.totalChars,
    `offsets=${head.charOffsets.join(',')} total=${head.totalChars}`,
  )
  check(
    '每章字数大于 0',
    chapters.every((chapter) => chapter.charCount > 0),
    chapters.map((chapter) => chapter.charCount).join(','),
  )
}

console.log('\n错误处理')
{
  const garbage = Object.assign(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])]), {
    name: 'broken.epub',
  }) as unknown as File
  const broken = await parseEpubForTest(garbage).catch((error: unknown) => error)
  check(
    '损坏的 epub 给出可读的中文错误而不是崩掉',
    broken instanceof Error && /[\u4e00-\u9fff]/.test(broken.message),
    broken instanceof Error ? broken.message : String(broken),
  )
}

console.log(
  failures === 0
    ? `\n全部通过（${checks} 项断言）`
    : `\n${failures} / ${checks} 项断言失败`,
)
process.exit(failures === 0 ? 0 : 1)
