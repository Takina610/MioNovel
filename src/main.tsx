import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isMiniWindow } from './lib/desktop'
import { App } from './App'
import { MiniApp } from './mini/MiniApp'
import { cleanupStaleImports } from './db/books'
import './styles/app.css'
import './styles/content.css'
import './styles/code.css'
// 五套办公外壳的皮肤：office 是 Word/Excel/PPT 共用的框，其余各管一种形态。
// 顺序无所谓——它们的选择器都挂在各自的根类下（.mn-office / .mn-chat / …），
// 互不重叠
import './styles/office.css'
import './styles/word.css'
import './styles/excel.css'
import './styles/ppt.css'
import './styles/doc.css'
import './styles/chat.css'
import './styles/desk.css'
// 小窗（桌面端第二窗口）的几条窗口样式。选择器挂在 .mn-mini 下，
// 主窗口不受影响
import './styles/mini.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html 里缺少 #root')

// 同一份前端装两次：主窗口走路由（书架 / 阅读器），小窗只渲染自己的
// 两块界面（书架列表 + 正文）。窗口的显隐归壳管（src-tauri/src/mini.rs）
if (isMiniWindow()) {
  // 首帧前先应用壳注入的主题（initialization_script 给的永远是当前值）：
  // store 里的 themeId 走 localStorage 有跨进程延迟，直接用会闪一下旧色
  const bootTheme = window.__MN_THEME__
  if (bootTheme) {
    import('./themes/apply').then(({ applyTheme, getTheme, installThemeSheet }) => {
      installThemeSheet()
      applyTheme(getTheme(bootTheme))
    })
  }
  createRoot(container).render(
    <StrictMode>
      <MiniApp />
    </StrictMode>,
  )
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // 上一轮浏览器崩溃 / 被关掉时留下的 importing 记录，启动时收尾成 error。
  // 不阻塞渲染，它只是个后台清理。两个窗口都跑的话会各收一遍，没必要
  void cleanupStaleImports()
}
