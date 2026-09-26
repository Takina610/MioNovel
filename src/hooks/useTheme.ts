import { useEffect } from 'react'
import { applyTheme, chromeOf, getTheme, installThemeSheet } from '../themes/apply'
import type { ReaderTheme, ThemeChrome } from '../themes/types'
import { desktopInvoke, isDesktop, isMiniWindow } from '../lib/desktop'
import { useSettings } from '../store/settings'

/**
 * 桌面端把原生标题栏的收放跟住**这一次应用的主题**：非常规主题（七套外壳
 * 形态）收掉原生标题栏——最小化 / 最大化 / 关闭挪进外壳顶栏
 * （ui/WindowControls）；普通阅读形态还原带边的窗口。小窗不走这里
 * （它天生无框，且这命令只认主窗口）。
 *
 * 放在应用主题的地方而不是用一个观察器去盯 DOM 属性：同一次提交里
 * 「新挂载的组件读属性、effect 写属性」的先后在 StrictMode 下对不上，
 * 观察器会错过唯一一次变化（踩过）。主题在哪应用，命令就在哪推。
 */
function syncWindowDecorations(theme: ReaderTheme): void {
  if (!isDesktop() || isMiniWindow()) return
  void desktopInvoke('set_decorations', { visible: chromeOf(theme) === 'plain' })
}

/**
 * 应用全局主题。
 *
 * 全流程只有三步：启动时把主题注册表编译成一张样式表，
 * 之后每次换主题就是改 documentElement 上的一个 data-theme 属性。
 * 组件里没有任何一处需要知道当前是什么主题。
 */
export function useGlobalTheme(): void {
  const themeId = useSettings((state) => state.global.themeId)

  useEffect(() => {
    installThemeSheet()
  }, [])

  useEffect(() => {
    const theme = getTheme(themeId)
    applyTheme(theme)
    syncWindowDecorations(theme)
  }, [themeId])
}

/** 阅读器里用：某本书可能开了独立主题，离开时要还原成全局的 */
export function useScopedTheme(themeId: string, fallbackThemeId: string): void {
  useEffect(() => {
    const theme = getTheme(themeId)
    applyTheme(theme)
    syncWindowDecorations(theme)
    return () => {
      const fallback = getTheme(fallbackThemeId)
      applyTheme(fallback)
      syncWindowDecorations(fallback)
    }
  }, [themeId, fallbackThemeId])
}

/**
 * 全局主题的界面形态。是 plain 还是 code 由主题自己声明（见 themes/types.ts），
 * 组件只认这两个值，不认主题 id——再加一套编辑器主题时，外壳不用改。
 *
 * 阅读器里要读**这本书生效的**主题，所以那边直接用 chromeOf(getTheme(settings.themeId))，
 * 不走这个 hook。
 */
export function useChrome(): ThemeChrome {
  const themeId = useSettings((state) => state.global.themeId)
  return chromeOf(getTheme(themeId))
}

/**
 * 自定义 CSS 逃生口。
 * 想微调主题（改背景图、换个强调色、调段落间距）不用改代码，写进这里就生效。
 */
export function useUserCss(css: string): void {
  useEffect(() => {
    let style = document.getElementById('mn-user-css') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'mn-user-css'
      document.head.appendChild(style)
    }
    style.textContent = css
    return () => {
      if (style) style.textContent = ''
    }
  }, [css])
}
