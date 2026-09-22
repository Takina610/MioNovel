/**
 * EPUB 内部路径解析。
 *
 * 不用 Node 的 path：浏览器里没有它，而且 EPUB 里的 href 是 URL 语义不是文件系统语义
 * （要处理 %20 转义、#fragment、以及 ../ 这种相对引用）。
 * zip 里的条目名统一用不带前导斜杠的 POSIX 风格路径，作为 resources 表的主键。
 */

/** 把相对 href 解析成 zip 内的绝对路径。外部链接（http: / data: 等）返回 '' */
export function resolvePath(baseDir: string, href: string): string {
  const withoutFragment = href.split('#')[0]
  if (!withoutFragment) return ''

  const decoded = safeDecode(withoutFragment)
  // 外部资源不归我们管，交给调用方原样保留
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return ''
  if (decoded.startsWith('//')) return ''

  const path = decoded.startsWith('/') ? decoded.slice(1) : baseDir + decoded
  return normalize(path)
}

function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join('/')
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // 有些书里的 href 本来就是没转义的空格或百分号，解不开就原样用
    return value
  }
}

/** 取路径所在的目录（以 / 结尾）。空串表示在 zip 根目录 */
export function dirOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index < 0 ? '' : path.slice(0, index + 1)
}

/** 只取 fragment（# 后面的部分），没有就返回 '' */
export function fragmentOf(href: string): string {
  const index = href.indexOf('#')
  return index < 0 ? '' : href.slice(index + 1)
}

export function extOf(path: string): string {
  const match = path.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

export function guessImageType(path: string): string | null {
  return IMAGE_TYPES[extOf(path)] ?? null
}
