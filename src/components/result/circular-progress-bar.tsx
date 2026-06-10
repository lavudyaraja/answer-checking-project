'use client'

import { useEffect, useState, useRef } from 'react'

interface ScoreArcDisplayProps {
  percentage: number
  totalMarks: number
  maxMarks: number
  grade: string
  animationDuration?: number
}

function getColor(pct: number) {
  if (pct >= 85) return { primary: '#10b981', secondary: '#d1fae5', label: 'Excellent', glow: '#10b98140' }
  if (pct >= 70) return { primary: '#22c55e', secondary: '#dcfce7', label: 'Good',      glow: '#22c55e40' }
  if (pct >= 55) return { primary: '#f59e0b', secondary: '#fef3c7', label: 'Average',   glow: '#f59e0b40' }
  if (pct >= 40) return { primary: '#f97316', secondary: '#ffedd5', label: 'Below Avg', glow: '#f9731640' }
  return           { primary: '#ef4444', secondary: '#fee2e2', label: 'Needs Work', glow: '#ef444440' }
}

function getGradeColors(grade: string) {
  const key = grade?.charAt(0).toUpperCase() ?? 'F'
  const map: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
    B: { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
    C: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
    D: { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
    F: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  }
  return map[key] ?? map['F']
}

export function ScoreArcDisplay({
  percentage,
  totalMarks,
  maxMarks,
  grade,
  animationDuration = 1400,
}: ScoreArcDisplayProps) {
  const safe = Math.max(0, Math.min(100, Number(percentage) || 0))
  const [displayPct, setDisplayPct] = useState(0)
  const [displayMarks, setDisplayMarks] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

    function animate(ts: number) {
      if (!startRef.current) startRef.current = ts
      const t = Math.min((ts - startRef.current) / animationDuration, 1)
      const e = ease(t)
      setDisplayPct(Math.round(safe * e))
      setDisplayMarks(parseFloat((totalMarks * e).toFixed(1)))
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [safe, totalMarks, animationDuration])

  const colors = getColor(safe)
  const gradeColors = getGradeColors(grade)

  // Arc geometry — 240° sweep starting from 150° (bottom-left)
  const SIZE = 200
  const CX = 100
  const CY = 100
  const R = 76
  const startAngle = 150
  const totalAngle = 240
  const sweepAngle = (displayPct / 100) * totalAngle

  function polarToXY(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
  }

  function arcPath(start: number, sweep: number, r: number, strokeW: number) {
    if (sweep <= 0) return ''
    const end = start + sweep
    const s = polarToXY(start, r)
    const e = polarToXY(end, r)
    const large = sweep > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  // Tick marks at 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Arc gauge */}
      <div className="relative" style={{ width: SIZE, height: SIZE * 0.82 }}>
        {/* Glow effect */}
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            inset: '20px',
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          }}
        />

        <svg width={SIZE} height={SIZE * 0.82} viewBox={`0 0 ${SIZE} ${SIZE * 0.82}`}>
          {/* Track */}
          <path
            d={arcPath(startAngle, totalAngle, R, 12)}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={12}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {displayPct > 0 && (
            <path
              d={arcPath(startAngle, sweepAngle, R, 12)}
              fill="none"
              stroke={colors.primary}
              strokeWidth={12}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${colors.primary}80)` }}
            />
          )}
          {/* Tick marks */}
          {ticks.map((tick) => {
            const angle = startAngle + (tick / 100) * totalAngle
            const outer = polarToXY(angle, R + 18)
            const inner = polarToXY(angle, R + 10)
            const isPassed = tick <= displayPct
            return (
              <line
                key={tick}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke={isPassed ? colors.primary : '#cbd5e1'}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )
          })}
          {/* Needle tip dot */}
          {displayPct > 0 && (() => {
            const tip = polarToXY(startAngle + sweepAngle, R)
            return (
              <circle
                cx={tip.x}
                cy={tip.y}
                r={5}
                fill={colors.primary}
                style={{ filter: `drop-shadow(0 0 4px ${colors.primary})` }}
              />
            )
          })()}
          {/* Center content */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fontSize="28"
            fontWeight="800"
            fill={colors.primary}
            fontFamily="system-ui"
          >
            {displayPct}%
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="system-ui">
            SCORE
          </text>
          {/* Marks below */}
          <text
            x={CX}
            y={CY + 30}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#475569"
            fontFamily="system-ui"
          >
            {displayMarks} / {maxMarks}
          </text>
          {/* Min/Max labels */}
          <text x={polarToXY(startAngle, R + 26).x} y={polarToXY(startAngle, R + 26).y + 3}
            textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui">0</text>
          <text x={polarToXY(startAngle + totalAngle, R + 26).x} y={polarToXY(startAngle + totalAngle, R + 26).y + 3}
            textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui">100</text>
        </svg>
      </div>

      {/* Grade badge + performance label */}
      <div className="flex items-center gap-2 mt-0.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black border-2 shadow-sm"
          style={{ background: gradeColors.bg, color: gradeColors.text, borderColor: gradeColors.border }}
        >
          {grade}
        </div>
        <div
          className="px-3 py-1 rounded-full text-xs font-bold tracking-wide border"
          style={{ background: colors.secondary, color: colors.primary, borderColor: colors.primary + '50' }}
        >
          {colors.label}
        </div>
      </div>
    </div>
  )
}