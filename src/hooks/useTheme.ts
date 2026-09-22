import { useEffect } from 'react'
import { applyTheme, getTheme, installThemeSheet } from '../themes/apply'
import { useSettings } from '../store/settings'

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
    applyTheme(getTheme(themeId))
  }, [themeId])
}

/** 阅读器里用：某本书可能开了独立主题，离开时要还原成全局的 */
export function useScopedTheme(themeId: string, fallbackThemeId: string): void {
  useEffect(() => {
    applyTheme(getTheme(themeId))
    return () => applyTheme(getTheme(fallbackThemeId))
  }, [themeId, fallbackThemeId])
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
