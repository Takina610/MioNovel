import { createBrowserRouter } from 'react-router'
// RouterProvider 从 react-router/dom 引：它比 react-router 那份多接一个 ReactDOM.flushSync，
// 换页过渡（navigate 的 viewTransition）要求新页面在同一帧里提交，少了它过渡会拍错快照。
// 浏览器端本来就该用这个入口。
import { RouterProvider } from 'react-router/dom'
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
