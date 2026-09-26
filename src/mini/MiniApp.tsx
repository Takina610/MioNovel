import { useEffect, useState } from 'react'
import { desktopInvoke } from '../lib/desktop'
import { applyTheme, getTheme, installThemeSheet } from '../themes/apply'
import { useGlobalTheme, useUserCss } from '../hooks/useTheme'
import { useMini } from '../store/mini'
import { useSettings } from '../store/settings'
import { MiniReader } from './MiniReader'
import { MiniShelf } from './MiniShelf'

/**
 * 小窗本体（桌面端）。主窗口之外的第二份装载：main.tsx 看到
 * `window.__MN_MINI__`（壳在创建窗口时注入）就渲染这里，不渲染路由。
 *
 * 只有两个视图：书架列表和正文。数据直接读共享的 IndexedDB——两个窗口指向
 * 同一个 WebView2 用户数据目录，主窗口里导入、删除、改进度，这里的列表
 * 跟着动（dexie 的 useLiveQuery）。
 *
 * 主题与排版沿用主窗口的设置：常规主题的令牌表在窗口加载时照样编译进
 * :root（useGlobalTheme），正文排版变量挂在 MiniReader 的容器上
 * （settingsToVars）。窗口的显隐与尺寸不归这里管——壳盯着鼠标决定 show /
 * hide（src-tauri/src/mini.rs），边缘拖拽的尺寸也由壳记着并转给主窗口
 * 持久化，这里只管内容。
 */
export function MiniApp() {
  useGlobalTheme()
  const userCss = useSettings((state) => state.global.userCss)
  useUserCss(userCss)
  // 透明度与黑纱都是小窗自己的设置（store/mini），直接落在根上
  const opacity = useMini((state) => state.opacity)
  const dim = useMini((state) => state.dim)

  const [bookId, setBookId] = useState<string | null>(null)

  // 鼠标离开就**立刻**藏：不等壳的下一拍轮询（120ms），事件驱动零延迟。
  // 轮询仍然兜底（Alt-Tab、鼠标快速甩出等收不到 mouseleave 的情况）
  useEffect(() => {
    const onLeave = () => void desktopInvoke('mini_hide_now')
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => document.documentElement.removeEventListener('mouseleave', onLeave)
  }, [])

  // 壳把全局主题 id 注进来（push_theme 的入口）：重编译令牌表 + 换
  // :root 的 data-theme，小窗立即换装
  useEffect(() => {
    window.__MN_APPLY_THEME__ = (id: string) => {
      installThemeSheet()
      applyTheme(getTheme(id))
    }
    // 页面就绪后主动要一次当前主题：建窗早期的 eval 会落在还没挂好
    // handler 的页面上被丢掉，这次主动拉取兜住「重开小窗还是旧主题」
    void desktopInvoke('mini_ready')
  }, [])

  // 主窗口改了设置（切主题、改排版）→ zustand persist 写 localStorage →
  // storage 事件广播到本窗口 → 重新读入，小窗的主题与排版即时跟随，
  // 不用重启。两窗口共享同一份 localStorage（同一个 WebView2 用户目录）
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'mionovel:settings' || event.key === 'mionovel:mini') {
        useSettings.persist.rehydrate()
        useMini.persist.rehydrate()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])


  return (
    <div className="mn-mini" style={{ opacity }}>
      {bookId ? <MiniReader bookId={bookId} onBack={() => setBookId(null)} /> : <MiniShelf onOpen={setBookId} />}
      {/* 黑纱盖在内容上、不挡点击（摸鱼模式那层纱的思路） */}
      <div aria-hidden className="mn-mini__veil" style={{ opacity: dim }} />
    </div>
  )
}
