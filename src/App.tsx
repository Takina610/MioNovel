import { createBrowserRouter, RouterProvider } from 'react-router'
import { ReaderPage } from './routes/ReaderPage'
import { ShelfPage } from './routes/ShelfPage'
import { useGlobalTheme } from './hooks/useTheme'

/**
 * 只有两个视图：书架和阅读器。
 * 用路由不是为了「路由」，是为了 /read/:bookId 这个地址本身——
 * 刷新能回到正在读的书、浏览器后退能回书架、PWA 从桌面图标进来也能直达。
 */
const router = createBrowserRouter([
  { path: '/', element: <ShelfPage /> },
  { path: '/read/:bookId', element: <ReaderPage /> },
])

export function App() {
  useGlobalTheme()
  return <RouterProvider router={router} />
}
