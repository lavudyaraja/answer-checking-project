'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Activity, CheckCircle2, XCircle, Clock, Edit3, TrendingUp } from 'lucide-react'

interface StatsDialogProps {
  title: string
  description: string
  children: React.ReactNode
  evaluationResults?: any[]
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-6 text-right">{value}</span>
    </div>
  )
}

export function StatsDialog({ title, description, children, evaluationResults = [] }: StatsDialogProps) {
  const total = evaluationResults.length
  const pending  = evaluationResults.filter(r => r.status === 'pending_review').length
  const approved = evaluationResults.filter(r => r.status === 'approved').length
  const rejected = evaluationResults.filter(r => r.status === 'rejected').length
  const revision = evaluationResults.filter(r => r.status === 'needs_revision').length

  const avgConf  = total > 0
    ? evaluationResults.reduce((s, r) => s + r.aiConfidence, 0) / total
    : 0

  const high   = evaluationResults.filter(r => r.aiConfidence >= 80).length
  const medium = evaluationResults.filter(r => r.aiConfidence >= 60 && r.aiConfidence < 80).length
  const low    = evaluationResults.filter(r => r.aiConfidence < 60).length

  const avgScore = total > 0
    ? evaluationResults.reduce((s, r) => s + r.percentage, 0) / total
    : 0

  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-white to-gray-50 px-6 py-5 border-b border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-800 flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-gray-600" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-xs mt-0.5">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6 scrollbar-hide">
          {/* Top KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: total, sub: 'evaluations' },
              { label: 'Avg Score', value: `${avgScore.toFixed(0)}%`, sub: 'percentage' },
              { label: 'Approval', value: `${approvalRate}%`, sub: 'rate' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xl font-black text-gray-800">{kpi.value}</p>
                <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                <p className="text-xs text-gray-400">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status Breakdown</p>
            <div className="space-y-3">
              {[
                { label: 'Pending Review', value: pending,  color: 'bg-sky-400',     textColor: 'text-sky-700',    icon: Clock },
                { label: 'Approved',       value: approved, color: 'bg-emerald-400',  textColor: 'text-emerald-700', icon: CheckCircle2 },
                { label: 'Rejected',       value: rejected, color: 'bg-rose-400',     textColor: 'text-rose-700',   icon: XCircle },
                { label: 'Needs Revision', value: revision, color: 'bg-amber-400',    textColor: 'text-amber-700',  icon: Edit3 },
              ].map(({ label, value, color, textColor, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${textColor} flex-shrink-0`} />
                  <span className="text-sm text-gray-600 w-32 flex-shrink-0">{label}</span>
                  <MiniBar value={value} max={total} color={color} />
                  <span className={`text-xs font-bold ${textColor} w-16 text-right`}>
                    {total > 0 ? Math.round((value / total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Confidence */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Confidence</p>
              <span className={`text-sm font-bold ${avgConf >= 80 ? 'text-emerald-600' : avgConf >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                {avgConf.toFixed(1)}% avg
              </span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'High (80–100%)', value: high,   color: 'bg-emerald-400' },
                { label: 'Medium (60–79%)', value: medium, color: 'bg-amber-400'   },
                { label: 'Low (<60%)',      value: low,    color: 'bg-rose-400'    },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-36 flex-shrink-0">{label}</span>
                  <MiniBar value={value} max={total} color={color} />
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-gray-100 pt-4 space-y-1.5">
            {[
              'Pending Review — awaiting reviewer action',
              'Approved — reviewed and confirmed',
              'Rejected — marked as invalid',
              'Needs Revision — requires re-evaluation',
            ].map(item => (
              <p key={item} className="text-xs text-gray-400">• {item}</p>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}