/**
 * 全屏开关。
 *
 * 浏览器里没有「窗口」这回事，能做的就是让整页独占屏幕——这也是各套外壳里
 * 那个「全屏」命令唯一诚实的实现（Web 里没有别的全屏可言）。
 */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen()
}
