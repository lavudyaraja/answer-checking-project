/**
 * src/components/sidebar.tsx
 */

'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  FileText, PlusCircle, ClipboardCheck, History, PanelLeft,
  BookOpen, GraduationCap, Award, BarChart3, Home, Brain,
  Sparkles, ChevronRight, Zap, Eye, Settings,
} from 'lucide-react'
import type { AIProvider } from '@/lib/ai/ai-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────────────────────────────────────

const NAVIGATION = [
  {
    title: 'Main',
    items: [
      { title: 'Dashboard', href: '/', icon: Home, description: 'System overview' },
      { title: 'Create Exam', href: '/exams/create', icon: PlusCircle, description: 'Create new examination' },
      { title: 'Exams', href: '/exams', icon: FileText, description: 'View and manage exams' },
      { title: 'Evaluate', href: '/evaluate', icon: ClipboardCheck, description: 'Evaluate student answers' },
      { title: 'Results', href: '/dashboard/results', icon: Award, description: 'View evaluation results' },
      { title: 'Review', href: '/dashboard/review', icon: Eye, description: 'Review and finalise AI evaluations' },
      { title: 'History', href: '/dashboard/history', icon: History, description: 'View evaluation history' },
      { title: 'AI Settings', href: '/dashboard/settings', icon: Settings, description: 'Configure AI evaluation' },
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// AI provider display config
// ─────────────────────────────────────────────────────────────────────────────

const AI_PROVIDERS: {
  value: AIProvider
  label: string
  sublabel: string
  description: string
  icon: React.ElementType
  badge: string
  badgeClass: string
  iconClass: string
  ringClass: string
  gradient: string
}[] = [
    {
      value: 'groq',
      label: 'Groq',
      sublabel: 'Llama 4 Scout',
      description: 'Best for simple image/vision grading',
      icon: Zap,
      badge: 'Fast',
      badgeClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400',
      iconClass: 'text-amber-500',
      ringClass: 'ring-amber-400',
      gradient: 'from-amber-500/10 to-orange-500/5',
    },
    {
      value: 'claude',
      label: 'Claude',
      sublabel: 'Sonnet 4.6',
      description: 'Best for complex handwritten grading',
      icon: Brain,
      badge: 'Smart',
      badgeClass: 'text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400',
      iconClass: 'text-violet-500',
      ringClass: 'ring-violet-400',
      gradient: 'from-violet-500/10 to-purple-500/5',
    },
  ]

const PROVIDER_ORDER: AIProvider[] = ['groq', 'claude']

// ─────────────────────────────────────────────────────────────────────────────
// Logo
// ─────────────────────────────────────────────────────────────────────────────

function GradingLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="13" width="20" height="13" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="10" y="17" width="8" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
      <rect x="10" y="20" width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
      <rect x="10" y="23" width="6" height="1.5" rx="0.75" fill="currentColor" opacity="0.3" />
      <circle cx="22" cy="10" r="6" fill="currentColor" />
      <path d="M19 10.2L21 12.2L25 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13L16 7L28 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ className, collapsed = false, onCollapse }: SidebarProps) {
  const pathname = usePathname()
  const sections = useMemo(() => NAVIGATION, [])

  // Persist selected AI provider in localStorage
  const [aiProvider, setAiProvider] = useState<AIProvider>('groq')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('aiProvider') as AIProvider | null
      if (stored && PROVIDER_ORDER.includes(stored)) setAiProvider(stored)
    } catch { /* storage unavailable */ }
  }, [])

  const updateProvider = (value: AIProvider) => {
    setAiProvider(value)
    try {
      window.localStorage.setItem('aiProvider', value)
      // Show toast notification for model change
      const provider = AI_PROVIDERS.find(p => p.value === value)
      if (provider) {
        // Create a simple notification element
        const notification = document.createElement('div')
        notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm'
        notification.textContent = `Switched to ${provider.label} (${provider.sublabel})`
        document.body.appendChild(notification)

        // Remove after 2 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification)
          }
        }, 2000)
      }
    } catch { /* ignore */ }
  }

  const cycleProvider = () => {
    const next = PROVIDER_ORDER[(PROVIDER_ORDER.indexOf(aiProvider) + 1) % PROVIDER_ORDER.length]
    updateProvider(next)
  }

  const activeProvider = AI_PROVIDERS.find(p => p.value === aiProvider)!

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'relative flex flex-col h-full min-h-0 bg-background border-r',
        'transition-[width] duration-300 ease-in-out overflow-hidden',
        collapsed ? 'w-[68px]' : 'w-[240px]',
        className,
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={cn('flex h-[60px] shrink-0 items-center border-b px-3 gap-2', collapsed && 'justify-center px-0')}>
        <button
          type="button"
          onClick={collapsed ? () => onCollapse?.(false) : undefined}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm',
            collapsed ? 'cursor-pointer hover:opacity-90 transition-opacity' : 'cursor-default',
          )}
          aria-label={collapsed ? 'Expand sidebar' : undefined}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <GradingLogo className="h-5 w-5" />
        </button>

        {!collapsed && (
          <>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight leading-none">AI Grading</span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Exam Evaluator</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Collapse sidebar"
              onClick={() => onCollapse?.(true)}
              className="ml-auto h-8 w-8 shrink-0 p-0 hover:bg-accent"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0 py-3">
        <div className={cn('space-y-5', collapsed ? 'px-2' : 'px-2.5')}>
          {sections.map((section, sIdx) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {section.title}
                </p>
              )}

              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        'group relative flex w-full items-center rounded-lg text-sm font-medium transition-all duration-150',
                        collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <div className="flex h-5 w-5 items-center justify-center shrink-0">
                        <Icon className="h-[15px] w-[15px]" />
                      </div>

                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="truncate leading-tight">{item.title}</div>
                          <div className={cn(
                            'truncate text-[10px] leading-tight mt-0.5',
                            isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
                          )}>
                            {item.description}
                          </div>
                        </div>
                      )}

                      {!collapsed && isActive && (
                        <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                      )}
                    </Link>
                  )
                })}
              </div>

              {sIdx < sections.length - 1 && (
                <Separator className={cn('mt-4', collapsed && 'hidden')} />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* ── AI Provider Selector ────────────────────────────────────────── */}
      <div className="shrink-0 border-t">
        {collapsed ? (
          /* Collapsed: icon cycles through providers */
          <div className="flex justify-center p-3">
            <button
              type="button"
              title={`Switch AI — currently ${activeProvider.label} (${activeProvider.sublabel})`}
              onClick={cycleProvider}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
                'ring-2 ring-offset-1 ring-offset-background',
                activeProvider.iconClass,
                activeProvider.ringClass,
                `bg-gradient-to-br ${activeProvider.gradient}`,
              )}
            >
              <activeProvider.icon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Expanded: full card picker */
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-0.5">
              AI Model
            </p>
            <div className="space-y-1.5">
              {AI_PROVIDERS.map(provider => {
                const Icon = provider.icon
                const isSelected = aiProvider === provider.value

                return (
                  <button
                    key={provider.value}
                    type="button"
                    onClick={() => updateProvider(provider.value)}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200',
                      'border text-sm',
                      isSelected
                        ? `bg-gradient-to-r ${provider.gradient} border-primary/20 shadow-sm`
                        : 'border-transparent hover:bg-accent hover:border-border',
                    )}
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isSelected
                        ? `bg-gradient-to-br ${provider.gradient} ring-1 ${provider.ringClass}/30`
                        : 'bg-muted',
                      provider.iconClass,
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('font-semibold text-[12px] leading-none', isSelected ? 'text-foreground' : 'text-foreground/80')}>
                          {provider.label}
                        </span>
                        <span className={cn('text-[10px] leading-none font-medium px-1.5 py-0.5 rounded-full', provider.badgeClass)}>
                          {provider.badge}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {provider.sublabel} · {provider.description}
                      </div>
                    </div>

                    <div className={cn(
                      'h-2 w-2 shrink-0 rounded-full transition-all',
                      isSelected ? `bg-current ${provider.iconClass}` : 'bg-transparent',
                    )} />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}