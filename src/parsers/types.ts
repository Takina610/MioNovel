export type BookFormat = 'txt' | 'epub'

/** 归一化后的一章。TXT 和 EPUB 都产出这个形状，阅读器只认它。 */
export interface ParsedChapter {
  index: number
  /** 章标题。目录抽屉和底部栏用；TXT 的标题同时也会出现在正文里 */
  title: string
  /** 已净化的 HTML 片段。书籍自带的样式在这里已经被剥掉，
   *  图片路径已重写成 mnres:// 内部协议（渲染时换成 ObjectURL） */
  html: string
  /** 非空白字符数，算阅读进度用 */
  charCount: number
  /** 目录里的层级。卷里的章是 1，直接挂在根下的是 0。目录抽屉按它缩进 */
  depth: number
}

/**
 * 不是章节的目录分组节点（卷 / 部 / 篇）。
 *
 * 为什么不把整份目录都塞进来：章节标题已经在 chapters 表里，
 * 层级也记在 ChapterRecord.depth 上，目录抽屉读章节表就够了。
 * 这里只留「没有对应章节」的分组节点，几百条目录项因此不会变成几百条冗余数据。
 */
export interface TocGroup {
  label: string
  /** 这个分组从哪一章开始 */
  chapterIndex: number
  depth: number
}

export interface ParsedMeta {
  title: string
  author: string
  format: BookFormat
  cover?: Blob
  language?: string
  publisher?: string
  identifier?: string
  /** TXT：实际使用的编码标签（如 gb18030），存进书里便于下次直接用 */
  charset?: string
  /** 给用户看的一句解析说明，例如「未检测到章节标记，已按约 3000 字分段」 */
  note?: string
}

export interface ParsedHead {
  meta: ParsedMeta
  /** 卷/部这类分组节点（可能为空） */
  groups: TocGroup[]
  chapterCount: number
  totalChars: number
  /** 每章起始位置的非空白字符数前缀和。有它，全书百分比是 O(1) */
  charOffsets: number[]
}

export interface ChapterResource {
  /** zip 内的绝对路径 */
  path: string
  blob: Blob
  type: string
}

/**
 * 解析器往外交付内容的出口。
 *
 * 章节通过 onChapter 逐章交出去，解析器自己不保留全书：
 * 30MB 的 txt 这么做峰值内存只是「单章 + 一个解码缓冲」，
 * 而不是「整串文本 + 整个行数组 + 整个 HTML 字符串」。
 */
export interface ParseSink {
  /** ratio 0-1；note 是给用户看的当前动作 */
  onProgress: (ratio: number, note?: string) => void
  onChapter: (chapter: ParsedChapter) => Promise<void> | void
  /** EPUB 抽出来的图片。txt 没有资源，可以不实现 */
  onResource?: (resource: ChapterResource) => Promise<void> | void
}

export interface ParseOptions {
  /** 手动指定的编码标签（TXT）。不传则自动检测 */
  charset?: string
  /** 分章规则覆盖（TXT）。不传则自动探测，见 parsers/txt/chapters.ts */
  rule?: string
  signal?: AbortSignal
}

export interface BookParser {
  format: BookFormat
  /** 看文件头判断能不能吃。不信后缀——后缀错的文件比你想象的多 */
  detect: (head: Uint8Array, fileName: string) => boolean
  parse: (file: File, sink: ParseSink, options: ParseOptions) => Promise<ParsedHead>
  /** 便宜的先看一眼：编码、将采用的规则、前几个章标题。导入弹窗用它让用户确认 */
  probe: (file: File, options: ParseOptions) => Promise<FileProbe>
}

export interface FileProbe {
  format: BookFormat
  /** TXT：检测到的编码 */
  charset?: string
  /** TXT：自动选中的分章规则 id */
  rule?: string
  /** 前几个识别到的章标题——给用户一个「它认对了没有」的凭据 */
  titles: string[]
  /** 需要提醒用户的事（编码置信度低、找不到章节标记…） */
  warning?: string
}
