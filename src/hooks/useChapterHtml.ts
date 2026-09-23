import { useEffect, useState } from 'react'
import { loadResourceUrls } from '../db/books'
import type { ChapterRecord } from '../db/db'

/** 抽出章节 HTML 里引用到的资源路径（mnres:// 协议） */
export function extractResourcePaths(html: string): string[] {
  const paths = new Set<string>()
  const pattern = /mnres:\/\/([^"'\s)]+)/g
  let match = pattern.exec(html)
  while (match) {
    paths.add(match[1])
    match = pattern.exec(html)
  }
  return [...paths]
}

/**
 * 章节 HTML → 可渲染的 HTML。
 *
 * 图片在库里是以 Blob 存的，渲染时才换成 ObjectURL，离开本章就 revoke。
 * 这样打开一章完全不用碰 epub 原文件，内存占用也只跟当前章有关，
 * 跟书有多大无关。
 *
 * 返回的 key 是「当前这份 HTML 属于哪一章」。换章时新 HTML 要等图片资源就位
 * 才拿得到，期间 html 还是上一章那份——阅读器必须知道这一点，否则会拿旧内容
 * 去量页、算位置（症状：翻到上一章时先闪一下本章末尾）。
 */
export function useChapterHtml(
  bookId: string | undefined,
  chapter: ChapterRecord | null | undefined,
): { html: string; key: string } {
  const [state, setState] = useState<{ html: string; key: string }>({ html: '', key: '' })

  useEffect(() => {
    const raw = chapter?.html ?? ''
    const key = bookId && chapter ? `${bookId}:${chapter.index}` : ''
    if (!bookId || !raw) {
      setState({ html: '', key })
      return
    }

    const paths = extractResourcePaths(raw)
    if (paths.length === 0) {
      setState({ html: raw, key })
      return
    }

    let cancelled = false
    let created: string[] = []

    void (async () => {
      const urls = await loadResourceUrls(bookId, paths)
      if (cancelled) {
        urls.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      created = [...urls.values()]
      let next = raw
      for (const [path, url] of urls) {
        next = next.split(`mnres://${path}`).join(url)
      }
      setState({ html: next, key })
    })()

    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [bookId, chapter])

  return state
}
