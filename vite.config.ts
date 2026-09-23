import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 页面用 URL 直接引、不经打包器的静态资源，要点名才会进预缓存。
      // MioNovel.png 刻意不在名单里，下面还有一条 globIgnores 把它挡在预缓存外：
      // 187KB 的原图只服务图标生成（bun run icons），运行时用的是派生小图。
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'logo-64.png',
        'logo-192.png',
      ],
      manifest: {
        name: 'MioNovel',
        short_name: 'MioNovel',
        description: '本地优先的小说阅读器：导入自己的 txt / epub，离线也能读',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 这里的颜色只是安装那一刻的初始值。运行时会跟着主题改
        // <meta name="theme-color">，见 src/themes/apply.ts。
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 只预缓存 app 外壳。书在 IndexedDB 里，不该也不必要进缓存清单——
        // 这也是离线能读的原因：SW 负责让页面起得来，数据本来就在本地。
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 标识原图不进预缓存：它只在重新生成图标时用得到，运行时用的是 logo-64/192
        globIgnores: ['**/MioNovel.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      // 开发时开 SW 会让「改了没生效」变成常态，默认关掉，需要验证离线时再开。
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5179,
  },
})
