/**
 * 生成验收用的样例文件。
 *
 * 为什么要有这个脚本：中文小说 txt 的编码和分章是最容易翻车的地方，
 * 而「翻车」的形态是「这本书正好没识别对」——靠手动找文件来测，覆盖面永远不够。
 * 把样例固定下来，验收就有确定的输入。
 *
 * 用法：bun run samples
 *
 * 注意：GBK / Big5 的样例不在这里生成——Node / Bun 的编码支持里没有 GB18030 输出，
 * 强行手写字节序列只会写出自己都不确定的文件。用 Windows 的 936 代码页转：
 *   powershell -Command "[IO.File]::WriteAllText('samples/gbk-cn.txt', [IO.File]::ReadAllText('samples/_gbk-source.txt', [Text.Encoding]::UTF8), [Text.Encoding]::GetEncoding(936))"
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync, zlibSync, strToU8 } from 'fflate'

const OUT_DIR = join(import.meta.dir, '..', 'samples')

// ---------------------------------------------------------------------------
// 文本样例
// ---------------------------------------------------------------------------

/** 带卷结构的简体中文小说：卷标题 + 章节 + 空行分段 */
function chineseNovel(): string {
  const lines: string[] = []
  lines.push('本书由样例生成脚本产出，仅用于验收。')
  lines.push('')
  lines.push('第一卷 风起')
  lines.push('')
  for (let chapter = 1; chapter <= 12; chapter++) {
    lines.push(`第${chapter}章 少年与灯`)
    lines.push('')
    for (let paragraph = 0; paragraph < 6; paragraph++) {
      lines.push(
        `这是第${chapter}章的第${paragraph + 1}段。灯芯爆了一下，屋子里的人都没有回头。` +
          '他把手里的书合上，听见远处传来更夫的梆子声，一下，两下。',
      )
      lines.push('')
    }
    if (chapter === 6) {
      lines.push('第二卷 落雪')
      lines.push('')
    }
  }
  return lines.join('\n')
}

/** 英文小说：Chapter N + 罗马数字 Part */
function englishNovel(): string {
  const lines: string[] = ['Part I', '']
  for (let chapter = 1; chapter <= 8; chapter++) {
    lines.push(`Chapter ${chapter}`)
    lines.push('')
    for (let paragraph = 0; paragraph < 4; paragraph++) {
      lines.push(
        `The lamp flared once, and nobody in the room turned around. ` +
          `He closed the book and heard the watchman's clapper in the distance, once, twice.`,
      )
      lines.push('')
    }
  }
  lines.push('Part II')
  lines.push('')
  lines.push('Chapter 9')
  lines.push('')
  lines.push('The snow came down over the rooftops and made everything quiet.')
  return lines.join('\n')
}

/** 完全没有章节标记的长文，用来验证「按字数分段」的降级路径 */
function chapterlessText(): string {
  const lines: string[] = []
  for (let index = 0; index < 400; index++) {
    lines.push(
      `第${index + 1}段没有章节标记的正文，用来验证按字数分段的降级路径。` +
        '这一段刻意写长一点，让总字数稳定超过一万，从而落到三千字一段的分段逻辑里。',
    )
  }
  return lines.join('\n')
}

/** 章节标题有干扰项的正文：句子中间出现「第一章」三个字，不该被当成标题 */
function trickyText(): string {
  const lines: string[] = []
  for (let chapter = 1; chapter <= 5; chapter++) {
    lines.push(`第${chapter}章 试探`)
    lines.push('')
    lines.push('他翻到第一章的时候愣了一下，因为那一段被水浸过，字迹已经散了。')
    lines.push('')
    lines.push('第 12 页上有一行批注，写得极轻。')
    lines.push('')
    lines.push('他记得自己曾经说过，第一章里那个少年其实并没有走远。')
    lines.push('')
  }
  return lines.join('\n')
}

function encodeUtf16LE(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < text.length; index++) {
    view.setUint16(index * 2, text.charCodeAt(index), true)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// 最小 PNG 编码器（用来造封面和插图）
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = strToU8(type)
  const body = new Uint8Array(typeBytes.length + data.length)
  body.set(typeBytes)
  body.set(data, typeBytes.length)

  const out = new Uint8Array(8 + data.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(4 + body.length, crc32(body))
  return out
}

/** 纯色渐变 PNG。没有任何依赖，够用来验证「图能不能显示出来」 */
function makePng(width: number, height: number, from: number[], to: number[]): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 3))
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const t = (x / Math.max(1, width - 1) + y / Math.max(1, height - 1)) / 2
      raw[offset++] = Math.round(from[0] + (to[0] - from[0]) * t)
      raw[offset++] = Math.round(from[1] + (to[1] - from[1]) * t)
      raw[offset++] = Math.round(from[2] + (to[2] - from[2]) * t)
    }
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlibSync(raw, { level: 6 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

// ---------------------------------------------------------------------------
// EPUB 样例：刻意塞进真实书里会遇到的脏东西
// ---------------------------------------------------------------------------

const XHTML_HEAD = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>章节</title></head><body>`

function makeEpub(): Uint8Array {
  const chapters = {
    // 封面页：真实日系 EPUB 最爱的「SVG 包 image」写法（xlink:href 指图）。
    // 它在 spine 最前且不在目录里，应该并进第一章而不是自成一章
    'OEBPS/Text/cover.xhtml': `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>封面</title></head><body>
<div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 600 800" width="100%" height="100%"><image xlink:href="../Images/cover.png" width="600" height="800"/></svg></div>
</body></html>`,
    'OEBPS/Text/ch1.xhtml': `${XHTML_HEAD}
      <style>p { color: red; font-family: "Comic Sans MS"; }</style>
      <h1 class="chapter-title" style="color: red; text-align: center; font-size: 4em; margin: 3em">第一章 少年与灯</h1>
      <p class="body" style="line-height: 5; text-indent: 0">灯芯爆了一下，<ruby>少年<rt>shào nián</rt></ruby>没有回头。</p>
      <p style="background: url('https://example.com/x.png'); color: blue">他合上书，听见更夫的梆子声。</p>
      <figure><img src="../Images/pic.png" alt="插图" style="width: 9999px"/><figcaption>插图说明</figcaption></figure>
      <p id="note1">这是本章的内部锚点。</p>
      </body></html>`,
    // 不在目录里的文档：应该被并进上一章，而不是自成「第 2 章」
    'OEBPS/Text/ch1b.xhtml': `${XHTML_HEAD}
      <p>这一段属于第一章的后半，单独放在一个 spine 文档里。</p>
      <p>它不该变成独立的一章。</p>
      </body></html>`,
    'OEBPS/Text/ch2.xhtml': `${XHTML_HEAD}
      <h2>第二章 落雪</h2>
      <p>雪落下来，屋顶上就没有声音了。这里有脚注<sup><a href="ch3.xhtml#fn1">1</a></sup>。</p>
      <p style="opacity:0.4;">　雪が降って、屋根の上に音がなくなった。ここに脚注がある<sup><a href="ch3.xhtml#fn1">1</a></sup>。</p>
      <p><a href="#note1">回到本章锚点</a></p>
      <p id="note1">本章锚点在这里，同章链接应该落到这一行。</p>
      <table><tr><th>年</th><th>事</th></tr><tr><td>元熙三年</td><td>落雪</td></tr></table>
      </body></html>`,
    'OEBPS/Text/ch3.xhtml': `${XHTML_HEAD}
      <h2>第三章 夜行</h2>
      <p>夜里赶路的人并不多。</p>
      <hr/>
      <p id="fn1">注一：这一条是脚注正文，跨章链接应该跳到这里。</p>
      </body></html>`,
  }

  const nav = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head><body>
<nav epub:type="toc" id="toc">
  <ol>
    <li><span>第一部 起点</span>
      <ol>
        <li><a href="Text/ch1.xhtml">第一章 少年与灯</a></li>
        <li><a href="Text/ch2.xhtml">第二章 落雪</a></li>
        <li><a href="Text/ch3.xhtml">第三章 夜行</a></li>
      </ol>
    </li>
  </ol>
</nav>
</body></html>`

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">mionovel-sample-epub</dc:identifier>
    <dc:title>样例书：风起</dc:title>
    <dc:creator>样例作者</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:publisher>样例出版社</dc:publisher>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-image" href="Images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="pic" href="Images/pic.png" media-type="image/png"/>
    <item id="coverpage" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1b" href="Text/ch1b.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="Text/ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="coverpage"/>
    <itemref idref="ch1"/>
    <itemref idref="ch1b"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`

  const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

  return zipSync(
    {
      // mimetype 必须是第一个条目且不压缩，否则严格校验的阅读器会拒收
      mimetype: [strToU8('application/epub+zip'), { level: 0 }],
      'META-INF/container.xml': strToU8(container),
      'OEBPS/content.opf': strToU8(opf),
      'OEBPS/nav.xhtml': strToU8(nav),
      'OEBPS/Images/cover.png': makePng(600, 800, [42, 54, 74], [180, 150, 110]),
      'OEBPS/Images/pic.png': makePng(320, 200, [200, 120, 80], [80, 140, 200]),
      ...Object.fromEntries(
        Object.entries(chapters).map(([name, html]) => [name, strToU8(html)]),
      ),
    },
    { level: 6 },
  )
}

// ---------------------------------------------------------------------------

function write(name: string, data: Uint8Array | string): void {
  const path = join(OUT_DIR, name)
  if (typeof data === 'string') writeFileSync(path, data, 'utf8')
  else writeFileSync(path, data)
  const size = typeof data === 'string' ? Buffer.byteLength(data) : data.length
  console.log(`  ${name.padEnd(24)} ${(size / 1024).toFixed(1)} KB`)
}

mkdirSync(OUT_DIR, { recursive: true })

console.log('生成样例文件：')

const cn = chineseNovel()
write('utf8-cn.txt', cn)
write('_gbk-source.txt', cn)
write('_big5-source.txt', cn)
write('utf16le-cn.txt', encodeUtf16LE(cn))
write('tricky-titles.txt', trickyText())
write('en-novel.txt', englishNovel())
write('chapterless.txt', chapterlessText())
write('sample.epub', makeEpub())

console.log(`
下一步（生成 GBK / Big5 样例，Node 和 Bun 都不支持输出这两种编码）：
  powershell -Command "[IO.File]::WriteAllText('samples/gbk-cn.txt', [IO.File]::ReadAllText('samples/_gbk-source.txt', [Text.Encoding]::UTF8), [Text.Encoding]::GetEncoding(936))"
  powershell -Command "[IO.File]::WriteAllText('samples/big5-cn.txt', [IO.File]::ReadAllText('samples/_big5-source.txt', [Text.Encoding]::UTF8), [Text.Encoding]::GetEncoding(950))"

然后跑验收：bun run verify
`)
