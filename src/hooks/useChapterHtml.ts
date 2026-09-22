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
 */
export function useChapterHtml(
  bookId: string | undefined,
  chapter: ChapterRecord | null | undefined,
): string {
  const [html, setHtml] = useState('')

  useEffect(() => {
    const raw = chapter?.html ?? ''
    if (!bookId || !raw) {
      setHtml('')
      return
    }

    const paths = extractResourcePaths(raw)
    if (paths.length === 0) {
      setHtml(raw)
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
      setHtml(next)
    })()

    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [bookId, chapter])

  return html
}
