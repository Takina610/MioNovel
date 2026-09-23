import { cx } from '../../lib/cx'

interface LogoProps {
  /** 显示边长（px）。图形本身不是正方形（352×367），按 contain 缩进来 */
  size?: number
  className?: string
}

/**
 * 站点标识。图源是 public/MioNovel.png（`bun run logo` 从它派生出下面这两档小图）。
 *
 * srcSet 只给小图：最大的显示尺寸是空书架上的 58px，192 已经够到 3x 屏，
 * 没必要把 187KB 的原图也列进来——它只服务图标生成，不进运行时。
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <img
      src="/logo-192.png"
      srcSet="/logo-64.png 64w, /logo-192.png 192w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={cx('shrink-0 object-contain select-none', className)}
    />
  )
}
