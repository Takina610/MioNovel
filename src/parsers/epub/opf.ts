/**
 * OPF（包文档）解析。
 *
 * 一律按 localName 匹配元素，不看前缀也不看命名空间：真实 EPUB 里
 * `<opf:item>`、`<item>`、`<dc:title>`、`<title>` 各种写法都有，
 * getElementsByTagName 对前缀敏感，碰上就漏元素。
 */
import { dirOf, resolvePath } from './paths'

export interface ManifestItem {
  id: string
  /** OPF 里写的原始 href（可能带 %20 或 fragment） */
  href: string
  /** 相对 zip 根解析后的路径，resources 表用的就是它 */
  path: string
  /** media-type */
  type: string
  /** EPUB3 的 properties（cover-image / nav / scripted …） */
  properties: string
}

export interface SpineItem {
  idref: string
  linear: boolean
}

export interface GuideRef {
  type: string
  href: string
  path: string
}

export interface OpfMetadata {
  title: string
  author: string
  language: string
  publisher: string
  identifier: string
  description: string
}

export interface OpfData {
  opfPath: string
  opfDir: string
  metadata: OpfMetadata
  /** `<meta name="cover" content="...">` 指向的 manifest id（EPUB2 的封面写法） */
  coverId: string
  manifest: Map<string, ManifestItem>
  /** id → manifest item，方便按 idref 取 spine 文档 */
  spine: SpineItem[]
  /** spine 里参与正文的文档路径，顺序即阅读顺序 */
  spinePaths: string[]
  guide: GuideRef[]
  /** EPUB3 的 nav 文档路径 */
  navPath: string
  /** EPUB2 的 NCX 路径（spine[toc] 指向） */
  ncxPath: string
}

export function localName(el: Element): string {
  return (el.localName || el.tagName).toLowerCase()
}

/** 按 localName 找所有后代元素。XML / HTML 解析出来的文档都能用 */
export function findAll(root: ParentNode, name: string): Element[] {
  const target = name.toLowerCase()
  const out: Element[] = []
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (localName(el) === target) out.push(el)
  }
  return out
}

export function findFirst(root: ParentNode, name: string): Element | null {
  const target = name.toLowerCase()
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (localName(el) === target) return el
  }
  return null
}

/** 只找直接子元素。spine 的 itemref、navPoint 自己的 content 都必须这样取 */
export function childElement(el: Element, name: string): Element | null {
  const target = name.toLowerCase()
  for (const item of Array.from(el.children)) {
    if (localName(item) === target) return item
  }
  return null
}

export function attr(el: Element | null | undefined, name: string): string {
  if (!el) return ''
  return el.getAttribute(name) ?? ''
}

/** 元素的文字内容，折叠空白 */
export function textOf(el: Element | null | undefined): string {
  if (!el) return ''
  return (el.textContent ?? '').replace(/[\s\u3000]+/g, ' ').trim()
}

/** 从 META-INF/container.xml 里取 OPF 路径 */
export function parseContainer(xml: string): string | null {
  const doc = parseXml(xml)
  if (!doc) return null
  const rootfile = findFirst(doc, 'rootfile')
  const path = attr(rootfile, 'full-path')
  return path || null
}

/**
 * OPF / NCX / nav 都是 XML，但真实文件经常不合法（未声明命名空间、标签不闭合）。
 * 先按 XML 解，失败就退回 HTML 解析——HTML 解析器宽容得多，能救回大部分脏文件。
 */
export function parseXml(text: string, preferred: DOMParserSupportedType = 'application/xml'): Document | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, preferred)
  if (doc.getElementsByTagName('parsererror').length === 0) return doc
  const htmlDoc = parser.parseFromString(text, 'text/html')
  if (htmlDoc.getElementsByTagName('parsererror').length === 0) return htmlDoc
  return null
}

export function parseOpf(opfText: string, opfPath: string, fallbackTitle: string): OpfData {
  const doc = parseXml(opfText)
  const opfDir = dirOf(opfPath)
  const manifest = new Map<string, ManifestItem>()
  const spine: SpineItem[] = []
  const guide: GuideRef[] = []

  const metadata: OpfMetadata = {
    title: fallbackTitle,
    author: '',
    language: '',
    publisher: '',
    identifier: '',
    description: '',
  }

  let coverId = ''
  let navPath = ''
  let ncxPath = ''

  if (doc) {
    const title = textOf(findFirst(doc, 'title'))
    if (title) metadata.title = title
    metadata.author = findAll(doc, 'creator')
      .map((el) => textOf(el))
      .filter(Boolean)
      .join(' / ')
    metadata.language = textOf(findFirst(doc, 'language'))
    metadata.publisher = textOf(findFirst(doc, 'publisher'))
    metadata.identifier = textOf(findFirst(doc, 'identifier'))
    metadata.description = textOf(findFirst(doc, 'description'))

    for (const item of findAll(doc, 'item')) {
      const id = attr(item, 'id')
      const href = attr(item, 'href')
      if (!id || !href) continue
      const properties = attr(item, 'properties')
      manifest.set(id, {
        id,
        href,
        path: resolvePath(opfDir, href),
        type: attr(item, 'media-type'),
        properties,
      })
      if (properties.split(/\s+/).includes('nav')) {
        navPath = resolvePath(opfDir, href)
      }
    }

    const metaCover = findAll(doc, 'meta').find((el) => attr(el, 'name') === 'cover')
    coverId = attr(metaCover, 'content')

    const spineEl = findFirst(doc, 'spine')
    ncxPath = resolvePath(opfDir, attr(spineEl, 'toc'))
    for (const itemref of findAll(doc, 'itemref')) {
      const idref = attr(itemref, 'idref')
      if (!idref) continue
      // linear="no" 是「不在主线里」的文档（封面页、广告页），跳过
      spine.push({ idref, linear: attr(itemref, 'linear') !== 'no' })
    }

    for (const ref of findAll(doc, 'reference')) {
      const href = attr(ref, 'href')
      if (!href) continue
      guide.push({ type: attr(ref, 'type'), href, path: resolvePath(opfDir, href) })
    }
  }

  const spinePaths: string[] = []
  for (const item of spine) {
    if (!item.linear) continue
    const manifestItem = manifest.get(item.idref)
    if (manifestItem?.path) spinePaths.push(manifestItem.path)
  }

  return {
    opfPath,
    opfDir,
    metadata,
    coverId,
    manifest,
    spine,
    spinePaths,
    guide,
    navPath,
    ncxPath,
  }
}
