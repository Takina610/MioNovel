/**
 * 桌面壳（Tauri）的检测与通道。
 *
 * 规矩不变：数据与文件不经过任何 Tauri API——书走 IndexedDB、文件走
 * WebView2 的原生 File 对象。唯一的例外是小窗模式：窗口的显隐、置顶、
 * 系统级快捷键只有壳管得了，前端只把设置通过 mini_apply 推给壳、每 500ms
 * 扫一眼快捷键标志（mini_take_toggle，见 hooks/useMiniWindow）。这里走的是
 * app.withGlobalTauri 注入的 window.__TAURI__（**不引** @tauri-apps/api 包），
 * 浏览器里这些函数全部静默不动作——同一份前端在 PWA 里照常跑。
 */

interface TauriGlobal {
  core: {
    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
  }
}

declare global {
  interface Window {
    /** app.withGlobalTauri 注入的 API。浏览器里没有 */
    __TAURI__?: TauriGlobal
    /** 小窗窗口由壳在创建时注入（src-tauri/src/mini.rs 的 initialization_script） */
    __MN_MINI__?: boolean
    /** 小窗挂给壳的主题注入入口（src-tauri/src/mini.rs 的 push_theme） */
    __MN_APPLY_THEME__?: (themeId: string) => void
    /** 建窗时壳注入的当前全局主题 id（initialization_script） */
    __MN_THEME__?: string
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined
}

/** 这个窗口是小窗本体（同一份前端的第二次装载，见 main.tsx 的分支） */
export function isMiniWindow(): boolean {
  return typeof window !== 'undefined' && window.__MN_MINI__ === true
}

/** 调壳上的命令。非桌面环境 / 调用失败都返回 null，调用方按「没这回事」处理 */
export async function desktopInvoke<T = void>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  const api = typeof window === 'undefined' ? undefined : window.__TAURI__
  if (!api) return null
  try {
    return (await api.core.invoke(cmd, args)) as T
  } catch (error) {
    console.warn(`[desktop] ${cmd} 失败`, error)
    return null
  }
}

