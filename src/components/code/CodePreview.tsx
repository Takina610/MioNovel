import { useEffect, useMemo, useRef, useState } from 'react'
import type { BookRecord } from '../../db/db'
import { saveProgress } from '../../db/books'
import { useChapter } from '../../hooks/useChapter'
import { useChapterHtml } from '../../hooks/useChapterHtml'
import { decorateChapterHtml } from '../../lib/code'
import { clamp01 } from '../../lib/progress'
import { ensureHighlighter, highlighterReady } from '../../lib/highlight'
import { useDecoy } from '../../store/decoy'
import { settingsToVars, useSettings } from '../../store/settings'
import { Minimap } from './Minimap'

interface CodePreviewProps {
  book: BookRecord
  /** 预览哪一章：接着上次读到的地方 */
  chapterIndex: number
  /** 章内位置变了（0-1）。外层拿它算全书百分比、画状态栏那条线 */
  onRatio?: (ratio: number) => void
  /** 这一章的标识（decoySeed）。目录树、标签页、正文三处要用同一个 */
  decoySeedValue?: string
}

/**
 * 编辑区的正文预览。
 *
 * 这是只读预览——脚注跳转、目录抽屉这类在阅读器里。预览做两件事：
 * 打开就能看见字，而且看见的是「一份文件」而不是封面；读到哪儿往库里存，
 * 所以在这里往下滚一段、再进阅读器，位置是接着的。
 */
export function CodePreview({ book, chapterIndex, onRatio, decoySeedValue }: CodePreviewProps) {
  const settings = useSettings((state) => state.global)
  const decoyOn = useDecoy((state) => state.enabled)
  const decoyId = useDecoy((state) => state.preset)
  const decoy = decoyOn ? decoyId : null
  // 高亮器是按需加载的：加载完重画一次（见 lib/highlight.ts）
  const [painted, setPainted] = useState(highlighterReady)
  useEffect(() => {
    if (!decoy) return
    let alive = true
    void ensureHighlighter().then(() => {
      if (alive) setPainted(true)
    })
    return () => {
      alive = false
    }
  }, [decoy])
  const chapter = useChapter(book.id, chapterIndex)
  const { html, resources } = useChapterHtml(book.id, chapter)
  const decorated = useMemo(
    () =>
      decorateChapterHtml(html, {
        resolve: (src) => resources.get(src),
        decoy,
        seed: decoySeedValue,
      }),
    // painted 进依赖：高亮器加载完之后重画一遍，代码才是有颜色的
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html, resources, decoy, decoySeedValue, painted],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const [ratio, setRatio] = useState(0)
  // 滚动时把当前值也交给外层（限流到一帧一次），状态栏那条线才有得画
  const reportRef = useRef(onRatio)
  reportRef.current = onRatio

  const applyRatio = (next: number) => {
    const clamped = clamp01(next)
    setRatio(clamped)
    reportRef.current?.(clamped)
  }

  // 换章回到章首：上一章的比例对不上新的正文
  useEffect(() => {
    setRatio(0)
    reportRef.current?.(0)
    const element = scrollRef.current
    if (element) element.scrollTop = 0
  }, [book.id, chapterIndex])

  // 进度按「停下来 1 秒」写库，和阅读器同一个节奏：滚动时不断被推迟，
  // 松手之后才落盘。所以预览里读了一段再进阅读器，位置接得上。
  useEffect(() => {
    if (!html) return
    const timer = window.setTimeout(() => {
      void saveProgress(book.id, { chapterIndex, ratio, updatedAt: Date.now() })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [book.id, chapterIndex, ratio, html])

  const seek = (next: number) => {
    const element = scrollRef.current
    if (!element) return
    const max = element.scrollHeight - element.clientHeight
    // 一屏就装得下：没有可跳的位置，视窗框也别乱动
    if (max <= 0) return
    element.scrollTop = clamp01(next) * max
    // 视窗框立刻跟上，不等滚动事件：跳转是我们自己做的，位置算得出来
    applyRatio(next)
  }

  const vars = useMemo(() => settingsToVars(settings), [settings])

  return (
    <>
      <div
        ref={scrollRef}
        className="mn-scroll"
        style={vars}
        onScroll={() => {
          // 滚动事件每次都 setState 会让整篇正文重渲染，所以按帧合并
          if (frameRef.current) return
          frameRef.current = requestAnimationFrame(() => {
            frameRef.current = 0
            const element = scrollRef.current
            if (!element) return
            const max = element.scrollHeight - element.clientHeight
            applyRatio(max > 0 ? element.scrollTop / max : 0)
          })
        }}
      >
        {decorated.html ? (
          <article
            className={decoy ? 'mn-content mn-content--code' : 'mn-content'}
            // 和阅读器同一条契约：内容是解析时净化过的
            dangerouslySetInnerHTML={{ __html: decorated.html }}
          />
        ) : (
          <p className="text-[13px] text-fg-faint">
            {chapter === null ? '这一章还没读到' : '正在打开…'}
          </p>
        )}
      </div>
      <Minimap lines={decorated.lines} ratio={ratio} onSeek={seek} />
    </>
  )
}
