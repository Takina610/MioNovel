/** 1 万字以上按「万」显示，书架上「12345 字」远不如「1.2 万字」好扫 */
export function formatChars(count: number): string {
  if (count >= 10_000) {
    const wan = count / 10_000
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)} 万字`
  }
  return `${count} 字`
}

/** 0.37 → 37% */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%'
  return `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`

  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * 剩余阅读时间。用中文小说的常见速度算，不假装精确——
 * 它的作用只是让「这本书还有多长」有个量级感。
 */
export function formatReadingTime(chars: number): string {
  const charsPerMinute = 500
  const minutes = Math.round(chars / charsPerMinute)
  if (minutes < 1) return '不到 1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = minutes / 60
  return hours >= 10 ? `${Math.round(hours)} 小时` : `${hours.toFixed(1)} 小时`
}

/** 书名确定性渐变：同一本书永远是同一个颜色，不用为封面存图 */
const GRADIENTS: Array<[string, string]> = [
  ['#3D6FA8', '#24466B'],
  ['#A6603A', '#6E3C22'],
  ['#3E7A4E', '#24513A'],
  ['#7A5AA6', '#4A3468'],
  ['#A6445A', '#6C2437'],
  ['#4A6B7A', '#2B444F'],
  ['#8A6A2F', '#5C4418'],
  ['#5A6B3E', '#384325'],
]

export function coverGradient(seed: string): [string, string] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

/** 没有封面时用书名首字做占位 */
export function bookInitial(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return '书'
  // 中文取首字，英文取首字母
  return /^[\x00-\x7F]/.test(trimmed) ? trimmed[0].toUpperCase() : trimmed[0]
}
