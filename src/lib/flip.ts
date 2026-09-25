/**
 * FLIP 动画的「I」（Invert）。
 *
 * FLIP = First・Last・Invert・Play：先量触发按钮的位置（First），把弹窗摆到
 * 最终位置量一次（Last），然后**反着**算一步 transform——让弹窗在这一步上
 * 看起来正好落在按钮上（Invert），再把这步 transform 动画归零（Play）。
 * 这里只管 Invert 那一步的算术：输入「终点矩形」和「出发点矩形」，输出位移与
 * 缩放。怎么播（时长、缓动、卸载时机）是 Motion（AnimatePresence）的事。
 *
 * 出发点是 null（快捷键开的）时不做位移，只留一点居中缩放——「从中间弹出」。
 */

export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

/** 位移 + 缩放：套在终点上，就回到了出发点 */
export interface FlipStep {
  dx: number
  dy: number
  sx: number
  sy: number
}

/** 快捷键（无出发点）那一档的起始缩放。整块轻微放大着进场，不抢戏 */
export const CENTER_SCALE = 0.92

/** 触发器可能小到几像素，比例别算成 0——0 会让矩阵不可逆，动画直接跳帧 */
const MIN_SCALE = 0.04

/** 中心对中心、边对边的反演。纯算术，verify 有断言 */
export function flipStep(to: FlipRect, from: FlipRect): FlipStep {
  return {
    dx: from.left + from.width / 2 - (to.left + to.width / 2),
    dy: from.top + from.height / 2 - (to.top + to.height / 2),
    sx: Math.max(from.width / to.width, MIN_SCALE),
    sy: Math.max(from.height / to.height, MIN_SCALE),
  }
}
