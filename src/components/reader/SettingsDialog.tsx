import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { storageUsage, type StorageUsage } from '../../db/books'
import { formatBytes } from '../../lib/format'
import {
  FONT_STACKS,
  SETTING_RANGES,
  type ReaderSettings,
} from '../../store/settings'
import { chromeOf, getTheme, themePreset } from '../../themes/apply'
import { DECOY_PRESETS } from '../../lib/decoy'
import { useDecoy } from '../../store/decoy'
import { DIM_LEVEL_RANGE, useDim } from '../../store/dim'
import { CENTER_SCALE, flipStep, type FlipRect } from '../../lib/flip'
import {
  closeSettingsDialog,
  closeSettingsToCenter,
  originRectNow,
  useSettingsDialog,
  type OriginRect,
} from '../../store/settingsDialog'
import {
  hotkeyCommandOf,
  hotkeyLiveOn,
  HOTKEY_LABELS,
  resolveCombos,
  useHotkeyBindings,
  type HotkeyId,
} from '../../store/hotkeys'
import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'
import { HotkeyRow } from '../ui/HotkeyRow'
import { Slider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { ThemePicker } from './ThemePicker'
import { IconCheck, IconClose, IconCode, IconKeyboard } from '../ui/icons'
import {
  IconBookBlank,
  IconCharSpacing,
  IconDarkMode,
  IconGear,
  IconTheme,
} from '../ui/app-icons'

interface SettingsDialogProps {
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  /** 只有阅读器里能给某本书开独立设置。书架上没有「当前这本书」，就不传 */
  perBookEnabled?: boolean
  onTogglePerBook?: (enabled: boolean) => void
}

/** 左侧一栏大类。右侧是它展开后的细分设置 */
interface Category {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  node: ReactNode
}

/** 动效时长与缓动读主题的令牌（三档时长与缓动只定义在 styles/app.css 一处）。秒，Motion 用秒 */
function motionTokens(): { enter: number; exit: number; ease: [number, number, number, number] } {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return { enter: 0, exit: 0, ease: [0, 0, 0, 1] }
  }
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: number) => {
    const raw = Number.parseFloat(styles.getPropertyValue(name))
    return Number.isFinite(raw) ? raw / 1000 : fallback
  }
  // 令牌存的是 `cubic-bezier(0.32, 0.72, 0, 1)`，Motion 要四个数
  const nums = styles.getPropertyValue('--mn-ease').match(/[\d.]+/g)?.map(Number) ?? []
  const ease: [number, number, number, number] =
    nums.length >= 4 ? [nums[0], nums[1], nums[2], nums[3]] : [0.32, 0.72, 0, 1]
  return { enter: read('--mn-dur-3', 0.32), exit: read('--mn-dur-2', 0.22), ease }
}

/**
 * 弹窗尺寸在这里算成数（宽高只此一处，样式不再给尺寸）：
 * FLIP 的缩放比例要拿「终点的宽高」去除出发点的宽高，尺寸必须是个能拿到的数。
 */
function dialogSize(): { width: number; height: number } {
  if (window.innerWidth < 768) return { width: window.innerWidth, height: window.innerHeight }
  return {
    width: Math.min(window.innerWidth * 0.92, 860),
    height: Math.min(window.innerHeight * 0.86, 620),
  }
}

/**
 * 出发点 → 弹窗的起始姿态（FLIP 的反演）。终点矩形是「居中后的自己」：
 * 面板用 margin:auto 居中（不走 transform， transform 是动画本体），中心就是视口中心。
 * origin 为 null（快捷键开的、或换主题后向中间收）时退成居中缩放。
 */
function flipOf(origin: OriginRect | null, size: { width: number; height: number }) {
  if (!origin) return { center: true as const }
  const to: FlipRect = {
    left: (window.innerWidth - size.width) / 2,
    top: (window.innerHeight - size.height) / 2,
    width: size.width,
    height: size.height,
  }
  const { dx, dy, sx, sy } = flipStep(to, origin)
  return { center: false as const, x: dx, y: dy, scaleX: sx, scaleY: sy }
}

type Flip = ReturnType<typeof flipOf>

/**
 * 阅读设置弹窗。
 *
 * 之前是贴边的抽屉（Panel），现在是一口居中的弹窗：左边竖着排大类，
 * 右边是选中那大类里的细分设置——设置条目涨到十几条之后，一整列滚着找
 * 太费劲，分大类是给「我知道要改字号」这种事一个直达的入口。
 *
 * 开合走全局 store（store/settingsDialog）：弹窗**从触发它的按钮长出来**，
 * 关闭时缩回那个按钮；快捷键开的没有按钮，从中间出、向中间缩；
 * **在弹窗里换主题则整个外壳都换了，收起时直接向中间缩回**（按钮多半已经不在了）。
 *
 * 进出场交给 Motion（AnimatePresence）：离场时它把终态钉在元素上、播完才卸载，
 * 不会像手写 WAAPI 那样在收尾的一拍闪回原样。时长与缓动仍读 styles/app.css 的令牌。
 */
export function SettingsDialog({
  settings,
  onChange,
  perBookEnabled,
  onTogglePerBook,
}: SettingsDialogProps) {
  const open = useSettingsDialog((state) => state.open)
  const panelRef = useRef<HTMLDivElement>(null)
  /** 打开前焦点在哪，关闭时还回去（键盘读者的 Tab 别凭空掉进页面顶上） */
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const [usage, setUsage] = useState<StorageUsage | null>(null)
  // 选中的大类。弹窗常驻于页面（关着时不渲染面板），跨开合保留——
  // 用户回头改字距时，别让他再点一遍「排版」
  const [activeId, setActiveId] = useState('theme')
  const [size, setSize] = useState(dialogSize)

  const decoyEnabled = useDecoy((state) => state.enabled)
  const decoyPresetId = useDecoy((state) => state.preset)
  const setDecoyEnabled = useDecoy((state) => state.setEnabled)
  const setDecoyPreset = useDecoy((state) => state.setPreset)
  const dimEnabled = useDim((state) => state.enabled)
  const dimLevel = useDim((state) => state.level)
  const setDimEnabled = useDim((state) => state.setEnabled)
  const setDimLevel = useDim((state) => state.setLevel)
  const combos = useHotkeyBindings((state) => state.combos)
  const addCombo = useHotkeyBindings((state) => state.addCombo)
  const removeCombo = useHotkeyBindings((state) => state.removeCombo)
  const resetCommand = useHotkeyBindings((state) => state.resetCommand)

  // 每一大类在不在，读的是**功能自己的形态**（命令表里的 presence，hotkeyLiveOn）：
  // 演示模式只属于编辑器形态，摸鱼模式属于所有带外壳的形态。
  // 这么写是为了让「弹窗里有这一栏」与「这个键按得响」永远是同一件事——
  // 判断走 chromeOf(getTheme(...))，不认主题 id：再加一套外壳主题，这里不用改。
  const chrome = chromeOf(getTheme(settings.themeId))
  const codeChrome = chrome === 'code'
  const appShell = !codeChrome && chrome !== 'plain'

  /** 两个功能不能绑同一个组合：谁先响应说不清，索性在录的时候挡住。
   *  一条命令可以绑多个组合，所以要对**每一串**都比一遍 */
  const conflictWith = (id: HotkeyId, combo: string): string | null => {
    for (const other of Object.keys(HOTKEY_LABELS) as HotkeyId[]) {
      if (other !== id && resolveCombos(combos[other], other).includes(combo)) {
        return `这个组合已经给了${HOTKEY_LABELS[other]}`
      }
    }
    return null
  }

  useEffect(() => {
    if (!open) return
    void storageUsage().then(setUsage)
  }, [open])

  // 弹窗尺寸在打开期间跟着窗口走；关着时不听（离场动画用打开时那份）
  useEffect(() => {
    if (!open) return
    const onResize = () => setSize(dialogSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  // 出发点姿态。开的那一拍量（按下时存的按钮快照还在，菜单项此刻可能已经卸载）；
  // 关的那一拍重算——「向中间收」（换主题）就当没有出发点
  const flip: Flip = useMemo(
    () =>
      flipOf(
        !open && useSettingsDialog.getState().exitCenter ? null : originRectNow(),
        size,
      ),
    [open, size],
  )

  const { enter, exit, ease } = useMemo(motionTokens, [open])
  const variants: Variants = {
    shown: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, transition: { duration: enter, ease } },
    hidden: (c: Flip) => ({
      opacity: 0,
      ...(c.center
        ? { scaleX: CENTER_SCALE, scaleY: CENTER_SCALE }
        : { x: c.x, y: c.y, scaleX: c.scaleX, scaleY: c.scaleY }),
      transition: { duration: exit, ease },
    }),
  }

  // Esc 关弹窗。规矩和 Panel 一样：下拉框开着的时候（data-mn-esc-local）Esc 先归它，
  // 不然按一下 Esc 连弹窗一起关掉——用户只是想收起下拉。
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof Element && target.closest('[data-mn-esc-local]')) return
      event.stopPropagation()
      closeSettingsDialog()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  // 焦点：开的时候挪进来、记下刚才在哪；关的时候还回去。
  // 走 [open] 而不是等离场播完：还焦点发生在收起开始那一刻，正合适
  useEffect(() => {
    if (open) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      panelRef.current?.focus({ preventScroll: true })
      return
    }
    const back = restoreFocusRef.current
    restoreFocusRef.current = null
    if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true })
  }, [open])

  // 开着锁住背后的滚动（离场的那几百毫秒不锁，抽屉 Panel 也是这个行为）
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const categories = buildCategories({
    settings,
    onChange,
    chrome,
    codeChrome,
    appShell,
    perBookEnabled,
    onTogglePerBook,
    usage,
    decoy: { enabled: decoyEnabled, presetId: decoyPresetId, setEnabled: setDecoyEnabled, setPreset: setDecoyPreset },
    dim: { enabled: dimEnabled, level: dimLevel, setEnabled: setDimEnabled, setLevel: setDimLevel },
    combos,
    addCombo,
    removeCombo,
    resetCommand,
    conflictWith,
  })
  // 换主题可能让某大类整个消失（比如从编辑器切回普通阅读），保存的 id 不在了就落回第一类
  const active = categories.find((category) => category.id === activeId) ?? categories[0]

  return (
    <AnimatePresence custom={flip}>
      {open ? (
        <motion.div
          key="mn-settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: exit, ease }}
          onClick={closeSettingsDialog}
          className="fixed inset-0 z-50 bg-overlay backdrop-blur-[3px]"
        />
      ) : null}
      {open ? (
        <motion.div
          key="mn-settings-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="阅读设置"
          tabIndex={-1}
          custom={flip}
          variants={variants}
          initial="hidden"
          animate="shown"
          exit="hidden"
          style={{ width: size.width, height: size.height }}
          className={cx(
            // inset-0 + margin:auto 居中：中心恒在视口正中，且不占 transform——
            // transform 是 FLIP 动画的本体，拿去居中就没得动画了
            'fixed inset-0 z-50 m-auto flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-fg outline-none',
            'shadow-[var(--mn-shadow-panel)]',
            'max-md:rounded-none max-md:border-0',
          )}
        >
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <h2 className="text-[14px] font-semibold text-fg">阅读设置</h2>
            <Button size="sm" variant="ghost" className="px-2" onClick={closeSettingsDialog} aria-label="关闭">
              <IconClose className="h-4 w-4" />
            </Button>
          </div>

          {/* 窄屏转上下结构：页签横排在顶、内容在下。没有这一层 flex-col，
              w-full 的页签行会把内容区挤成零宽 */}
          <div className="flex min-h-0 flex-1 max-md:flex-col">
            {/* 左边竖着的大类。窄屏横过来变成一排可横滑的页签 */}
            <nav
              aria-label="设置分类"
              className={cx(
                'flex shrink-0 flex-col gap-1 p-2',
                'w-44 overflow-y-auto border-r border-border',
                'max-md:w-full max-md:flex-row max-md:items-center max-md:gap-1.5 max-md:overflow-x-auto max-md:border-b max-md:border-r-0',
              )}
            >
              {categories.map((category) => {
                const current = category.id === active.id
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveId(category.id)}
                    aria-current={current || undefined}
                    className={cx(
                      'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px]',
                      'transition-[background-color,color] duration-[var(--mn-dur-1)] ease-[var(--mn-ease)]',
                      current
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{category.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 max-md:p-4">
              <div key={active.id} className="mn-fade space-y-5">
                {active.node}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function buildCategories(args: {
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  chrome: string
  codeChrome: boolean
  appShell: boolean
  perBookEnabled?: boolean
  onTogglePerBook?: (enabled: boolean) => void
  usage: StorageUsage | null
  decoy: {
    enabled: boolean
    presetId: string
    setEnabled: (enabled: boolean) => void
    setPreset: (id: string) => void
  }
  dim: {
    enabled: boolean
    level: number
    setEnabled: (enabled: boolean) => void
    setLevel: (level: number) => void
  }
  combos: Record<HotkeyId, string[]>
  addCombo: (id: HotkeyId, combo: string) => void
  removeCombo: (id: HotkeyId, combo: string) => void
  resetCommand: (id: HotkeyId) => void
  conflictWith: (id: HotkeyId, combo: string) => string | null
}): Category[] {
  const {
    settings,
    onChange,
    chrome,
    codeChrome,
    appShell,
    perBookEnabled,
    onTogglePerBook,
    usage,
    decoy,
    dim,
    combos,
    addCombo,
    removeCombo,
    resetCommand,
    conflictWith,
  } = args

  const categories: Category[] = []

  /** 快捷键设置的一行。标题 / 说明 / 键位组合都从命令表推出来 */
  const hotkeyRow = (id: HotkeyId) => (
    <HotkeyRow
      label={HOTKEY_LABELS[id]}
      description={hotkeyCommandOf(id).description}
      combos={resolveCombos(combos[id], id)}
      defaults={hotkeyCommandOf(id).combos}
      scope={hotkeyCommandOf(id).scope}
      onAdd={(combo) => addCombo(id, combo)}
      onRemove={(combo) => removeCombo(id, combo)}
      onReset={() => resetCommand(id)}
      check={(combo) => conflictWith(id, combo)}
    />
  )

  categories.push({
    id: 'theme',
    label: '主题',
    icon: IconTheme,
    node: (
      <ThemePicker
        activeId={settings.themeId}
        // 主题可以带一套自带的排版参数（比如编辑器形态的等宽、不缩进）：
        // 选中它的时候一起写进设置。这是**一次预设**，之后用户怎么改都算用户的。
        // 换主题 = 整个外壳都换了，弹窗随之收起、直接向中间缩回（触发按钮多半已不在）
        onSelect={(themeId) => {
          onChange({ themeId, ...themePreset(themeId) })
          closeSettingsToCenter()
        }}
      />
    ),
  })

  categories.push({
    id: 'type',
    label: '排版',
    icon: IconCharSpacing,
    node: (
      <>
        <Slider
          label="字号"
          value={settings.fontSize}
          {...SETTING_RANGES.fontSize}
          onChange={(fontSize) => onChange({ fontSize })}
          format={(value) => `${value} px`}
        />
        <Slider
          label="行距"
          value={settings.lineHeight}
          {...SETTING_RANGES.lineHeight}
          onChange={(lineHeight) => onChange({ lineHeight })}
          format={(value) => value.toFixed(2)}
        />
        <Slider
          label="字距"
          value={settings.letterSpacing}
          {...SETTING_RANGES.letterSpacing}
          onChange={(letterSpacing) => onChange({ letterSpacing })}
          format={(value) => `${value.toFixed(2)} em`}
        />
        <Slider
          label="首行缩进"
          value={settings.indent}
          {...SETTING_RANGES.indent}
          onChange={(indent) => onChange({ indent })}
          format={(value) => (value === 0 ? '不缩进' : `${value} 字`)}
        />
        <Slider
          label="段间距"
          value={settings.paragraphGap}
          {...SETTING_RANGES.paragraphGap}
          onChange={(paragraphGap) => onChange({ paragraphGap })}
          format={(value) => `${value.toFixed(1)} 行`}
        />
        <Slider
          label="正文栏宽"
          value={settings.contentWidth}
          {...SETTING_RANGES.contentWidth}
          onChange={(contentWidth) => onChange({ contentWidth })}
          format={(value) => `${value} rem`}
        />

        <div>
          <span className="text-[13px] text-fg-muted">字体</span>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {FONT_STACKS.map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => onChange({ fontFamily: font.id })}
                style={{ fontFamily: font.stack }}
                className={cx(
                  'rounded-lg border py-1.5 text-[12.5px]',
                  'transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)] active:scale-[0.97]',
                  settings.fontFamily === font.id
                    ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
                    : 'border-border text-fg-muted hover:border-border-strong hover:bg-surface-2',
                )}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[13px] text-fg-muted">对齐</span>
          <div className="flex gap-1.5">
            {(['left', 'justify'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onChange({ align })}
                className={cx(
                  'rounded-lg border px-3 py-1 text-[12.5px]',
                  'transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)] active:scale-[0.97]',
                  settings.align === align
                    ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
                    : 'border-border text-fg-muted hover:border-border-strong hover:bg-surface-2',
                )}
              >
                {align === 'left' ? '左对齐' : '两端对齐'}
              </button>
            ))}
          </div>
        </div>
      </>
    ),
  })

  // 阅读模式只对普通形态和编辑器形态有意义：办公外壳里的正文不是整页排版的
  // （文档是一张纸、表格是网格、PPT 是一张张贴着、聊天是消息流），
  // 分栏翻页在那儿不成立。所以那里明说一句，而不是留两个按了没反应的按钮
  categories.push({
    id: 'read',
    label: '阅读',
    icon: IconBookBlank,
    node: (
      <>
        <section className="space-y-3">
          <SectionTitle>阅读模式</SectionTitle>
          {appShell ? (
            <p className="text-[11.5px] leading-relaxed text-fg-faint">
              这一套外壳里正文按上下滚动走，切回普通主题才用得上分栏翻页。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ModeButton
                active={settings.pageMode === 'scroll'}
                label="上下滚动"
                hint="一直往下滚"
                onClick={() => onChange({ pageMode: 'scroll' })}
              />
              <ModeButton
                active={settings.pageMode === 'paged'}
                label="左右翻页"
                hint="一屏一屏翻"
                onClick={() => onChange({ pageMode: 'paged' })}
              />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>双语显示</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <ModeButton
              active={settings.bilingual === 'both'}
              label="对照"
              hint="两种都显示"
              onClick={() => onChange({ bilingual: 'both' })}
            />
            <ModeButton
              active={settings.bilingual === 'primary'}
              label="只看译文"
              hint="隐藏原文段"
              onClick={() => onChange({ bilingual: 'primary' })}
            />
            <ModeButton
              active={settings.bilingual === 'secondary'}
              label="只看原文"
              hint="隐藏译文段"
              onClick={() => onChange({ bilingual: 'secondary' })}
            />
          </div>
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            只对双语书有效，普通小说选哪个都一样。
          </p>
        </section>
      </>
    ),
  })

  // 演示模式那一栏只属于编辑器形态：它在别的主题下要显示什么，是以后单独设计的
  // 一件事（见 docs/SPEC.md 决定记录 30）。条件读 hotkeyLiveOn：
  // 和这个键在哪儿响应是同一个判断
  if (hotkeyLiveOn('decoy', chrome)) {
    categories.push({
      id: 'decoy',
      label: '演示模式',
      icon: IconCode,
      node: (
        <>
          <Switch
            label="正文显示成代码"
            description="书架、文件名、状态栏一起换成代码的样子"
            checked={decoy.enabled}
            onChange={decoy.setEnabled}
          />
          <div className="grid grid-cols-2 gap-1.5">
            {DECOY_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => decoy.setPreset(item.id)}
                aria-pressed={decoy.presetId === item.id}
                className={cx(
                  'rounded-lg border px-2.5 py-1.5 text-left text-[12.5px]',
                  'transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)] active:scale-[0.97]',
                  decoy.presetId === item.id
                    ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
                    : 'border-border text-fg-muted hover:border-border-strong hover:bg-surface-2',
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          {hotkeyRow('decoy')}
        </>
      ),
    })
  }

  // 摸鱼模式那一栏只属于带外壳的形态（编辑器 + 五套办公外壳）：
  // 普通阅读主题下没有「内容区」可压。条件同样读 hotkeyLiveOn。
  // 它只在弹窗里露字——各外壳的屏幕上不给这个功能的字样（见决定记录 41）
  if (hotkeyLiveOn('dim', chrome)) {
    categories.push({
      id: 'dim',
      label: '摸鱼模式',
      icon: IconDarkMode,
      node: (
        <>
          <Switch
            label={codeChrome ? '把编辑区调暗' : '把正文区调暗'}
            description={
              codeChrome
                ? '文件树和代码区盖一层黑纱，标题栏、状态栏不动'
                : '正文那块盖一层黑纱，窗口的边框和栏位不动'
            }
            checked={dim.enabled}
            onChange={dim.setEnabled}
          />
          <Slider
            label="变暗程度"
            value={dim.level}
            {...DIM_LEVEL_RANGE}
            onChange={dim.setLevel}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          {hotkeyRow('dim')}
        </>
      ),
    })
  }

  // 页面里的命令。翻页 / 章节跳转 / 退出阅读只在阅读时响应（书架上没有
  // 「退出阅读」可退），但**键位表永远全量列出**——设置是找键位的地方，
  // 按使用页面藏行会让人以为功能没做。演示与摸鱼两条「伪装」功能的键
  // 放在各自那一栏更方便对照
  categories.push({
    id: 'keys',
    label: '快捷键',
    icon: IconKeyboard,
    node: (
      <>
        {(
          [
            'settings',
            'toc',
            'next-page',
            'prev-page',
            'prev-chapter',
            'next-chapter',
            'fullscreen',
            'exit',
          ] as HotkeyId[]
        ).map((id) => hotkeyRow(id))}
        <p className="text-[12px] leading-relaxed text-fg-faint">
          输入框里打字时这些键不生效。
        </p>
      </>
    ),
  })

  categories.push({
    id: 'advanced',
    label: '高级',
    icon: IconGear,
    node: (
      <>
        {onTogglePerBook ? (
          <Switch
            label="这本书用独立设置"
            description="字号、主题只对当前这本书生效"
            checked={perBookEnabled ?? false}
            onChange={onTogglePerBook}
          />
        ) : null}

        <section className="space-y-2">
          <SectionTitle>自定义 CSS</SectionTitle>
          <textarea
            value={settings.userCss}
            onChange={(event) => onChange({ userCss: event.target.value })}
            rows={4}
            spellCheck={false}
            placeholder={'.mn-content { background-image: … }'}
            className="w-full rounded-lg border border-border bg-bg p-2 font-mono text-[12px] leading-relaxed transition-[border-color,box-shadow] duration-200 ease-[var(--mn-ease)] focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)] focus:outline-none"
          />
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            改完立即生效，改坏了清空即可。正文元素都在 <code>.mn-content</code> 里。
          </p>
        </section>

        {usage ? (
          <section className="text-[11.5px] leading-relaxed text-fg-faint">
            <SectionTitle>存储</SectionTitle>
            <p className="mt-2">
              已用 {formatBytes(usage.usage)}
              {usage.quota ? ` / 配额 ${formatBytes(usage.quota)}` : ''}
              {usage.persisted ? ' · 已申请持久化，不会被自动清理' : ' · 未持久化'}
            </p>
          </section>
        ) : null}
      </>
    ),
  })

  return categories
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[13px] font-medium text-fg">{children}</h3>
}

function ModeButton({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // 视觉上「选中的是哪个」靠边框色，读屏软件读不到，补一个 aria-pressed
      aria-pressed={active}
      className={cx(
        'rounded-xl border px-3 py-2 text-left',
        'transition-[border-color,background-color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)] active:scale-[0.98]',
        active
          ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_14%,transparent)]'
          : 'border-border hover:border-border-strong hover:bg-surface-2',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className={cx('block text-[13px]', active ? 'text-accent' : 'text-fg')}>{label}</span>
        {active ? <IconCheck className="mn-pop h-3.5 w-3.5 text-accent" /> : null}
      </span>
      <span className="mt-0.5 block text-[11px] text-fg-faint">{hint}</span>
    </button>
  )
}
