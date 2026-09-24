import { useMemo, useState } from 'react'
import { chapterBlocks } from '../lib/blocks'
import { chapterSlides, type Slide } from '../lib/slide'
import { avatarOf, fileNameFor, sectionNameOf } from '../lib/appdocs'
import { formatChars, formatPercent } from '../lib/format'
import { cx } from '../lib/cx'
import {
  IconLayout,
  IconNotes,
  IconSection,
  IconSlideshow,
  IconSlideSorter,
  IconUndo,
} from '../components/ui/app-icons'
import { IconChevron, IconMore } from '../components/ui/icons'
import {
  CommentButton,
  OfficeFrame,
  StatusButton,
  StatusText,
  fullscreenButton,
  type RibbonTab,
} from './OfficeFrame'
import { SlideCard } from './Content'
import type { AppFrameProps } from './types'

/**
 * PowerPoint 形态。
 *
 * 用的是**幻灯片浏览视图**，不是编辑视图：编辑视图一次只显示一张幻灯片，
 * 在浏览器里要自己造一套分页，还要和进度条打架；而浏览视图本来就是 PowerPoint
 * 里正式的一种视图（视图 → 幻灯片浏览），一张张贴着排，正好可以用滚动的正文来表达。
 * 左侧那一栏是节（= 章）+ 当前节的幻灯片缩略图，下方是备注栏，
 * 都和真 PowerPoint 的浏览视图一致（见决定记录 27）。
 *
 * 一章 = 一节，段落按预算切成若干张（见 lib/slide.ts）。缩略图和大图是**同一份**
 * 内容（SlideCard 组件 + 缩放的 transform），不是另画一套占位图。
 */
export function PptApp(props: AppFrameProps) {
  const { book, settings, onSettingsChange } = props
  const [tab, setTab] = useState('home')
  const [notesOpen, setNotesOpen] = useState(true)
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth >= 900)

  const slides = useMemo(
    () =>
      chapterSlides(
        chapterBlocks(props.chapterHtml ?? ''),
        {
          title: props.chapterTitle || `第 ${props.chapterIndex + 1} 章`,
          subtitle: book.author ? `${book.title} · ${book.author}` : book.title,
        },
      ),
    [props.chapterHtml, props.chapterTitle, props.chapterIndex, book.title, book.author],
  )

  // 现在看的是第几张：和 Excel 的「当前行」一样，按视口比例换算
  const activeIndex = Math.max(
    1,
    Math.min(slides.length, Math.floor(props.chapterPercent * slides.length) + 1),
  )
  const active: Slide | undefined = slides[activeIndex - 1]

  const homeGroups = useMemo(
    () => [
      {
        label: '幻灯片',
        buttons: [
          { id: 'new-slide', icon: '＋', title: '新建幻灯片（一张幻灯片就是一叠正文）', disabled: true },
          { id: 'layout', icon: <IconLayout className="h-5 w-5" />, title: '版式：标题和内容（按这一章的段落数自动分页）', disabled: true },
          { id: 'reset', icon: '重置', title: '重置（版权页不归读者调）', disabled: true },
          { id: 'section', icon: <IconSection className="h-5 w-5" />, title: `节：一章一节（当前「${sectionNameOf(props.chapterTitle, props.chapterIndex)}」）`, disabled: true },
        ],
      },
      {
        label: '字体',
        buttons: [
          {
            id: 'grow',
            icon: 'A⁺',
            title: '增大字号',
            disabled: settings.fontSize >= 34,
            onClick: () => onSettingsChange({ fontSize: Math.min(34, settings.fontSize + 1) }),
          },
          {
            id: 'shrink',
            icon: 'A⁻',
            title: '缩小字号',
            disabled: settings.fontSize <= 12,
            onClick: () => onSettingsChange({ fontSize: Math.max(12, settings.fontSize - 1) }),
          },
          { id: 'bold', icon: 'B', title: '加粗（只读）', disabled: true },
          { id: 'italic', icon: 'I', title: '斜体（只读）', disabled: true },
        ],
      },
      {
        label: '段落',
        buttons: [
          {
            id: 'spacing',
            icon: '行距',
            title: `行距：${settings.lineHeight.toFixed(2)}`,
            onClick: () => {
              const steps = [1.15, 1.3, 1.5, 1.8]
              const next = steps.find((step) => step > settings.lineHeight + 0.01) ?? steps[0]
              onSettingsChange({ lineHeight: next })
            },
          },
          {
            id: 'left',
            icon: '左',
            title: '左对齐',
            active: settings.align === 'left',
            onClick: () => onSettingsChange({ align: 'left' }),
          },
          {
            id: 'justify',
            icon: '两',
            title: '两端对齐',
            active: settings.align === 'justify',
            onClick: () => onSettingsChange({ align: 'justify' }),
          },
          { id: 'smartart', icon: '▦', title: '转换为 SmartArt（只读）', disabled: true },
        ],
      },
      {
        label: '绘图',
        buttons: [{ id: 'undo', icon: <IconUndo className="h-5 w-5" />, title: '撤销（没有可撤销的操作）', disabled: true }],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chapterIndex, props.chapterTitle, settings.fontSize, settings.lineHeight, settings.align],
  )

  const viewGroups = useMemo(
    () => [
      {
        label: '演示文稿视图',
        buttons: [
          { id: 'sorter', icon: <IconSlideSorter className="h-5 w-5" />, title: '幻灯片浏览（当前就是）', active: true, onClick: () => undefined },
          {
            id: 'notes',
            icon: <IconNotes className="h-5 w-5" />,
            title: '备注（每一张的备注里放的是这一张上的字）',
            active: notesOpen,
            onClick: () => setNotesOpen((on) => !on),
          },
          {
            id: 'pane',
            icon: '节',
            title: sideOpen ? '收起左侧节栏' : '展开左侧节栏',
            active: sideOpen,
            onClick: () => setSideOpen((on) => !on),
          },
        ],
      },
      {
        label: '显示',
        buttons: [
          { id: 'sorter-zoom', icon: '100%', title: '浏览视图里幻灯片的大小（跟着正文字号走）', disabled: true },
        ],
      },
      {
        label: '窗口',
        buttons: [
          fullscreenButton(),
          {
            id: 'dim',
            icon: '◐',
            title: props.dimOn ? '退出摸鱼模式' : '摸鱼模式（调暗幻灯片）',
            active: props.dimOn,
            onClick: props.onToggleDim,
          },
        ],
      },
      { label: '批注', buttons: [CommentButton] },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notesOpen, sideOpen, props.dimOn, props.onToggleDim],
  )

  const tabs: RibbonTab[] = [
    { id: 'home', label: '开始', groups: homeGroups },
    { id: 'insert', label: '插入', disabled: true },
    { id: 'draw', label: '绘图', disabled: true },
    { id: 'design', label: '设计', disabled: true },
    { id: 'trans', label: '切换', disabled: true },
    { id: 'anim', label: '动画', disabled: true },
    { id: 'show', label: '幻灯片放映', disabled: true },
    { id: 'view', label: '视图', groups: viewGroups },
  ]

  const chapters = props.chapters
  const sections = (chapters ?? []).filter((row) => row.type === 'chapter')

  const side = (
    <div className="mn-office__side-inner">
      <div className="mn-office__side-head">
        <span>节</span>
        <span className="mn-office__side-sub">
          {props.chapterIndex + 1}/{props.chapterCount}
        </span>
      </div>
      <div className="mn-office__side-list mn-ppt__sections">
        {chapters === undefined ? (
          <p className="mn-office__side-hint">正在读目录…</p>
        ) : (
          sections.map((row) => {
            const current = row.index === props.chapterIndex
            return (
              <div key={row.index} className={cx('mn-ppt__section', current && 'is-open')}>
                <button
                  type="button"
                  className="mn-ppt__section-head"
                  title={sectionNameOf(row.label, row.index)}
                  onClick={() => props.onChapter(row.index)}
                >
                  <span className="mn-ppt__section-name">{sectionNameOf(row.label, row.index)}</span>
                  <span className="mn-ppt__section-count">
                    {current ? `第 ${activeIndex}/${slides.length} 张` : '未展开'}
                  </span>
                </button>
                {current ? (
                  <div className="mn-ppt__thumbs">
                    {slides.map((slide) => (
                      <a
                        key={slide.index}
                        className={cx('mn-ppt__thumb', slide.index === activeIndex && 'is-active')}
                        href={`#mn-slide-${slide.index}`}
                        title={slide.title}
                        onClick={(event) => {
                          event.preventDefault()
                          document
                            .getElementById(`mn-slide-${slide.index}`)
                            ?.scrollIntoView({ block: 'start' })
                        }}
                      >
                        <span className="mn-ppt__thumb-canvas">
                          <span className="mn-ppt__thumb-scale">
                            <SlideCard slide={slide} thumb />
                          </span>
                        </span>
                        <span className="mn-ppt__thumb-number">{slide.index}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
      <div className="mn-office__side-foot">
        <button
          type="button"
          className="mn-office__side-nav"
          disabled={props.chapterIndex <= 0}
          title="上一节"
          onClick={() => props.onChapter(props.chapterIndex - 1)}
        >
          <IconChevron className="h-4 w-4 rotate-180" />
          上一节
        </button>
        <button
          type="button"
          className="mn-office__side-nav"
          disabled={props.chapterIndex >= props.chapterCount - 1}
          title="下一节"
          onClick={() => props.onChapter(props.chapterIndex + 1)}
        >
          下一节
          <IconChevron className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <OfficeFrame
      fileName={fileNameFor('slide', book.title)}
      savedHint="已保存到这台设备"
      avatar={avatarOf(book.author)}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      onBack={props.onBack}
      side={side}
      sideOpen={sideOpen}
      footBand={
        notesOpen ? (
          <div className="mn-notes">
            <div className="mn-notes__label">备注</div>
            <div className="mn-notes__body">
              {active?.notes ? (
                active.notes.split('\n').map((line, index) => <p key={index}>{line}</p>)
              ) : (
                <p className="mn-notes__empty">这一张没有备注</p>
              )}
            </div>
          </div>
        ) : null
      }
      statusLeft={
        <>
          <StatusText title="一章就是一节，节里按段落切成若干张">
            幻灯片 {activeIndex}/{slides.length}
          </StatusText>
          <StatusText title="这一节 / 全书">
            节 {props.chapterIndex + 1}/{props.chapterCount}
          </StatusText>
          <StatusText title="这一节的字数">
            {formatChars(props.chapterChars ?? 0)}
          </StatusText>
          <StatusText className="max-sm:hidden">中文(中国)</StatusText>
        </>
      }
      statusRight={
        <>
          <StatusText title="已读">{formatPercent(props.percent)}</StatusText>
          <StatusButton
            title="幻灯片放映（把窗口全屏，一张张贴着读）"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void document.documentElement.requestFullscreen()
            }}
          >
            <IconSlideshow className="h-3.5 w-3.5" />
          </StatusButton>
          <StatusButton title="打开阅读设置" onClick={props.onOpenSettings}>
            <IconMore className="h-3.5 w-3.5" />
          </StatusButton>
        </>
      }
      zoom={settings.fontSize}
      zoomRange={[12, 34]}
      onZoom={(value) => onSettingsChange({ fontSize: value })}
      onOpenSettings={props.onOpenSettings}
      dim={props.dim}
      dimOn={props.dimOn}
      onToggleDim={props.onToggleDim}
    >
      {/* 幻灯片由 ReaderView 贴着排（它管着滚动与进度），外壳只画框 */}
      {/* mn-veil：摸鱼模式的黑纱盖在幻灯片区上（左侧缩略图栏不动） */}
      <div className="mn-ppt__body mn-veil">{props.children}</div>
    </OfficeFrame>
  )
}
