'use client'

import { useRef } from 'react'
import {
  Settings2, Save, RotateCcw, Download, Upload,
  ChevronDown, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SETTINGS_PRESETS } from '@/lib/ai-settings/default-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'
import type { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'
import { cn } from '@/lib/utils'

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

interface SettingsHeaderProps {
  settings: AIEvaluationSettings
  validation: SettingsValidationResult
  saveStatus: SaveStatus
  onSave: () => void
  onReset: () => void
  onLoadPreset: (id: string) => void
  onImport: (file: File) => void
  isLoading?: boolean
}

const STATUS_CONFIG: Record<SaveStatus, { label: string; icon: React.ReactNode; className: string }> = {
  saved:   { label: 'Saved',          icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  unsaved: { label: 'Unsaved changes', icon: <Clock className="h-3.5 w-3.5" />,        className: 'text-amber-600 bg-amber-50 border-amber-200' },
  saving:  { label: 'Saving…',        icon: <Clock className="h-3.5 w-3.5 animate-spin" />, className: 'text-blue-600 bg-blue-50 border-blue-200' },
  error:   { label: 'Save failed',    icon: <AlertCircle className="h-3.5 w-3.5" />,   className: 'text-red-600 bg-red-50 border-red-200' },
}

export function SettingsHeader({
  settings,
  validation,
  saveStatus,
  onSave,
  onReset,
  onLoadPreset,
  onImport,
  isLoading,
}: SettingsHeaderProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const status = STATUS_CONFIG[saveStatus]

  const handleExportJSON = () => {
    const data = AISettingsManager.exportSettings(settings, 'user')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-eval-settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const csv = AISettingsManager.exportAsCSV(settings)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-eval-settings-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }

  return (
    <div className="flex items-start justify-between border-b border-slate-200 pb-5 mb-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 border border-slate-200 rounded-lg bg-white">
          <Settings2 className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            AI Evaluation Settings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure semantic parameters for AI-powered answer assessment
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Save status badge */}
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
          status.className,
        )}>
          {status.icon}
          {status.label}
        </span>

        {/* Preset selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-slate-700 border-slate-200 h-8">
              Load Preset
              <ChevronDown className="h-3.5 w-3.5 ml-1.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-slate-500 font-medium">Presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SETTINGS_PRESETS.map(preset => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onLoadPreset(preset.id)}
                className="gap-2 text-sm"
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: preset.color }}
                />
                {preset.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export / Import */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-slate-700 border-slate-200 h-8">
              Export
              <ChevronDown className="h-3.5 w-3.5 ml-1.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleExportJSON} className="text-sm gap-2">
                <Download className="h-3.5 w-3.5 text-slate-400" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="text-sm gap-2">
                <Download className="h-3.5 w-3.5 text-slate-400" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => importRef.current?.click()} className="text-sm gap-2">
              <Upload className="h-3.5 w-3.5 text-slate-400" />
              Import JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input ref={importRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />

        {/* Reset */}
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="text-slate-700 border-slate-200 h-8"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>

        {/* Save */}
        <Button
          size="sm"
          onClick={onSave}
          disabled={saveStatus === 'saved' || !validation.isValid || isLoading}
          className="h-8 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  )
}