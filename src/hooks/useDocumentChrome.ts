import { useEffect } from 'react'
import { decoyFavicon } from '../lib/decoy'
import { useDecoy } from '../store/decoy'
import { useChrome } from './useTheme'

/**
 * 浏览器标签页上的文字。
 *
 * 编辑器形态下窗口标题就是「文件 — 项目 — 程序」，浏览器标签页跟着它走；
 * 演示模式下外面传进来的已经是假标题，所以这里不用再判断一次。
 * 卸载时还原：普通形态的页面不设标题，标签页应该回到 index.html 里那个。
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

/**
 * 浏览器标签页上的图标。
 *
 * 只在演示模式下换成语言色的小方块——小说应用配一个「TS」图标，
 * 是老板扫一眼标签栏就能发现的那种破绽。退出时还原原图的 href。
 */
export function useDecoyFavicon(): void {
  const enabled = useDecoy((state) => state.enabled)
  const preset = useDecoy((state) => state.preset)
  const chrome = useChrome()
  const active = enabled && chrome === 'code'

  useEffect(() => {
    if (!active) return
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]'),
    )
    const previous = links.map((link) => link.getAttribute('href'))
    const href = decoyFavicon(preset)
    links.forEach((link) => link.setAttribute('href', href))
    return () => {
      links.forEach((link, index) => {
        const original = previous[index]
        if (original) link.setAttribute('href', original)
      })
    }
  }, [active, preset])
}
