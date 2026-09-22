/**
 * 目录解析：EPUB3 的 nav.xhtml 和 EPUB2 的 toc.ncx 都要认。
 * 两种格式只在这里分叉，出去之后都是同一个 RawTocEntry 列表。
 */
import { childElement, findAll, findFirst, localName, parseXml, textOf } from './opf'
import { fragmentOf, resolvePath } from './paths'

/** 还没和 spine 对齐的目录项 */
export interface RawTocEntry {
  label: string
  /** 解析后的 zip 内路径。空表示只指到一个 fragment（同文档锚点） */
  path: string
  fragment: string
  depth: number
}

const OPS_NS = 'http://www.idpf.org/2007/ops'

/** epub:type 这类带命名空间的属性，三种写法都试一遍 */
function attrNs(el: Element | null, name: string): string {
  if (!el) return ''
  return (
    el.getAttributeNS(OPS_NS, name) ??
    el.getAttribute(`epub:${name}`) ??
    el.getAttribute(name) ??
    ''
  )
}

export function parseNav(navHtml: string, navPath: string): RawTocEntry[] {
  const doc = parseXml(navHtml, 'application/xhtml+xml') ?? parseXml(navHtml, 'text/html')
  if (!doc) return []
  const baseDir = navPath.slice(0, navPath.lastIndexOf('/') + 1)

  const navs = findAll(doc, 'nav')
  // 优先取 epub:type="toc" 的那个；没有就退回第一个 nav
  let nav = navs.find((el) => attrNs(el, 'type').split(/\s+/).includes('toc'))
  if (!nav) nav = navs[0] ?? null

  const ol = nav ? findFirst(nav, 'ol') : null
  if (!ol) return []

  const out: RawTocEntry[] = []
  walkList(ol, 0, baseDir, out)
  return out
}

function walkList(ol: Element, depth: number, baseDir: string, out: RawTocEntry[]): void {
  for (const li of Array.from(ol.children)) {
    if (localName(li) !== 'li') continue

    // 标签可能在 a 里，也可能是个不带链接的 span（分组标题）
    const labelEl =
      Array.from(li.children).find((el) => ['a', 'span'].includes(localName(el))) ??
      findFirst(li, 'a') ??
      findFirst(li, 'span')

    const nested = childElement(li, 'ol')
    if (labelEl) {
      const label = textOf(labelEl)
      const href = labelEl.getAttribute('href') ?? ''
      if (label) {
        out.push({
          label,
          path: href ? resolvePath(baseDir, href) : '',
          fragment: fragmentOf(href),
          depth,
        })
      }
    }
    if (nested) walkList(nested, depth + 1, baseDir, out)
  }
}

export function parseNcx(ncxXml: string, ncxPath: string): RawTocEntry[] {
  const doc = parseXml(ncxXml)
  if (!doc) return []
  const baseDir = ncxPath.slice(0, ncxPath.lastIndexOf('/') + 1)

  const navMap = findFirst(doc, 'navMap')
  if (!navMap) return []

  const out: RawTocEntry[] = []
  walkNavPoints(navMap, 0, baseDir, out)
  return out
}

function walkNavPoints(parent: Element, depth: number, baseDir: string, out: RawTocEntry[]): void {
  for (const navPoint of Array.from(parent.children)) {
    if (localName(navPoint) !== 'navpoint') continue

    const label = textOf(findFirst(navPoint, 'navlabel')) || textOf(findFirst(navPoint, 'text'))
    // content 必须取 navPoint 自己的直接子元素，否则会串到子 navPoint 的 content 上
    const content = childElement(navPoint, 'content')
    const src = content?.getAttribute('src') ?? ''

    if (label) {
      out.push({
        label,
        path: src ? resolvePath(baseDir, src) : '',
        fragment: fragmentOf(src),
        depth,
      })
    }
    walkNavPoints(navPoint, depth + 1, baseDir, out)
  }
}
