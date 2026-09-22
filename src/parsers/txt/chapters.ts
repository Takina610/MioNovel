/**
 * TXT 分章。
 *
 * 判定的是「这一行是不是标题」，而不是「用一个正则把全文切开」。中文小说的标题形态
 * 太杂（第一章 / 第2回 / 卷三 / 楔子 / 番外 / 第一章 少年归），一个正则要么太松，
 * 把正文行切成章，要么太紧，漏掉整卷整篇的结构。
 *
 * 规则逐级升级，不一步到位：
 *   cn    第<数字><章节回集话>、第<数字><卷部篇辑>、序章/楔子/番外 这类固定篇名
 *   en    Chapter 1 / Part II / Prologue
 *   num   1. / 十二、      —— 这一档最危险（正文里的列表编号会被误判），
 *                            所以只在 cn/en 都找不到 3 个命中时才启用
 *   chunk 完全不靠标题，按字数分段（段落边界处切）
 *
 * 每一条都要过 isPlausibleTitle 的守卫，长度和句末标点是最有效的两个信号。
 */

export type TxtRuleId = 'auto' | 'cn' | 'en' | 'num' | 'chunk' | 'custom'

export interface TxtRuleOption {
  id: TxtRuleId
  name: string
  hint: string
}

export const TXT_RULES: TxtRuleOption[] = [
  { id: 'auto', name: '自动', hint: '依次试中文小说、英文小说、数字标题，都不像就按字数分段' },
  { id: 'cn', name: '中文小说', hint: '第一章 / 第2回 / 卷三 / 楔子 / 番外' },
  { id: 'en', name: '英文小说', hint: 'Chapter 1 / Part II / Prologue' },
  { id: 'num', name: '数字标题', hint: '1. / 十二、' },
  { id: 'chunk', name: '按字数分段', hint: '每约 3000 字一段，在段落边界处切' },
  { id: 'custom', name: '自定义正则', hint: '整行匹配的正则，命中即视为章标题' },
]

/** 自动模式下的尝试顺序。num 放最后：它的误判代价最大 */
export const AUTO_RULE_ORDER: TxtRuleId[] = ['cn', 'en', 'num']

/** 判定为「值得采用的规则」需要的命中数 */
export const RULE_HIT_THRESHOLD = 3

/** 标题的长度上限。中文书名号里的长标题也能过，正文行过不去 */
const TITLE_MAX = 40

/** 按字数分段时每段的字数 */
export const CHUNK_CHARS = 3000

/** 第一个标题之前的内容，超过这个字数就单独作为「前言」一章 */
export const PREFACE_MIN_CHARS = 200

const CN_DIGITS = '0-9０-９零〇一二三四五六七八九十百千万亿兆廿卅卌两兩壹贰叁肆伍陆柒捌玖拾佰仟萬'

/** 第 <数字> <章节单位> [标题] */
const RE_CHAPTER = new RegExp(
  `^第\\s*[${CN_DIGITS}]+\\s*[章节節回话話集](?:\\s*[、.．：:·\\-—]?\\s*.*)?$`,
)

/** 第 <数字> <卷单位> [标题]。卷和章要分开：卷是目录里的分组，不是正文的一章 */
const RE_VOLUME = new RegExp(`^第\\s*[${CN_DIGITS}]+\\s*[卷部辑輯](?:\\s*[、.．：:·\\-—]?\\s*.*)?$`)

/** 第 <数字> 篇 [标题] —— 篇/部 两可，归到卷里 */
const RE_PART = new RegExp(`^第\\s*[${CN_DIGITS}]+\\s*[篇](?:\\s*[、.．：:·\\-—]?\\s*.*)?$`)

const SPECIAL_TITLES = [
  '序章',
  '序言',
  '序幕',
  '序',
  '楔子',
  '引子',
  '引言',
  '前言',
  '题记',
  '自序',
  '代序',
  '后记',
  '後記',
  '后序',
  '後序',
  '尾声',
  '尾聲',
  '终章',
  '終章',
  '结局',
  '結局',
  '番外',
  '外传',
  '外傳',
  '附录',
  '附錄',
  '作者的话',
  '作者的話',
  '写在前面的话',
  '寫在前面的話',
  '完本感言',
  '章节目录',
  '章節目錄',
]

const RE_EN_HEAD =
  /^(chapters?|parts?|books?|volumes?|sections?|prologue|epilogue|interlude|afterword|foreword)\b/i

const EN_NUMBER_WORD =
  /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i

const RE_NUM_LINE = new RegExp(`^(\\d{1,4}|[${CN_DIGITS}]{1,8})\\s*[、.．,，：:·\\-—]\\s*(\\S.*)$`)

export type TitleKind = 'chapter' | 'volume'

export interface TitleMatch {
  title: string
  kind: TitleKind
}

/** 折叠空白：标题里的连续空格和全角空格都压成一个 */
function normalizeTitle(rawLine: string): string {
  return rawLine.replace(/[\s\u3000]+/g, ' ').trim()
}

/**
 * 标题守卫。这两条是最有效的信号：
 *   - 正文行几乎必然带「。」，标题几乎不会；
 *   - 标题不会以逗号/分号结尾（那是被截断的正文）。
 * 加长度上限兜住「短正文行碰巧长得像标题」的情况。
 */
function isPlausibleTitle(line: string): boolean {
  if (!line || line.length > TITLE_MAX) return false
  if (line.includes('。')) return false
  if (/[、，,；;]$/.test(line)) return false
  return true
}

function matchCn(line: string): TitleMatch | null {
  if (RE_VOLUME.test(line) || RE_PART.test(line)) return { title: line, kind: 'volume' }
  if (RE_CHAPTER.test(line)) return { title: line, kind: 'chapter' }
  for (const prefix of SPECIAL_TITLES) {
    if (line === prefix) return { title: line, kind: 'chapter' }
    // 「楔子 雪夜」这类，前缀之后跟少量标题文字。留 20 字是为了不把
    // 「序言部分说明了作者的写作动机」这种正文行误判成标题
    if (line.startsWith(prefix) && line.length <= prefix.length + 20) {
      return { title: line, kind: 'chapter' }
    }
  }
  return null
}

function matchEn(line: string): TitleMatch | null {
  const head = line.match(RE_EN_HEAD)
  if (!head) return null
  const keyword = head[0]
  const kind: TitleKind = /^(book|part|volume)/i.test(keyword) ? 'volume' : 'chapter'
  const rest = line.slice(keyword.length).trim()
  // "Prologue" / "Epilogue" 这类独立成篇的名字
  if (!rest) return { title: line, kind }
  // 后面必须跟编号（1 / II / One）。不加这个要求的话，
  // "The chapter was long" 这种正文行也会被判成标题
  const hasNumber =
    /^\d+\b/.test(rest) ||
    /^[IVXLCDM]{1,7}\b/.test(rest) ||
    EN_NUMBER_WORD.test(rest) ||
    /^[A-Za-z]{1,10}$/.test(rest)
  return hasNumber ? { title: line, kind } : null
}

function matchNum(line: string): TitleMatch | null {
  const match = line.match(RE_NUM_LINE)
  if (!match) return null
  // 排除小数和层级编号：3.14159、1.2.3
  if (/^\d+([.．]\d+)+$/.test(line.replace(/\s/g, ''))) return null
  return { title: line, kind: 'chapter' }
}

function matchCustom(line: string, pattern: string): TitleMatch | null {
  try {
    // 每次都重新构造 RegExp：用户改规则时不需要手动清除缓存，
    // 而且这里不在热路径上（一行一次），编译开销可以忽略
    if (new RegExp(pattern).test(line)) return { title: line, kind: 'chapter' }
  } catch {
    return null
  }
  return null
}

/**
 * 判断一行是不是标题。rule 既可以是预设 id，也可以直接是用户写的正则
 * （书里存的 txtRule 就是这么用的：不是预设 id 就当成正则）。
 */
export function matchTitle(rawLine: string, rule: string): TitleMatch | null {
  const line = normalizeTitle(rawLine)
  if (!isPlausibleTitle(line)) return null

  switch (rule) {
    case '':
    case 'auto':
    case 'chunk':
      return null
    case 'cn':
      return matchCn(line)
    case 'en':
      return matchEn(line)
    case 'num':
      return matchNum(line)
    case 'custom':
      return null
    default:
      return matchCustom(line, rule)
  }
}

/** 规则名，用于展示（自定义正则就直接显示正则本身） */
export function ruleName(rule: string | undefined): string {
  if (!rule) return '自动'
  const preset = TXT_RULES.find((item) => item.id === rule)
  return preset ? preset.name : `自定义正则 ${rule}`
}

/** 把一行正文包成段落。空行保留成一个不可见的高度，维持原文件的节奏 */
export function lineToHtml(rawLine: string): string {
  const line = rawLine.trim()
  if (!line) return '<p class="mn-blank"></p>'
  return `<p>${escapeHtml(line)}</p>`
}

/** 卷标题在正文里的样子：单独居中一行 */
export function volumeToHtml(title: string): string {
  return `<p class="mn-volume-title">${escapeHtml(title)}</p>`
}

export function chapterTitleHtml(title: string): string {
  return `<h2 class="mn-chapter-title">${escapeHtml(title)}</h2>`
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    return '&gt;'
  })
}

/** 非空白字符数。中文按字算，比 length 更接近「读了多少」 */
export function countChars(text: string): number {
  return text.replace(/\s/g, '').length
}
