/**
 * 解析器验收。用法：bun run verify
 *
 * 为什么单独写这个：中文 txt 的编码识别和分章是本项目最容易出错的地方，
 * 而它们的失败方式是「某本书正好没识别对」——靠手动找文件来试，覆盖永远不够。
 * 这里把样例固定下来跑一遍确定的断言，TXT 这条链路的每次改动都能立刻看出退化。
 *
 * EPUB 不在这个脚本里跑：它的解析要用 DOMParser，而 Bun 没有 DOM。
 * EPUB 用浏览器验收（见 README 的验收清单）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { txtParser } from '../src/parsers/txt/parse'
import type { ParsedChapter, ParseSink } from '../src/parsers/types'

const SAMPLE_DIR = join(import.meta.dir, '..', 'samples')

let failures = 0
let checks = 0

function check(name: string, condition: boolean, detail = ''): void {
  checks++
  if (condition) {
    console.log(`  \u2714 ${name}`)
  } else {
    failures++
    console.log(`  \u2718 ${name}${detail ? `  ← ${detail}` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

/** 造一个带 name 的 Blob 当 File 用：parsers 只用到 slice/size/name/arrayBuffer */
function fileFrom(name: string): File {
  const bytes = readFileSync(join(SAMPLE_DIR, name))
  const blob = new Blob([bytes])
  return Object.assign(blob, { name }) as unknown as File
}

interface ParseOutcome {
  chapters: ParsedChapter[]
  notes: string[]
  ratios: number[]
  head: Awaited<ReturnType<typeof txtParser.parse>>
}

async function run(name: string, options: { charset?: string; rule?: string } = {}) {
  const chapters: ParsedChapter[] = []
  const notes: string[] = []
  const ratios: number[] = []

  const sink: ParseSink = {
    onProgress: (ratio, note) => {
      ratios.push(ratio)
      if (note) notes.push(note)
    },
    onChapter: (chapter) => {
      chapters.push(chapter)
    },
  }

  const file = fileFrom(name)
  const head = await txtParser.parse(file, sink, options)
  return { chapters, notes, ratios, head } satisfies ParseOutcome
}

async function probe(name: string) {
  return txtParser.probe(fileFrom(name), {})
}

// ---------------------------------------------------------------------------

if (!existsSync(join(SAMPLE_DIR, 'utf8-cn.txt'))) {
  console.error('先跑 `bun run samples` 生成样例文件')
  process.exit(1)
}

section('UTF-8 简体中文（卷 + 章）')
{
  const { chapters, head, ratios } = await run('utf8-cn.txt')
  const probeResult = await probe('utf8-cn.txt')

  check('编码识别为 utf-8', head.meta.charset === 'utf-8', head.meta.charset)
  check('章节数为 12', head.chapterCount === 12, String(head.chapterCount))
  check('首章标题正确', chapters[0]?.title === '第1章 少年与灯', chapters[0]?.title)
  check('末章标题正确', chapters[11]?.title === '第12章 少年与灯', chapters[11]?.title)
  check(
    '识别出两个卷分组',
    head.groups.length === 2 && head.groups[0].label === '第一卷 风起',
    JSON.stringify(head.groups.map((group) => group.label)),
  )
  check(
    '卷内的章缩进一级',
    chapters.every((chapter) => chapter.depth === 1),
    `depths=${[...new Set(chapters.map((chapter) => chapter.depth))].join(',')}`,
  )
  check(
    '第二卷的目录项指向第 7 章',
    head.groups[1]?.chapterIndex === 6,
    String(head.groups[1]?.chapterIndex),
  )
  check(
    '卷标题出现在正文里',
    chapters[0]?.html.includes('mn-volume-title') === true,
    '首章应带上卷标题那一行',
  )
  check(
    '首行短前言并进了第一章而不是单独成章',
    chapters[0]?.html.includes('仅用于验收') === true,
  )
  check(
    'charOffsets 与总字数自洽',
    head.charOffsets[0] === 0 &&
      head.charOffsets.length === head.chapterCount &&
      head.charOffsets[head.chapterCount - 1] + chapters[head.chapterCount - 1].charCount ===
        head.totalChars,
    `offsets=${head.charOffsets.length} total=${head.totalChars}`,
  )
  check('预估规则选中中文小说', probeResult.rule === 'cn', String(probeResult.rule))
  check('进度有上报且收尾为 1', ratios.length > 0 && ratios[ratios.length - 1] === 1)
}

section('UTF-16LE（无 BOM）')
{
  const { head } = await run('utf16le-cn.txt')
  check('编码识别为 utf-16le', head.meta.charset === 'utf-16le', head.meta.charset)
  check('章节数为 12', head.chapterCount === 12, String(head.chapterCount))
}

section('GB18030 简体中文')
{
  if (!existsSync(join(SAMPLE_DIR, 'gbk-cn.txt'))) {
    console.log('  (跳过：samples/gbk-cn.txt 不存在，见 make-samples 输出的 PowerShell 命令)')
  } else {
    const { chapters, head } = await run('gbk-cn.txt')
    check('编码识别为 gb18030', head.meta.charset === 'gb18030', head.meta.charset)
    check('章节数为 12', head.chapterCount === 12, String(head.chapterCount))
    check(
      '正文解码正确（不是乱码）',
      chapters[0]?.html.includes('少年与灯') === true,
      chapters[0]?.html.slice(0, 60),
    )
  }
}

section('Big5（繁体）')
{
  if (!existsSync(join(SAMPLE_DIR, 'big5-cn.txt'))) {
    console.log('  (跳过：samples/big5-cn.txt 不存在，见 make-samples 输出的 PowerShell 命令)')
  } else {
    const { chapters, head } = await run('big5-cn.txt')
    check('编码识别为 big5', head.meta.charset === 'big5', head.meta.charset)
    check('章节数为 12', head.chapterCount === 12, String(head.chapterCount))
    // 样例是把简体正文塞进 950 代码页生成的，Big5 里没有的字会被替换成 ?。
    // 这不是解析器的问题，所以只断言结构（多字节解码成功、分章正确），
    // 不断言具体文字。
    check(
      '多字节解码成功（章标题结构完整）',
      chapters[0]?.title.startsWith('第1章') === true,
      chapters[0]?.title,
    )
  }
}

section('手动指定编码（覆盖自动检测）')
{
  // 这个文件其实是 UTF-8，故意按 GB18030 解，内容应该变成乱码——
  // 用来确认「手动指定」真的走了指定值，而不是被自动检测悄悄改回去
  const { chapters, head } = await run('utf8-cn.txt', { charset: 'gb18030' })
  check('沿用了指定的编码', head.meta.charset === 'gb18030', head.meta.charset)
  check('内容确实按指定编码解出来（因此不是原字）', chapters[0]?.html.includes('少年与灯') === false)
}

section('标题干扰项')
{
  const { head, chapters } = await run('tricky-titles.txt')
  check('只认 5 个真标题', head.chapterCount === 5, String(head.chapterCount))
  check(
    '「他翻到第一章的时候…」没有被当成标题',
    chapters.every((chapter) => !chapter.title.includes('的时候')),
    chapters.map((chapter) => chapter.title).join(' | '),
  )
  check(
    '「第 12 页上有一行批注」没有被当成标题',
    !chapters.some((chapter) => chapter.title.includes('页上')),
  )
  check(
    '这些句子留在了正文里',
    chapters[0]?.html.includes('他翻到第一章的时候') === true,
  )
}

section('英文小说')
{
  const { head, chapters } = await run('en-novel.txt')
  check('预估规则选中英文小说', (await probe('en-novel.txt')).rule === 'en')
  check('Part 被当成卷分组', head.groups.length === 2, String(head.groups.length))
  check('章节数为 9', head.chapterCount === 9, String(head.chapterCount))
  check('首章标题正确', chapters[0]?.title === 'Chapter 1', chapters[0]?.title)
}

section('无章节标记（降级为按字数分段）')
{
  const { head, chapters } = await run('chapterless.txt')
  check('预估规则落到 chunk', (await probe('chapterless.txt')).rule === 'chunk')
  check('给出了说明', head.meta.note?.includes('按约 3000 字分段') === true, head.meta.note)
  check('分成了多段', head.chapterCount > 3, String(head.chapterCount))
  check('段标题是「第 N 节」', chapters[0]?.title === '第 1 节', chapters[0]?.title)
  const average = head.totalChars / head.chapterCount
  check(
    '每段字数在 3000 附近',
    average > 2400 && average < 3400,
    `平均 ${Math.round(average)} 字`,
  )
}

section('二进制内容不该被当成小说收下')
{
  // 随机字节按 GB18030 也解得出「东西」，但那是一屏乱码。
  // 真正该发生的是导入失败 + 一句能读懂的中文原因，而不是书架上一本读不了的书。
  const junk = new Uint8Array(4096)
  for (let i = 0; i < junk.length; i++) junk[i] = (i * 37) % 251
  const junkFile = Object.assign(new Blob([junk]), { name: 'broken.epub' }) as unknown as File
  const probeError = await txtParser.probe(junkFile, {}).catch((error: unknown) => error)
  check(
    'probe 直接拒绝二进制文件，并给出中文原因',
    probeError instanceof Error && /[一-鿿]/.test(probeError.message),
    probeError instanceof Error ? probeError.message : String(probeError),
  )
}

section('强制规则（用户显式选择不该被静默改写）')
{
  const { head } = await run('chapterless.txt', { rule: 'cn' })
  check('指定 cn 后仍给出结果且不崩', head.chapterCount >= 1, String(head.chapterCount))
  check(
    '给出「规则可能不合适」的提示',
    head.meta.note?.includes('规则可能不合适') === true,
    head.meta.note,
  )
}

// ---------------------------------------------------------------------------

console.log(
  failures === 0
    ? `\n全部通过（${checks} 项断言）`
    : `\n${failures} / ${checks} 项断言失败`,
)
process.exit(failures === 0 ? 0 : 1)

export { fileFrom, run, basename }
