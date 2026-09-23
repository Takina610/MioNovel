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

/**
 * 双语对照书（中日对照最常见）用 opacity 弱化次要语言的段落，比如 0.4。
 * 解析时把这个样式换成语义标记 data-mn-lang="alt"，阅读器据此做
 * 「对照 / 只看主语言 / 只看次语言」三种显示。低于阈值的透明度才算弱化，
 * 免得把 0.95 这类装饰性透明度误伤。
 */
const ALT_LANG_OPACITY = 0.7

/**
 * 锚点 id 统一加前缀。两个原因：
 *
 * 一、DOMPurify 默认开着 SANITIZE_DOM：凡是与 document / form 上的属性重名的
 * id、name 会被整个删掉——target、action、method、name、title、length 这些「普通单词」
 * 全在名单里。删掉的是脚注/注解的落点，症状是点脚注只切章、不滚到位置。
 * 这个行为只在真实 DOM 下发生（happy-dom 里 DOMPurify 是空转的），所以验收脚本看不见。
 *
 * 二、正文最终是注入我们自己文档的一段 HTML。加前缀顺带隔开了书的 id 与宿主页面的
 * 命名访问，双重保险。
 *
 * 链接侧用同一个前缀重写（同章 #x、跨章 #mnref-n:x），两边永远对得上。
 */
const ANCHOR_PREFIX = 'mn-'

/** 允许标记为次要语言的块级标签。行内的 opacity 多半是装饰，不碰 */
const ALT_LANG_BLOCKS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'li',
  'figcaption',
])

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
  if (body) {
    scrubDocument(body)
    // 赶在 DOMPurify 之前转：这样属性白名单怎么变都不影响我们拿到 xlink:href，
    // 净化器看到的已经是普通的 <img>
    convertSvgImages(body)
    // 同样要赶在 DOMPurify 之前：id 得先改名，否则重名的会被它按 DOM clobbering 删掉
    prefixAnchors(body)
  }

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
      if (filtered.css) el.setAttribute('style', filtered.css)
      else el.removeAttribute('style')
      if (filtered.altLang && ALT_LANG_BLOCKS.has(localName(el))) {
        el.setAttribute('data-mn-lang', 'alt')
      }
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
 * 「用 <svg> 包 <image> 撑满整页」是封面页和卷首插图页最爱的写法。
 * SVG 的 <image> 认 xlink:href / href 不认 src，我们的资源重写够不着它，
 * 而且没有 CSS 尺寸约束的 SVG 在多列翻页里会把版面撑爆。
 * 统一转换成 <img>（src 先放原始值，交给 rewriteResource 走同一条重写路径），
 * 顺带把空壳 svg（纯装饰图形）删掉——它的样式资源我们已经不解析了。
 */
function convertSvgImages(root: HTMLElement): void {
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const images = Array.from(svg.querySelectorAll('image'))
    const hoisted = images
      .map((image) => {
        const href =
          image.getAttribute('src') || image.getAttribute('xlink:href') || image.getAttribute('href')
        if (!href) return null
        const img = root.ownerDocument.createElement('img')
        img.setAttribute('src', href)
        return img
      })
      .filter((img): img is HTMLImageElement => img !== null)
    if (hoisted.length > 0) svg.replaceWith(...hoisted)
    else svg.remove()
  }
}

/**
 * 把书里的锚点 id 改成带前缀的，并把老式 <a name="x"> 锚点转成 id。
 * name 形式是 EPUB 2 时代的写法，浏览器里 <a name> 也能当锚点用，
 * 但它在 DOMPurify 那边更容易被当成 clobbering 删掉。
 */
function prefixAnchors(root: Element): void {
  for (const el of Array.from(root.querySelectorAll('[id], a[name]'))) {
    const id = el.getAttribute('id')
    if (id) {
      el.setAttribute('id', `${ANCHOR_PREFIX}${id}`)
      continue
    }
    const name = el.getAttribute('name')
    if (!name) continue
    el.setAttribute('id', `${ANCHOR_PREFIX}${name}`)
    el.removeAttribute('name')
  }
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

function filterStyle(value: string): { css: string; altLang: boolean } {
  const kept: string[] = []
  let altLang = false
  for (const declaration of value.split(';')) {
    const index = declaration.indexOf(':')
    if (index < 0) continue
    const prop = declaration.slice(0, index).trim().toLowerCase()
    if (!prop) continue
    const propValue = declaration.slice(index + 1).trim()
    if (!propValue) continue

    // opacity 不进白名单（它是版式），但弱化透明度是有语义的：双语对照书
    // 靠它区分主/次语言，抽出来给阅读器做显示开关
    if (prop === 'opacity') {
      const parsed = Number.parseFloat(propValue)
      if (Number.isFinite(parsed) && parsed >= 0.05 && parsed <= ALT_LANG_OPACITY) altLang = true
      continue
    }

    if (!ALLOWED_STYLE_PROPS.has(prop)) continue
    // url() 会把外部资源拉进来；尖括号是注入尝试
    if (/url\s*\(/i.test(propValue) || /[<>]/.test(propValue)) continue
    kept.push(`${prop}: ${propValue}`)
  }
  return { css: kept.join('; '), altLang }
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
    if (fragment) el.setAttribute('href', `#${ANCHOR_PREFIX}${fragment}`)
    else el.removeAttribute('href')
    return
  }

  const target = ctx.chapterIndexOf(path)
  if (target === null) {
    // 指到目录页、封面页这类不参与正文的文档，链接去掉但保留文字
    el.removeAttribute('href')
    return
  }
  el.setAttribute('href', `#mnref-${target}${fragment ? `:${ANCHOR_PREFIX}${fragment}` : ''}`)
}
