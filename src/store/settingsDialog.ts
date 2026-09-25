import { create } from 'zustand'
import type { FlipRect } from '../lib/flip'

/**
 * 阅读设置弹窗的全局开合。
 *
 * 之前的设置面板是每页一份 `useState`：按钮、菜单、快捷键各写各的，谁开谁关
 * 都对得上，但「弹窗要从哪个按钮长出来」这件事单靠一个 boolean 说不清。
 * 所以开合提到一个全局 store：**不管从哪个形态的哪个按钮开，走的都是同一个入口**，
 * 出发点也在这里一起定——
 *
 * - 点按钮开的（标题栏齿轮、菜单项、状态栏……）：出发点就是刚按下去的那个元素，
 *   弹窗从它的位置长出来，关闭时缩回去。触发点分散在几十个回调里（很多还穿过了
 *   几层 `() => void` 的回调），一个一个把元素传出来不现实；好在浏览器本来就会
 *   在按下时派发 `pointerdown`，模块装载时挂一个 capture 监听把「最后一个被按下
 *   的元素」连同它的矩形记下来，开弹窗时取最新的那份就是了。
 * - 快捷键开的（S）：没有按钮，从屏幕中间弹出、向中间缩回。
 */

/** 出发点矩形。视口坐标（弹窗是 fixed 的，两套坐标直接对得上） */
export type OriginRect = FlipRect

interface SettingsDialogState {
  open: boolean
  /** 这次打开定下的出发点。null = 快捷键开的，从中间 */
  origin: OriginRect | null
  /**
   * 关闭时无视出发点、直接向屏幕中间缩回。给「换主题」用的：主题一换整个外壳
   * 都换掉了，原来的触发按钮多半已经不在，缩回按钮反而是错的
   */
  exitCenter: boolean
}

export const useSettingsDialog = create<SettingsDialogState>(() => ({
  open: false,
  origin: null,
  exitCenter: false,
}))

/** 指针按下到开弹窗之间的窗口。点击事件紧跟着按下派发，这个余量已经很宽 */
const PRESS_WINDOW = 500

/** 最后一次按下的元素与其矩形快照。矩形在按下那一刻量——菜单项点了就卸载，事后量不到 */
let press: { el: Element; rect: OriginRect | null; at: number } | null = null
/** 这次打开的出发点元素。关闭动画前再量一次，滚动过的按钮也能缩回当前位置 */
let originEl: Element | null = null

/** 元素的视口矩形；量不到（没挂载、零尺寸的 body 之类）返回 null */
export function rectOf(el: Element | null | undefined): OriginRect | null {
  if (!el || !el.isConnected) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/** 记一次按下。监听器调用它，verify 也用它喂假元素 */
export function notePress(el: Element, at = performance.now()): void {
  press = { el, rect: rectOf(el), at }
}

if (typeof window !== 'undefined') {
  // capture：就算哪里的 handler 把事件 stopPropagation 了，按下这件事也发生过
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.target instanceof Element) notePress(event.target)
    },
    true,
  )
}

/** 焦点所在的真元素（键盘激活按钮时没有 pointerdown，从它兜底） */
function focusedRect(): { el: Element; rect: OriginRect } | null {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return null
  const rect = rectOf(active)
  return rect ? { el: active, rect } : null
}

/** 点按钮开：出发点是刚按下的那个元素，次选焦点元素，都没有就居中 */
export function openSettingsDialog(): void {
  const now = performance.now()
  const fromPress = press && now - press.at <= PRESS_WINDOW ? press : null
  const found =
    fromPress && fromPress.rect ? { el: fromPress.el, rect: fromPress.rect } : focusedRect()
  originEl = found?.el ?? null
  useSettingsDialog.setState({ open: true, origin: found?.rect ?? null, exitCenter: false })
}

/** 快捷键开：没有出发点，从中间 */
export function openSettingsCentered(): void {
  originEl = null
  useSettingsDialog.setState({ open: true, origin: null, exitCenter: false })
}

export function closeSettingsDialog(): void {
  useSettingsDialog.setState({ open: false })
}

/** 关闭并直接向屏幕中间缩回（换主题后外壳都换了，出发点已经没有意义） */
export function closeSettingsToCenter(): void {
  useSettingsDialog.setState({ open: false, exitCenter: true })
}

/** 快捷键的 S 是「切一下」：开着就关（缩回出发点），关着就从中间开 */
export function toggleSettingsFromHotkey(): void {
  if (useSettingsDialog.getState().open) closeSettingsDialog()
  else openSettingsCentered()
}

/**
 * 出发点现在的位置。出发点元素还挂着就现量（开着的这段时间里页面可能滚过），
 * 量不到（菜单项早就卸载了）退回打开时存的快照。
 */
export function originRectNow(): OriginRect | null {
  return rectOf(originEl) ?? useSettingsDialog.getState().origin
}
