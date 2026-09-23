import { useEffect, useState } from 'react'

/**
 * 封面 Blob → ObjectURL，卸载时释放。
 * 封面在库里存的是缩略图（≤400px），几十 KB 一张，但每张卡一个 URL 也要记得还。
 */
export function useCoverUrl(cover: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!cover) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(cover)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [cover])

  return url
}
