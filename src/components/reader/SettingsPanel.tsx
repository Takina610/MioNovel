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
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
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
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            主题是一组颜色变量，书架、工具栏和正文同时跟着变。
            想再细调（换背景图、改强调色）用最下面的自定义 CSS。
          </p>
        </section>

        <section className="space-y-3">
          <SectionTitle>阅读模式</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={settings.pageMode === 'scroll'}
              label="上下滚动"
              hint="连贯阅读"
              onClick={() => onChange({ pageMode: 'scroll' })}
            />
            <ModeButton
              active={settings.pageMode === 'paged'}
              label="左右翻页"
              hint="按屏分页"
              onClick={() => onChange({ pageMode: 'paged' })}
            />
          </div>
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
                    'rounded-md border py-1.5 text-[12.5px] transition-colors',
                    settings.fontFamily === font.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-fg-muted hover:bg-surface-2',
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
                    'rounded-md border px-3 py-1 text-[12.5px] transition-colors',
                    settings.align === align
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-fg-muted hover:bg-surface-2',
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
            className="w-full rounded-md border border-border bg-bg p-2 font-mono text-[12px] leading-relaxed"
          />
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            直接作用在阅读界面上，改完立即生效。改坏了清空即可。
            正文元素都在 <code>.mn-content</code> 里。
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
      className={cx(
        'rounded-lg border px-3 py-2 text-left transition-colors',
        active ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2',
      )}
    >
      <span className={cx('block text-[13px]', active ? 'text-accent' : 'text-fg')}>{label}</span>
      <span className="mt-0.5 block text-[11px] text-fg-faint">{hint}</span>
    </button>
  )
}
