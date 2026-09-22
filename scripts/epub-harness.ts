/**
 * EPUB 解析的测试外壳：把解析器的 sink 接口收成一个「一次性返回全部结果」的函数。
 * 单独一个文件是因为 verify-epub.ts 必须在设置好 DOM 之后才能 import 解析器，
 * 而 import 语句会被提升——动态 import 的目标放在这里最干净。
 */
import { epubParser } from '../src/parsers/epub/parse'
import type { ChapterResource, ParsedChapter, ParsedHead } from '../src/parsers/types'

export interface EpubTestResult {
  head: ParsedHead
  chapters: ParsedChapter[]
  resources: ChapterResource[]
  progress: number[]
}

export async function parseEpubForTest(file: File): Promise<EpubTestResult> {
  const chapters: ParsedChapter[] = []
  const resources: ChapterResource[] = []
  const progress: number[] = []

  const head = await epubParser.parse(
    file,
    {
      onProgress: (ratio) => progress.push(ratio),
      onChapter: (chapter) => {
        chapters.push(chapter)
      },
      onResource: (resource) => {
        resources.push(resource)
      },
    },
    {},
  )

  return { head, chapters, resources, progress }
}
