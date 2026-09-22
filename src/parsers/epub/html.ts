import DOMPurify from 'dompurify'
import { localName, parseXml } from './opf'
import { dirOf, fragmentOf, resolvePath } from './paths'

/**
 * 章节 HTML 的净化与重写。
 *
 * 「版式归我们，语义归书」这条原则在这里落地：
 *   - 剥掉书自带的 <style> / <link> / <script>，以及全部 class；
 *   - 内联 style 只留少数真正带语义的声明（居中、斜体、粗体）；
 *   - 图片 src 重写成 mnres:// 内部协议，渲染时再换成 ObjectURL；
 *   - 跨章链接重写成 #mnref-<章号>[:锚点]，交给阅读器拦截。
 *
 * 换来的是：一本书的排版不会再和主题打架，一套 CSS 管住所有书。
 * 代价是「图文型 EPUB 的原始版式」不保留——那需要单独的「保留原版式」开关，
 * 和统一主题互斥，留到以后单独做。
 *
 * 安全性上做两层，而且**不依赖任何单点**：
 *   1. scrubDocument()：我们自己删危险标签、on* 事件属性、危险协议。它只依赖
 *      标准 DOM 接口，任何环境下的行为都一样。
 *   2. DOMPurify：属性白名单、URL 校验、mXSS 之类的深水区交给它。
 * 之所以要第一层：内容是用 innerHTML 注入的，把「不执行脚本」完全押在第三方库
 * 按预期工作上是没必要的风险。实测也证明了这一点——DOMPurify 在某些 DOM 实现下
 * （比如 happy-dom）会静默地什么都不做，而第一层在哪儿都生效。
 */

/** 内联样式白名单。带 url() 的一律拒绝：那会把外部资源带进来 */
const ALLOWED_STYLE_PROPS = new Set([
  'text-align',
  'font-style',
  'font-weight',
  'font-variant',
  'font-variant-caps',
  'text-decoration',
  'vertical-align',
])

/**
 * 直接删掉的标签。script/iframe/object 是安全问题；
 * link/style 是书自带的版式，留着主题就统一不了；video/audio 对小说没意义，
 * 而且它们的资源我们没抽出来，留着只会是坏的。
 */
const FORBID_TAGS = new Set([
  'script',
  'style',
  'link',
  'base',
  'meta',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'noscript',
  'template',
])

/** srcset 里是一堆未解析的相对路径，留着会打出一串失败的请求 */
const FORBID_ATTR = new Set(['srcset', 'sizes', 'background', 'longdesc', 'usemap', 'ismap'])

export interface ChapterHtmlContext {
  /** 本章文件在 zip 里的路径，用于解析相对引用 */
  chapterPath: string
  /** 解析后的 zip 路径 → 归一化章节序号。跨章链接靠它换算出目标章 */
  chapterIndexOf: (path: string) => number | null
  /** 这个路径是不是我们抽出来的资源（图片） */
  isResource: (path: string) => boolean
}

export interface ChapterHtmlResult {
  html: string
  /** 本章引用到的资源路径，调用方据此决定要不要取图片 */
  resources: string[]
  /** 文档里第一个 h1-h6 的文字。TOC 缺项时拿它当章标题 */
  heading: string
}

export function transformChapterHtml(raw: string, ctx: ChapterHtmlContext): ChapterHtmlResult {
  const doc = parseXml(raw, 'application/xhtml+xml') ?? parseXml(raw, 'text/html')
  const body = doc ? (doc.body ?? doc.documentElement) : null
  if (body) scrubDocument(body)

  const cleaned = DOMPurify.sanitize(body ? body.innerHTML : raw, {
    RETURN_DOM: true,
  }) as unknown as HTMLElement

  const resources = new Set<string>()

  for (const el of Array.from(cleaned.querySelectorAll('*'))) {
    // class 一律删掉：书的 CSS 已经没了，class 是纯重量（存下来还占空间）
    el.removeAttribute('class')

    const style = el.getAttribute('style')
    if (style !== null) {
      const filtered = filterStyle(style)
      if (filtered) el.setAttribute('style', filtered)
      else el.removeAttribute('style')
    }

    const name = localName(el)
    if (name === 'img' || name === 'image') {
      rewriteResource(el, ctx, resources)
    } else if (name === 'a') {
      rewriteLink(el, ctx)
    }
  }

  return { html: cleaned.innerHTML, resources: [...resources], heading: firstHeading(cleaned) }
}

/**
 * 第一层净化：删掉危险元素和属性。
 * 只依赖标准 DOM 接口，所以在任何环境下行为都一致。
 */
function scrubDocument(root: Element): void {
  // querySelectorAll 返回的是静态列表，document 顺序。
  // 删掉父元素后再对已脱离文档的子孙调用方法是无害的。
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (FORBID_TAGS.has(localName(el))) {
      el.remove()
      continue
    }
    for (const attribute of Array.from(el.attributes)) {
      const name = attribute.name.toLowerCase()
      // on* 是内联事件处理器，直接删
      if (name.startsWith('on') || FORBID_ATTR.has(name)) {
        el.removeAttribute(attribute.name)
      }
    }
  }
}

function firstHeading(root: Element): string {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const name = localName(el)
    if (name === 'h1' || name === 'h2' || name === 'h3' || name === 'h4') {
      const text = (el.textContent ?? '').replace(/[\s\u3000]+/g, ' ').trim()
      if (text) return text.slice(0, 60)
    }
  }
  return ''
}

function filterStyle(value: string): string {
  const kept: string[] = []
  for (const declaration of value.split(';')) {
    const index = declaration.indexOf(':')
    if (index < 0) continue
    const prop = declaration.slice(0, index).trim().toLowerCase()
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue
    const propValue = declaration.slice(index + 1).trim()
    if (!propValue) continue
    // url() 会把外部资源拉进来；尖括号是注入尝试
    if (/url\s*\(/i.test(propValue) || /[<>]/.test(propValue)) continue
    kept.push(`${prop}: ${propValue}`)
  }
  return kept.join('; ')
}

function rewriteResource(el: Element, ctx: ChapterHtmlContext, out: Set<string>): void {
  const value = el.getAttribute('src')
  if (!value) return
  // 远程图和 data: 内联图原样保留（前者离线时自然取不到，后者本来就在文件里）
  if (/^(https?:|data:)/i.test(value)) return

  const path = resolvePath(dirOf(ctx.chapterPath), value)
  if (!path || !ctx.isResource(path)) {
    // 指向字体/音频之类的资源我们没抽出来，删掉属性，免得留一个坏请求
    el.removeAttribute('src')
    return
  }
  out.add(path)
  el.setAttribute('src', `mnres://${path}`)
}

function rewriteLink(el: Element, ctx: ChapterHtmlContext): void {
  const href = el.getAttribute('href')
  if (!href) return

  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    el.setAttribute('rel', 'noreferrer')
    return
  }

  const fragment = fragmentOf(href)
  const path = resolvePath(dirOf(ctx.chapterPath), href)

  // 同章锚点：注解、脚注最常见的形式，直接留 #fragment
  if (!path || path === ctx.chapterPath) {
    if (fragment) el.setAttribute('href', `#${fragment}`)
    else el.removeAttribute('href')
    return
  }

  const target = ctx.chapterIndexOf(path)
  if (target === null) {
    // 指到目录页、封面页这类不参与正文的文档，链接去掉但保留文字
    el.removeAttribute('href')
    return
  }
  el.setAttribute('href', `#mnref-${target}${fragment ? `:${fragment}` : ''}`)
}
