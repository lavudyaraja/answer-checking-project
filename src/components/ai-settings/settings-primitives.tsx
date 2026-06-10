'use client'

import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  description?: string
  badge?: string
  className?: string
}

export function SectionHeader({ title, description, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-5', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {badge && (
          <Badge variant="secondary" className="text-xs px-2 py-0 h-5 bg-slate-100 text-slate-500 font-normal">
            {badge}
          </Badge>
        )}
      </div>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  tag?: string
}

export function ToggleRow({ label, description, checked, onChange, disabled, tag }: ToggleRowProps) {
  return (
    <div className={cn(
      'flex items-center justify-between py-3 border-b border-slate-100 last:border-0',
      disabled && 'opacity-50',
    )}>
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-800 font-medium cursor-pointer leading-none">
            {label}
          </Label>
          {tag && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium uppercase tracking-wide">
              {tag}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="data-[state=checked]:bg-slate-900 flex-shrink-0"
      />
    </div>
  )
}

// ─── Slider Row ───────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string
  description?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  colorFn?: (v: number) => string
  disabled?: boolean
}

export function SliderRow({
  label, description, value, onChange,
  min = 0, max = 100, step = 5,
  unit = '%', colorFn, disabled,
}: SliderRowProps) {
  const color = colorFn?.(value) ?? '#1E293B'
  return (
    <div className={cn('py-3 border-b border-slate-100 last:border-0', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <Label className="text-sm text-slate-800 font-medium">{label}</Label>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
        <span
          className="text-sm font-semibold tabular-nums ml-4"
          style={{ color }}
        >
          {value}{unit}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-300">{min}{unit}</span>
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="flex-1"
        />
        <span className="text-[11px] text-slate-300">{max}{unit}</span>
      </div>
    </div>
  )
}

// ─── Number Input Row ────────────────────────────────────────────────────────

interface NumberInputRowProps {
  label: string
  description?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
  disabled?: boolean
}

export function NumberInputRow({
  label, description, value, onChange, min, max, unit, disabled,
}: NumberInputRowProps) {
  return (
    <div className={cn(
      'flex items-center justify-between py-3 border-b border-slate-100 last:border-0',
      disabled && 'opacity-50',
    )}>
      <div className="flex-1 pr-4">
        <Label className="text-sm text-slate-800 font-medium">{label}</Label>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={e => {
            const v = Number(e.target.value)
            if (min !== undefined && v < min) return
            if (max !== undefined && v > max) return
            onChange(v)
          }}
          className={cn(
            'w-20 text-right text-sm font-medium border border-slate-200 rounded-md px-2 py-1',
            'focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400',
            'bg-white text-slate-800',
          )}
        />
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}

// ─── Select Row ──────────────────────────────────────────────────────────────

interface SelectRowProps<T extends string> {
  label: string
  description?: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; description?: string }>
  disabled?: boolean
}

export function SelectRow<T extends string>({
  label, description, value, onChange, options, disabled,
}: SelectRowProps<T>) {
  return (
    <div className={cn(
      'flex items-center justify-between py-3 border-b border-slate-100 last:border-0',
      disabled && 'opacity-50',
    )}>
      <div className="flex-1 pr-4">
        <Label className="text-sm text-slate-800 font-medium">{label}</Label>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        disabled={disabled}
        className={cn(
          'text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-800',
          'focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400',
          'min-w-[140px]',
        )}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Settings Card ───────────────────────────────────────────────────────────

interface SettingsCardProps {
  children: React.ReactNode
  className?: string
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn(
      'border border-slate-200 rounded-xl bg-white p-5',
      className,
    )}>
      {children}
    </div>
  )
}

// ─── Semantic Weight Bar ─────────────────────────────────────────────────────

interface WeightBarProps {
  weights: Record<string, number>
  colors: Record<string, string>
}

export function WeightBar({ weights, colors }: WeightBarProps) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-2.5">
        {Object.entries(weights).map(([key, val]) => (
          <div
            key={key}
            className="transition-all duration-300"
            style={{ width: `${(val / Math.max(total, 1)) * 100}%`, background: colors[key] ?? '#94A3B8' }}
            title={`${key}: ${val}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(weights).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: colors[key] ?? '#94A3B8' }}
            />
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
            <span className="font-medium text-slate-700">{val}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}