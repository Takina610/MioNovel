import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
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
