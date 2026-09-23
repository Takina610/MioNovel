import type { ReactNode, SVGProps } from 'react'

/**
 * 图标。
 *
 * 全部手写内联 SVG，不加图标库：这个应用只用到十来个记号，一个依赖换十来个
 * path 不划算，而且图标库的线条粗细、端点风格各不相同，混着用一眼就看得出来。
 *
 * 统一规格：24 格画布、1.75 描边、圆头圆角、颜色跟 currentColor。
 * 尺寸由调用方用工具类给（`h-4 w-4`），默认不写死大小。
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** 回书架（左箭头） */
export function IconBack(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  )
}

/** 下拉箭头的那个尖。展开时由调用方转 180° */
export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </Svg>
  )
}

/** 目录 */
export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </Svg>
  )
}

/** 阅读设置（三个滑杆） */
export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="9" cy="7" r="2.1" />
      <circle cx="15" cy="12" r="2.1" />
      <circle cx="7.5" cy="17" r="2.1" />
    </Svg>
  )
}

/** 导入（箭头落进托盘） */
export function IconImport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5" />
    </Svg>
  )
}

/** 更多操作 */
export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 排序（两个方向的箭头） */
export function IconSort(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 20V5" />
      <path d="m4 8 3-3 3 3" />
      <path d="M17 4v15" />
      <path d="m14 16 3 3 3-3" />
    </Svg>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8v.4" />
    </Svg>
  )
}

/** 加载中的那一段圆弧，配 .mn-spin 用 */
export function IconSpinner(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </Svg>
  )
}
