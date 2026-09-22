import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// 从一张 public/logo.svg 生成全套图标（192/512/maskable/apple-touch）。
// 用法：bun run icons
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
