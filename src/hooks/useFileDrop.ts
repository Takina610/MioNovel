import { useEffect, useRef, useState } from 'react'

/**
 * 整个窗口都当拖拽区。
 *
 * 用进入/离开的计数而不是布尔值：拖过子元素时会连续触发 dragleave/dragenter，
 * 用布尔值会让提示框疯狂闪烁。
 */
export function useFileDrop(onFiles: (files: File[]) => void): boolean {
  const [active, setActive] = useState(false)
  const depth = useRef(0)
  const callback = useRef(onFiles)
  callback.current = onFiles

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current += 1
      setActive(true)
    }

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      // 不拦 dragover 的话浏览器会直接打开文件
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }

    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setActive(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) callback.current(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return active
}
