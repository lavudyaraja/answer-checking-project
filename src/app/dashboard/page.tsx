'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PlusCircle,
  FileText,
  ClipboardCheck,
  Award,
  History,
  Users,
  BookOpen,
  BarChart3,
  GraduationCap,
  Brain,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Target,
  Activity,
  Filter,
  Download,
  RefreshCw,
  Settings,
  Bell,
  Search,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  ChevronRight,
  X,
  SlidersHorizontal,
  Inbox,
  LayoutDashboard,
  FileSearch,
  LogOut,
  HelpCircle,
  Menu,
  AlertTriangle,
  RotateCcw,
  ListFilter,
  Calendar,
  CheckCheck,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface EvaluationStats {
  total: number
  completed: number
  processing: number
  failed: number
  queued: number
  monthlyGrowth: number
}

interface SubjectStat {
  name: string
  count: number
  avgScore: number
  color: string
}

interface LevelPerformance {
  level: string
  exams: number
  students: number
  avgScore: number
}

interface TrendPoint {
  month: string
  evaluations: number
  avgScore: number
}

interface AIModel {
  name: string
  accuracy: number
  speed: number
  usagePercent: number
  status: 'active' | 'standby' | 'error'
}

interface ActivityItem {
  id: string
  type: 'evaluation' | 'upload' | 'exam' | 'error' | 'export'
  description: string
  subject?: string
  time: string
  status: 'completed' | 'processing' | 'failed' | 'queued'
}

interface SystemHealth {
  uptime: number
  responseTime: number
  errorRate: number
  throughput: number
}

interface DashboardData {
  stats: EvaluationStats
  subjects: SubjectStat[]
  levels: LevelPerformance[]
  trends: TrendPoint[]
  aiModels: AIModel[]
  activity: ActivityItem[]
  system: SystemHealth
  activeStudents: number
  averageScore: number
  pendingReviews: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META = {
  completed: { label: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  processing: { label: 'Processing', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  failed: { label: 'Failed', color: 'text-red-700 bg-red-50 border-red-200' },
  queued: { label: 'Queued', color: 'text-amber-700 bg-amber-50 border-amber-200' },
}

const MODEL_STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  standby: 'bg-amber-400',
  error: 'bg-red-500',
}

function StatusBadge({ status }: { status: keyof typeof STATUS_META | string }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] || STATUS_META.processing // fallback to processing
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${meta.color}`}>
      {status === 'processing' && <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />}
      {meta.label}
    </span>
  )
}

function StatChange({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  )
}

const Divider = () => <div className="border-t border-gray-100" />

// Skeleton
const SkeletonLine = ({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) => (
  <div className={`${w} ${h} bg-gray-100 rounded animate-pulse`} />
)

// ── Sidebar Nav ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: PlusCircle, label: 'Create Exam', href: '/exams/create' },
  { icon: ClipboardCheck, label: 'Evaluate', href: '/evaluate' },
  { icon: FileSearch, label: 'Results', href: '/results' },
  { icon: History, label: 'History', href: '/history' },
  { icon: Upload, label: 'Upload Sheets', href: '/upload' },
  { icon: BarChart3, label: 'Reports', href: '/reports' },
  { icon: Users, label: 'Students', href: '/students' },
]

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full flex flex-col bg-white border-r border-gray-200 z-40 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'
        }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
        <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
          <Brain className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 tracking-tight leading-none">GradeAI</p>
            <p className="text-[10px] text-gray-400 mt-0.5 tracking-wide uppercase">Evaluation Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${item.active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 p-2 space-y-0.5">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <Link
          href="/help"
          className={`flex items-center gap-3 px-2 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <HelpCircle className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Help</span>}
        </Link>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Menu className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function Topbar({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean
  onRefresh: () => void
}) {

  return (
    <header className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-6 border-b border-gray-200 z-30">
      {/* Left */}
      <div className="flex items-center gap-4">
        {/* Title and subtitle removed */}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Removed search, alerts, refresh, and new evaluation buttons */}
      </div>
    </header>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  change,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  change?: number
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-bold mt-1 tracking-tight ${accent}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {change !== undefined && (
            <div className="mt-2">
              <StatChange value={change} />
              <span className="text-xs text-gray-400 ml-1">vs last month</span>
            </div>
          )}
        </div>
        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </div>
    </div>
  )
}

// ── Evaluation Queue Table ─────────────────────────────────────────────────────

function EvaluationQueue({ items, onRetry }: { items: ActivityItem[]; onRetry: (id: string) => void }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Evaluation Queue</h3>
          <span className="text-xs text-gray-400 font-normal ml-1">({items.length} total)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-md overflow-hidden text-xs">
            {['all', 'processing', 'queued', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 capitalize transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5 uppercase tracking-wide">Description</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 uppercase tracking-wide">Subject</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 uppercase tracking-wide">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 uppercase tracking-wide">Time</th>
              <th className="text-right text-xs font-medium text-gray-500 px-5 py-2.5 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-gray-400">
                  No evaluations match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-500' :
                        item.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                          item.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'
                        }`} />
                      <span className="text-gray-800 font-medium text-xs">{item.description}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-500">{item.subject ?? '—'}</span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-400 font-mono">{item.time}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {item.status === 'failed' ? (
                      <button
                        onClick={() => onRetry(item.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </button>
                    ) : item.status === 'completed' ? (
                      <Link href={`/results/${item.id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium">
                        View
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Subject Distribution ──────────────────────────────────────────────────────

const SUBJECT_COLORS = ['#111827', '#374151', '#6b7280', '#d1d5db', '#9ca3af', '#4b5563']

function SubjectPanel({ subjects }: { subjects: SubjectStat[] }) {
  const max = Math.max(...subjects.map((s) => s.count), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">By Subject</h3>
        </div>
        <button className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
          <ListFilter className="h-3 w-3" />
          Sort
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {subjects.map((s, i) => (
          <div key={s.name} className="flex items-center gap-4 px-5 py-3">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-800 truncate">{s.name}</span>
                <span className="text-xs font-mono text-gray-500 ml-2">{s.count}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all duration-500"
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-400 font-mono w-10 text-right">{s.avgScore}%</span>
          </div>
        ))}
        {subjects.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No subject data available.</p>
        )}
      </div>
    </div>
  )
}

// ── Level Performance ─────────────────────────────────────────────────────────

function LevelPanel({ levels }: { levels: LevelPerformance[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Education Levels</h3>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {levels.map((l) => (
          <div key={l.level} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">{l.level}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{l.students.toLocaleString()} students</span>
                <span className="font-mono">{l.avgScore}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all duration-500"
                  style={{ width: `${l.avgScore}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 font-mono w-12 text-right">{l.exams} exams</span>
            </div>
          </div>
        ))}
        {levels.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No level data available.</p>
        )}
      </div>
    </div>
  )
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function TrendChart({ data, title }: { data: TrendPoint[]; title: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-gray-900 inline-block rounded" />Evaluations</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-gray-300 inline-block rounded" />Avg Score</span>
        </div>
      </div>
      <div className="px-5 py-4">
        {data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">No trend data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111827" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxShadow: 'none' }}
                cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="evaluations" stroke="#111827" strokeWidth={2} fill="url(#evalGrad)" dot={false} />
              <Area type="monotone" dataKey="avgScore" stroke="#9ca3af" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── Agent System Panel ───────────────────────────────────────────────────────

const AGENT_ROLES = [
  {
    id: 'Coordinator',
    label: 'Coordinator Agent',
    description: 'Detects subject, routes task to the right expert.',
    icon: Brain,
    color: 'text-violet-600 bg-violet-50',
    dot: 'bg-violet-500',
  },
  {
    id: 'Expert',
    label: 'Subject Expert Agent',
    description: 'Reads handwriting like a teacher, grades each question.',
    icon: GraduationCap,
    color: 'text-blue-600 bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    id: 'Reviewer',
    label: 'Reviewer Agent',
    description: 'Audits marks for consistency and bias correction.',
    icon: Shield,
    color: 'text-emerald-600 bg-emerald-50',
    dot: 'bg-emerald-500',
  },
]

function AgentSystemPanel({ activeAgent, subject }: { activeAgent?: string | null; subject?: string | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Agent System</h3>
          {subject && (
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {subject}
            </span>
          )}
        </div>
        {activeAgent && activeAgent !== 'Complete' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
            Live
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {AGENT_ROLES.map((agent) => {
          const isActive =
            activeAgent &&
            activeAgent !== 'Complete' &&
            (activeAgent === agent.id ||
              (agent.id === 'Expert' && activeAgent?.toLowerCase().includes('expert')))
          const isDone =
            activeAgent === 'Complete' ||
            (agent.id === 'Coordinator' && activeAgent && activeAgent !== 'System') ||
            (agent.id === 'Expert' && activeAgent === 'Reviewer') ||
            (agent.id === 'Expert' && activeAgent === 'Complete')

          return (
            <div key={agent.id} className="flex items-start gap-4 px-5 py-4">
              <div className={`p-2 rounded-lg flex-shrink-0 ${agent.color}`}>
                <agent.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-900">{agent.label}</span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                      <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${agent.dot}`} />
                      Active
                    </span>
                  )}
                  {!isActive && isDone && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <CheckCircle className="h-3 w-3" />
                      Done
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{agent.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── System Health ─────────────────────────────────────────────────────────────

function SystemHealthPanel({ health }: { health: SystemHealth | null }) {
  if (!health) return null

  const metrics = [
    { label: 'Uptime', value: `${health.uptime}%`, good: health.uptime > 99, unit: '' },
    { label: 'Resp. Time', value: `${health.responseTime}s`, good: health.responseTime < 1, unit: '' },
    { label: 'Error Rate', value: `${health.errorRate}%`, good: health.errorRate < 1, unit: '' },
    { label: 'Throughput', value: String(health.throughput), good: true, unit: '/hr' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">System Health</h3>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-gray-100">
        {metrics.map((m) => (
          <div key={m.label} className="px-4 py-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className={`text-xl font-bold font-mono ${m.good ? 'text-gray-900' : 'text-red-600'}`}>
              {m.value}
            </p>
            <span className={`inline-block mt-1 h-1 w-8 rounded-full ${m.good ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 border-2 border-gray-200 rounded-2xl flex items-center justify-center mb-5">
        <BarChart3 className="h-7 w-7 text-gray-300" />
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">No data yet</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        Create your first exam and start evaluating to see analytics here.
      </p>
      <div className="flex gap-3">
        <Link
          href="/exams/create"
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Create Exam
        </Link>
        <Link
          href="/upload"
          className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload Sheets
        </Link>
      </div>
    </div>
  )
}

// ── Loading State ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <SkeletonLine w="w-24" h="h-3" />
            <SkeletonLine w="w-16" h="h-8" />
            <SkeletonLine w="w-32" h="h-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <SkeletonLine w="w-40" h="h-3" />
          <SkeletonLine w="w-full" h="h-48" />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <SkeletonLine w="w-24" h="h-3" />
          {[...Array(5)].map((_, i) => (
            <SkeletonLine key={i} w="w-full" h="h-8" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Error Banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 flex-1">Failed to load dashboard data. Check your API connection.</p>
      <button
        onClick={onRetry}
        className="text-xs font-medium text-red-700 border border-red-300 rounded-md px-3 py-1.5 hover:bg-red-100 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

// ── Filter Modal ──────────────────────────────────────────────────────────────

function FilterModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  const subjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Computer Science']
  const levels = ['Beginner', 'Intermediate', 'Expert']
  const statuses = ['Completed', 'Processing', 'Failed', 'Queued']

  const handleApply = () => {
    console.log('Applying filters:', { selectedSubjects, selectedLevels, selectedStatus })
    onClose()
  }

  const handleReset = () => {
    setSelectedSubjects([])
    setSelectedLevels([])
    setSelectedStatus([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Filter Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Subjects */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Subjects</h3>
            <div className="space-y-2">
              {subjects.map((subject) => (
                <label key={subject} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSubjects([...selectedSubjects, subject])
                      } else {
                        setSelectedSubjects(selectedSubjects.filter(s => s !== subject))
                      }
                    }}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-700">{subject}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Levels */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Education Levels</h3>
            <div className="space-y-2">
              {levels.map((level) => (
                <label key={level} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedLevels.includes(level)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLevels([...selectedLevels, level])
                      } else {
                        setSelectedLevels(selectedLevels.filter(l => l !== level))
                      }
                    }}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-700">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Evaluation Status</h3>
            <div className="space-y-2">
              {statuses.map((status) => (
                <label key={status} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedStatus.includes(status)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStatus([...selectedStatus, status])
                      } else {
                        setSelectedStatus(selectedStatus.filter(s => s !== status))
                      }
                    }}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-700">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleReset}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [alerts] = useState(3)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [liveAgent, setLiveAgent] = useState<{ activeAgent: string | null; subject: string | null }>({
    activeAgent: null,
    subject: null,
  })

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const res = await fetch(`/api/dashboard/stats?timeRange=${timeRange}`)
      if (!res.ok) throw new Error('Non-ok response')
      const json: DashboardData = await res.json()
      setData(json)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Live agent polling — checks if any task is currently running
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('lastFileId') : null
    if (!stored) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/evaluate/status?fileId=${stored}`)
        if (res.ok) {
          const s = await res.json()
          setLiveAgent({ activeAgent: s.activeAgent, subject: s.subject })
          if (s.completed) clearInterval(interval)
        }
      } catch { /* silent */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleRetry = (id: string) => {
    fetch(`/api/evaluate/evaluations/${id}/retry`, { method: 'POST' }).then(() => fetchData())
  }

  const handleExport = () => {
    if (!data) return

    // Create CSV content
    const csvContent = [
      'Dashboard Export Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Time Range: ${timeRange}`,
      '',
      'Key Metrics',
      'Metric,Value',
      `Total Evaluations,${data.stats.total}`,
      `Completed,${data.stats.completed}`,
      `Processing,${data.stats.processing}`,
      `Failed,${data.stats.failed}`,
      `Queued,${data.stats.queued}`,
      `Active Students,${data.activeStudents}`,
      `Average Score,${data.averageScore}%`,
      `Pending Reviews,${data.pendingReviews}`,
      '',
      'Subject Performance',
      'Subject,Count,Average Score',
      ...data.subjects.map(s => `${s.name},${s.count},${s.avgScore}%`),
      '',
      'Level Performance',
      'Level,Exams,Students,Average Score',
      ...data.levels.map(l => `${l.level},${l.exams},${l.students},${l.avgScore}%`),
      '',
      'AI Models',
      'Model,Accuracy,Speed,Usage,Status',
      ...data.aiModels.map(m => `${m.name},${m.accuracy}%,${m.speed}%,${m.usagePercent}%,${m.status}`),
      '',
      'System Health',
      'Metric,Value',
      `Uptime,${data.system?.uptime || 'N/A'}%`,
      `Response Time,${data.system?.responseTime || 'N/A'}s`,
      `Error Rate,${data.system?.errorRate || 'N/A'}%`,
      `Throughput,${data.system?.throughput || 'N/A'}/hr`
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `dashboard-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isEmpty = !isLoading && !hasError && !data

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Main */}
      <main className="min-h-screen">
        <div className="p-6 max-w-[1440px] space-y-6">
          {/* Dashboard Container with curvy border */}
          <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-3xl shadow-sm p-6 space-y-6">
            {/* Light curvy arc border decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50 rounded-3xl opacity-30 -z-10" />

            {/* Error */}
            {hasError && <ErrorBanner onRetry={fetchData} />}

            {/* Loading */}
            {isLoading && <LoadingState />}

            {/* Empty */}
            {isEmpty && <EmptyDashboard />}

            {/* Content */}
            {!isLoading && !hasError && data && (
              <>
                {/* Time Range + Actions Row */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 bg-white rounded-lg p-1">
                    {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors rounded-md ${timeRange === r
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFilterModal(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Filter className="h-3 w-3" />
                      Filter
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Export Report
                    </button>
                  </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Evaluations"
                    value={data.stats.total.toLocaleString()}
                    change={data.stats.monthlyGrowth}
                    icon={BarChart3}
                    accent="text-gray-900"
                  />
                  <StatCard
                    label="Active Students"
                    value={data.activeStudents.toLocaleString()}
                    sub="Across all levels"
                    icon={Users}
                    accent="text-gray-900"
                  />
                  <StatCard
                    label="Average Score"
                    value={`${data.averageScore}%`}
                    icon={Target}
                    accent="text-gray-900"
                  />
                  <StatCard
                    label="AI Processing"
                    value={data.stats.processing}
                    sub="Evaluations in progress"
                    icon={Cpu}
                    accent="text-gray-900"
                  />
                </div>

                {/* Secondary KPIs */}
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Completed', value: data.stats.completed, color: 'text-emerald-700' },
                    { label: 'In Queue', value: data.stats.queued, color: 'text-amber-700' },
                    { label: 'Failed', value: data.stats.failed, color: 'text-red-600' },
                    { label: 'Pending Reviews', value: data.pendingReviews, color: 'text-gray-900' },
                    { label: 'Subjects', value: data.subjects.length, color: 'text-gray-900' },
                    { label: 'Levels', value: data.levels.length, color: 'text-gray-900' },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
                      <p className={`text-lg font-bold font-mono ${m.color}`}>{m.value.toLocaleString()}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex items-center justify-center border-b border-gray-200 bg-white rounded-t-xl px-4">
                    <TabsList className="bg-transparent h-12 gap-0 p-0 border-2 rounded-lg ">
                      {[
                        { value: 'overview', label: 'Overview', icon: LayoutDashboard },
                        { value: 'queue', label: 'Queue', icon: Inbox },
                        { value: 'analytics', label: 'Analytics', icon: TrendingUp },
                        { value: 'ai', label: 'AI Models', icon: Sparkles },
                        { value: 'health', label: 'System', icon: Shield },
                      ].map((t) => (
                        <TabsTrigger
                          key={t.value}
                          value={t.value}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 data-[state=active]:text-gray-900 data-[state=active]:border-gray-900"
                        >
                          <t.icon className="h-3.5 w-3.5" />
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-0">
                    <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-5">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Trend - spans 2 cols */}
                        <div className="lg:col-span-2">
                          <TrendChart data={data.trends} title="Evaluation Trends" />
                        </div>
                        {/* Subject */}
                        <SubjectPanel subjects={data.subjects} />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <LevelPanel levels={data.levels} />
                        <AgentSystemPanel activeAgent={liveAgent.activeAgent} subject={liveAgent.subject} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Queue Tab */}
                  <TabsContent value="queue" className="mt-0">
                    <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-5">
                      <EvaluationQueue items={data.activity} onRetry={handleRetry} />
                    </div>
                  </TabsContent>

                  {/* Analytics Tab */}
                  <TabsContent value="analytics" className="mt-0">
                    <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-5 space-y-6">
                      <TrendChart data={data.trends} title="Evaluations & Score Over Time" />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SubjectPanel subjects={data.subjects} />
                        <LevelPanel levels={data.levels} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* AI Tab */}
                  <TabsContent value="ai" className="mt-0">
                    <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AgentSystemPanel activeAgent={liveAgent.activeAgent} subject={liveAgent.subject} />
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Model Benchmarks</h3>
                          </div>
                          {data.aiModels && data.aiModels.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart
                                data={data.aiModels.map((m) => ({
                                  name: m.name ? m.name.split(' ')[0] : 'Unknown',
                                  accuracy: m.accuracy || 0,
                                  speed: m.speed || 0,
                                }))}
                                margin={{ top: 12, right: 12, left: -12, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxShadow: 'none' }} />
                                <Bar dataKey="accuracy" fill="#111827" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="speed" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-10">No model data yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* System Health Tab */}
                  <TabsContent value="health" className="mt-0">
                    <div className="bg-white border border-gray-200 border-t-0 rounded-b-xl p-5 space-y-6">
                      <SystemHealthPanel health={data.system} />
                      {/* Completion breakdown */}
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: 'Completion Rate', value: ((data.stats.completed / Math.max(data.stats.total, 1)) * 100).toFixed(1), color: 'text-emerald-700', bar: 'bg-emerald-500' },
                          { label: 'Processing Rate', value: ((data.stats.processing / Math.max(data.stats.total, 1)) * 100).toFixed(1), color: 'text-blue-700', bar: 'bg-blue-500' },
                          { label: 'Error Rate', value: ((data.stats.failed / Math.max(data.stats.total, 1)) * 100).toFixed(1), color: 'text-red-600', bar: 'bg-red-500' },
                        ].map((m) => (
                          <div key={m.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                            <p className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}%</p>
                            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${m.bar} rounded-full`} style={{ width: `${m.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Bottom Quick Actions Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Create Exam', icon: PlusCircle, href: '/exams/create', desc: 'Set up new examination' },
                    { label: 'Upload Sheets', icon: Upload, href: '/upload', desc: 'Bulk answer sheet upload' },
                    { label: 'View Results', icon: Award, href: '/results', desc: 'All graded evaluations' },
                    { label: 'Export Data', icon: Download, href: '/reports', desc: 'Download CSV or PDF' },
                  ].map((a) => (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="group flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-gray-400 transition-all duration-150"
                    >
                      <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg group-hover:bg-gray-100 transition-colors">
                        <a.icon className="h-4 w-4 text-gray-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-none">{a.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-gray-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Filter Modal */}
      <FilterModal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} />
    </div>
  )
}