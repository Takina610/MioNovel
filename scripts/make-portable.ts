// 便携版打包：把 release 的 exe 和 portable.txt 标记一起压成 zip。
// exe 是通用的一份——运行时看旁边有没有 portable.txt 决定数据落在哪
// （src/lib.rs 的 portable_data_dir），所以不用单独编一个「便携版二进制」。
// 用法：先 bun run app:build，再 bun run app:portable。
import { zipSync } from 'fflate'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const exePath = join(root, 'src-tauri', 'target', 'release', 'mionovel.exe')
const conf = JSON.parse(await readFile(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const version = conf.version as string

if (!(await stat(exePath).catch(() => null))) {
  console.error('还没构建：先跑 bun run app:build，再跑本脚本')
  process.exit(1)
}

const exe = new Uint8Array(await readFile(exePath))
// 标记文件只看存在与否（src/lib.rs），内容是给解开 zip 的人看的
const marker = new TextEncoder().encode(
  [
    '这个文件让 MioNovel 以便携模式运行。',
    '书、进度和设置都保存在旁边的 data\\ 文件夹里，跟着 exe 一起走；',
    '删掉这个文件就回到普通模式（数据存到系统的用户目录）。',
  ].join('\n'),
)

const zip = zipSync({
  'MioNovel.exe': exe,
  'portable.txt': marker,
})

const out = join(root, 'src-tauri', 'target', 'release', 'bundle', 'portable', `MioNovel_${version}_x64-portable.zip`)
await mkdir(join(root, 'src-tauri', 'target', 'release', 'bundle', 'portable'), { recursive: true })
await writeFile(out, zip)
console.log(`便携版已产出：${out}（${Math.round(zip.length / 1024)}KB）`)
console.log('解开即用：双击 MioNovel.exe 启动，数据落在旁边的 data\\；C 盘不写任何文件（前提：系统已有 WebView2 运行时，Win10/11 自带）')
