import { useEffect } from 'react'
import { desktopInvoke, isDesktop, isMiniWindow } from '../lib/desktop'
import { useSettings } from '../store/settings'

/**
 * 主窗口与桌面壳的桥：把「关闭窗口时」的选择（设置-高级）推给壳。
 *
 * 设置是唯一事实来源，壳是执行人：原生标题栏的 × 与外壳顶栏的「关闭」
 * 都按它执行（藏进托盘 / 退出程序）。小窗开着时壳会强制「藏」，那是壳的
 * 硬规矩，不归这份设置。
 *
 * 原生标题栏的收放不在这里——它跟住**应用主题的那两处**（useGlobalTheme /
 * useScopedTheme，见 hooks/useTheme 的 syncWindowDecorations），不从 DOM
 * 属性反推形态。
 *
 * 浏览器里空转（没有壳可推）。
 */
export function useDesktopShell(): void {
  const closeAction = useSettings((state) => state.closeAction)

  useEffect(() => {
    if (!isDesktop() || isMiniWindow()) return
    void desktopInvoke('set_close_action', { action: closeAction })
  }, [closeAction])
}
