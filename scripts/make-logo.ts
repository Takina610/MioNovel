import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

/**
 * 从 public/MioNovel.png 派生界面用的小图。
 *
 * 页面上的标识只有 30–60px，直接引 187KB 的原图是纯浪费（而且它会进 PWA 预缓存）。
 * 这里按用到的显示尺寸各出一份，原图留给图标生成（`bun run icons`）当源图。
 *
 * 三份产物：
 *   logo-64.png / logo-192.png —— 界面里的标识（1x / 2x），方形透明底、内容居中；
 *   favicon.svg                —— 把 64px 的图内嵌进 SVG。浏览器标签页要的是
 *                                 「随便多大都不糊」，内嵌一张位图就够（原图本来就是位图），
 *                                 好处是只维护一个文件、不再是一份手写的旧版 SVG。
 *
 * 用法：bun run logo
 */
const SOURCE = 'public/MioNovel.png'

/** 方形透明底 + 内容居中。原图不是正方形，直接缩放会被拉伸 */
async function square(width: number, palette: boolean): Promise<Buffer> {
  return sharp(SOURCE)
    .resize(width, width, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette })
    .toBuffer()
}

const source = await sharp(SOURCE).metadata()
console.log(`源图 ${SOURCE} ${source.width}×${source.height}`)

const small = await square(64, true)
const medium = await square(192, false)

await writeFile('public/logo-64.png', small)
await writeFile('public/logo-192.png', medium)

// favicon：SVG 外壳 + 内嵌位图。不写成 path 是因为我们的标识是一张位图原图，
// 描一遍 path 出来的东西和原图不是一个图形，还很难维护
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="MioNovel"><image width="64" height="64" href="data:image/png;base64,${small.toString('base64')}"/></svg>\n`
await writeFile('public/favicon.svg', svg)

console.log(`public/logo-64.png   ${Math.round(small.byteLength / 1024)}KB`)
console.log(`public/logo-192.png  ${Math.round(medium.byteLength / 1024)}KB`)
console.log(`public/favicon.svg   ${Math.round(Buffer.byteLength(svg) / 1024)}KB`)
