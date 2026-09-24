import { useEffect, useState } from 'react'
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
import {
  hotkeyCommandOf,
  hotkeyLiveOn,
  HOTKEY_LABELS,
  resolveCombo,
  useHotkeyBindings,
  type HotkeyId,
} from '../../store/hotkeys'
import { cx } from '../../lib/cx'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { HotkeyInput } from '../ui/HotkeyInput'
import { Slider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { ThemePicker } from './ThemePicker'
import { IconCheck, IconClose } from '../ui/icons'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  /** 只有阅读器里能给某本书开独立设置。书架上没有「当前这本书」，就不传 */
  perBookEnabled?: boolean
  onTogglePerBook?: (enabled: boolean) => void
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  perBookEnabled,
  onTogglePerBook,
}: SettingsPanelProps) {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const decoyEnabled = useDecoy((state) => state.enabled)
  const decoyPresetId = useDecoy((state) => state.preset)
  const setDecoyEnabled = useDecoy((state) => state.setEnabled)
  const setDecoyPreset = useDecoy((state) => state.setPreset)
  const dimEnabled = useDim((state) => state.enabled)
  const dimLevel = useDim((state) => state.level)
  const setDimEnabled = useDim((state) => state.setEnabled)
  const setDimLevel = useDim((state) => state.setLevel)
  const combos = useHotkeyBindings((state) => state.combos)
  const setCombo = useHotkeyBindings((state) => state.setCombo)
  const resetCombo = useHotkeyBindings((state) => state.resetCombo)

  // 每一栏在不在，读的是**功能自己的形态**（命令表里的 presence，hotkeyLiveOn）：
  // 演示模式只属于编辑器形态，摸鱼模式属于所有带外壳的形态。
  // 这么写是为了让「面板里有这个开关」与「这个键按得响」永远是同一件事——
  // 上一版两处各判各的，结果五套办公外壳的正文按 Alt+S 毫无反应。
  // 判断走 chromeOf(getTheme(...))，不认主题 id：再加一套外壳主题，这里不用改。
  const chrome = chromeOf(getTheme(settings.themeId))
  const codeChrome = chrome === 'code'
  const appChrome = !codeChrome && chrome !== 'plain'

  /** 两个功能不能绑同一个组合：谁先响应说不清，索性在录的时候挡住 */
  const conflictWith = (id: HotkeyId, combo: string): string | null => {
    for (const other of Object.keys(HOTKEY_LABELS) as HotkeyId[]) {
      if (other !== id && combo === resolveCombo(combos, other)) {
        return `这个组合已经给了${HOTKEY_LABELS[other]}`
      }
    }
    return null
  }

  useEffect(() => {
    if (!open) return
    void storageUsage().then(setUsage)
  }, [open])

  return (
    <Panel
      open={open}
      onClose={onClose}
      side="right"
      header={
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="text-[14px] font-semibold text-fg">阅读设置</h2>
          <Button size="sm" variant="ghost" className="px-2" onClick={onClose} aria-label="关闭">
            <IconClose className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-7 p-4">
        <section className="space-y-3">
          <SectionTitle>主题</SectionTitle>
          <ThemePicker
            activeId={settings.themeId}
            // 主题可以带一套自带的排版参数（比如编辑器形态的等宽、不缩进）：
            // 选中它的时候一起写进设置。这是**一次预设**，之后用户怎么改都算用户的
            onSelect={(themeId) => onChange({ themeId, ...themePreset(themeId) })}
          />
        </section>

        {/* 演示模式那一栏只属于编辑器形态：它在别的主题下要显示什么，是以后单独设计的
            一件事（见 docs/SPEC.md 决定记录 30）。在那之前，非编辑器主题下这一栏、
            这个开关和它的键位都不出现——而不是摆一个按了没反应的开关。
            条件读 hotkeyLiveOn：和这个键在哪儿响应是同一个判断 */}
        {hotkeyLiveOn('decoy', chrome) ? (
          <section className="space-y-3">
            <SectionTitle>演示模式</SectionTitle>
            <Switch
              label="正文显示成代码"
              description="书架、文件名、状态栏一起换成代码的样子"
              checked={decoyEnabled}
              onChange={setDecoyEnabled}
            />
            <div className="grid grid-cols-2 gap-1.5">
              {DECOY_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDecoyPreset(item.id)}
                  aria-pressed={decoyPresetId === item.id}
                  className={cx(
                    'rounded-lg border px-2.5 py-1.5 text-left text-[12.5px]',
                    'transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--mn-dur-2)] ease-[var(--mn-ease)] active:scale-[0.97]',
                    decoyPresetId === item.id
                      ? 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--mn-accent)_12%,transparent)]'
                      : 'border-border text-fg-muted hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <HotkeyInput
              name="演示模式快捷键"
              scope={hotkeyCommandOf('decoy').scope}
              combo={resolveCombo(combos, 'decoy')}
              onChange={(combo) => setCombo('decoy', combo)}
              onReset={() => resetCombo('decoy')}
              check={(combo) => conflictWith('decoy', combo)}
            />
          </section>
        ) : null}

        {/* 摸鱼模式那一栏只属于带外壳的形态（编辑器 + 五套办公外壳）：
            普通阅读主题下没有「内容区」可压。条件同样读 hotkeyLiveOn */}
        {hotkeyLiveOn('dim', chrome) ? (
          <section className="space-y-3">
            <SectionTitle>摸鱼模式</SectionTitle>
            <Switch
              label={codeChrome ? '把编辑区调暗' : '把正文区调暗'}
              description={
                codeChrome
                  ? '文件树和代码区盖一层黑纱，标题栏、状态栏不动'
                  : '正文那块盖一层黑纱，窗口的边框和栏位不动'
              }
              checked={dimEnabled}
              onChange={setDimEnabled}
            />
            <Slider
              label="变暗程度"
              value={dimLevel}
              {...DIM_LEVEL_RANGE}
              onChange={setDimLevel}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <HotkeyInput
              name="摸鱼模式快捷键"
              scope={hotkeyCommandOf('dim').scope}
              combo={resolveCombo(combos, 'dim')}
              onChange={(combo) => setCombo('dim', combo)}
              onReset={() => resetCombo('dim')}
              check={(combo) => conflictWith('dim', combo)}
            />
          </section>
        ) : null}

        {/* 页面里的三条命令。归在这里而不是散在各栏里：它们是「怎么用这个应用」的，
            不属于某一个功能；上面两条「伪装」功能的键放在各自那一栏更方便对照 */}
        <section className="space-y-3">
          <SectionTitle>快捷键</SectionTitle>
          {(['settings', 'toc', 'fullscreen'] as HotkeyId[]).map((id) => (
            <HotkeyInput
              key={id}
              name={HOTKEY_LABELS[id]}
              scope={hotkeyCommandOf(id).scope}
              combo={resolveCombo(combos, id)}
              onChange={(combo) => setCombo(id, combo)}
              onReset={() => resetCombo(id)}
              check={(combo) => conflictWith(id, combo)}
            />
          ))}
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            输入框里打字时这些键不生效。
          </p>
        </section>

        {/* 阅读模式只对普通形态和编辑器形态有意义：办公外壳里的正文不是整页排版的
            （文档是一张纸、表格是网格、PPT 是一张张贴着、聊天是消息流），
            分栏翻页在那儿不成立。所以这里明说一句，而不是留两个按了没反应的按钮 */}
        {appChrome ? (
          <section className="space-y-3">
            <SectionTitle>阅读模式</SectionTitle>
            <p className="text-[11.5px] leading-relaxed text-fg-faint">
              这一套外壳里正文按上下滚动走，切回普通主题才用得上分栏翻页。
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <SectionTitle>阅读模式</SectionTitle>
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
          </section>
        )}

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

        <section className="space-y-4">
          <SectionTitle>排版</SectionTitle>
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
        </section>

        {onTogglePerBook ? (
          <section className="border-t border-border pt-5">
            <Switch
              label="这本书用独立设置"
              description="上面的字号、主题只对当前这本书生效"
              checked={perBookEnabled ?? false}
              onChange={onTogglePerBook}
            />
          </section>
        ) : null}

        <section className="space-y-2 border-t border-border pt-5">
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
          <section className="border-t border-border pt-5 text-[11.5px] leading-relaxed text-fg-faint">
            <SectionTitle>存储</SectionTitle>
            <p className="mt-2">
              已用 {formatBytes(usage.usage)}
              {usage.quota ? ` / 配额 ${formatBytes(usage.quota)}` : ''}
              {usage.persisted ? ' · 已申请持久化，不会被自动清理' : ' · 未持久化'}
            </p>
          </section>
        ) : null}
      </div>
    </Panel>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
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
