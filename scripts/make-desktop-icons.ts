// 桌面端视觉资产生成链：public/MioNovel.png 不是正方形（351×367），
// 而 `tauri icon` 只收正方形源图——先补透明边到 1024×1024 再交给它。
// 同一条链顺带出 NSIS 安装器的品牌图（图标 + 欢迎页侧图 + 头部横幅），
// 不配的话安装器用的是 NSIS 默认图标和默认位图，跟 MioNovel 无关。
// 产物落在 src-tauri/（入库，日常不用重跑；换标识才跑一次）。
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'public', 'MioNovel.png')
const padded = join(tmpdir(), 'mionovel-icon-square.png')
const outDir = join(root, 'src-tauri', 'icons')
const installerDir = join(root, 'src-tauri', 'installer')

// ---- 1. 图标集 ------------------------------------------------------------

const meta = await sharp(source).metadata()
if (!meta.width || !meta.height) throw new Error('读不到 MioNovel.png 的尺寸')
const side = Math.max(meta.width, meta.height)
// sharp 的管线顺序是固定的（resize 先于 extend 执行），补边和缩放必须拆两步，
// 否则按原图算的补边量会加到缩放后的图上，出来就不是正方形
const squared = join(tmpdir(), 'mionovel-icon-squared.png')
await sharp(source)
  .extend({
    top: Math.floor((side - meta.height) / 2),
    bottom: Math.ceil((side - meta.height) / 2),
    left: Math.floor((side - meta.width) / 2),
    right: Math.ceil((side - meta.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(squared)
await sharp(squared).resize(1024, 1024).png().toFile(padded)

rmSync(outDir, { recursive: true, force: true })
const run = spawnSync('bunx', ['tauri', 'icon', padded, '--output', outDir], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (run.status !== 0) throw new Error('tauri icon 失败')

// ---- 2. NSIS 安装器品牌图 -------------------------------------------------
// 尺寸是 NSIS MUI2 的约定：头部 150×57、欢迎/完成页侧图 164×314，24 位 BMP。
// 颜色取自 logo 本身（深青 #19466f / 珊瑚 #f58e8f），底色白——MUI2 的头部
// 文字画在白底上，位图也用白底才接得上。

const brand = await sharp(source)
  .flatten({ background: '#ffffff' })
  .png()
  .toBuffer()

// 24 位 BMP 是未压缩的 BGR、行从下往上、每行补齐 4 字节——sharp 不出 BMP，自己写
function bmp24(width: number, height: number, rgb: Buffer): Buffer {
  const stride = Math.ceil((width * 3) / 4) * 4
  const body = stride * height
  const buf = Buffer.alloc(54 + body)
  buf.write('BM', 0)
  buf.writeUInt32LE(54 + body, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(body, 34)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 3
      const di = 54 + (height - 1 - y) * stride + x * 3
      buf[di] = rgb[si + 2]
      buf[di + 1] = rgb[si + 1]
      buf[di + 2] = rgb[si]
    }
  }
  return buf
}

// composite 要的一小块：一张图（buffer）贴在哪个位置
type Layer = { input: Buffer; top: number; left: number }

async function renderBmp(width: number, height: number, layers: Layer[]): Promise<Buffer> {
  const png = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .png()
    .toBuffer()
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return bmp24(width, height, data)
}

// 底部的双色条：深青为主、左端一截珊瑚，两个颜色都从 M 的笔画里取的
const footerBar = Buffer.from(
  `<svg width="164" height="8" xmlns="http://www.w3.org/2000/svg">
    <rect width="164" height="8" fill="#19466f"/>
    <rect width="48" height="8" fill="#f58e8f"/>
  </svg>`,
)

mkdirSync(installerDir, { recursive: true })
await renderBmp(164, 314, [
  { input: await sharp(brand).resize(110).png().toBuffer(), top: 96, left: 27 },
  { input: footerBar, top: 314 - 8, left: 0 },
]).then((bmp) => writeFileSync(join(installerDir, 'sidebar.bmp'), bmp))

await renderBmp(150, 57, [
  { input: await sharp(brand).resize(42).png().toBuffer(), top: 8, left: 10 },
]).then((bmp) => writeFileSync(join(installerDir, 'header.bmp'), bmp))

console.log('桌面图标已生成到 src-tauri/icons/，安装器品牌图已生成到 src-tauri/installer/')
