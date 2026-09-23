import { useEffect, useState } from 'react'
import { storageUsage, type StorageUsage } from '../../db/books'
import { formatBytes } from '../../lib/format'
import {
  FONT_STACKS,
  SETTING_RANGES,
  type ReaderSettings,
} from '../../store/settings'
import { cx } from '../../lib/cx'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { Slider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { ThemePicker } from './ThemePicker'
import { IconCheck, IconClose } from '../ui/icons'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
  perBookEnabled: boolean
  onTogglePerBook: (enabled: boolean) => void
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
            onSelect={(themeId) => onChange({ themeId })}
          />
        </section>

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

        <section className="border-t border-border pt-5">
          <Switch
            label="这本书用独立设置"
            description="上面的字号、主题只对当前这本书生效"
            checked={perBookEnabled}
            onChange={onTogglePerBook}
          />
        </section>

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
