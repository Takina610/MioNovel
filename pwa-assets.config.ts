import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// 从 public/MioNovel.png（站点标识原图）生成全套图标：
// favicon.ico / favicon.svg / apple-touch-icon-180x180.png / pwa-192x192.png /
// pwa-512x512.png / maskable-icon-512x512.png / pwa-64x64.png。
// 用法：bun run icons
//
// 页面里用的小图（logo-64 / logo-192）不在这里——那是给界面显示的，由 `bun run logo`
// 从同一张原图派生，两件事别混在一起。
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/MioNovel.png'],
})
