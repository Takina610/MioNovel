import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { cleanupStaleImports } from './db/books'
import './styles/app.css'
import './styles/content.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html 里缺少 #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 上一轮浏览器崩溃 / 被关掉时留下的 importing 记录，启动时收尾成 error。
// 不阻塞渲染，它只是个后台清理。
void cleanupStaleImports()
