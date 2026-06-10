'use client'

import React, { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  children: string
  className?: string
  displayMode?: boolean
}

export function MathRenderer({ children, className = '', displayMode = false }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    try {
      // Normalize input: remove excessive newlines and clean up spacing
      const normalizedText = children
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive blank lines
        .replace(/\n+/g, ' ') // Replace newlines with spaces for math rendering
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim()
      
      // Split text into math and non-math parts
      const parts = normalizedText.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/)
      
      let html = ''
      parts.forEach(part => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          // Display math (block)
          const math = part.slice(2, -2).trim()
          if (math) {
            html += katex.renderToString(math, {
              displayMode: true,
              throwOnError: false
            })
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          // Inline math
          const math = part.slice(1, -1).trim()
          if (math) {
            html += katex.renderToString(math, {
              displayMode: false,
              throwOnError: false
            })
          }
        } else if (part.trim()) {
          // Regular text - also handle common mathematical patterns
          let processedText = part
            // Clean up any remaining newlines in regular text
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            
          processedText = processedText
            // Handle function notation like f(x)
            .replace(/([a-zA-Z])\(([^)]+)\)/g, '<span class="font-mono">$1(<span class="text-blue-600">$2</span>)</span>')
            // Handle superscripts (exponents)
            .replace(/\^(\w+|\{[^}]+\})/g, '<sup>$1</sup>')
            // Handle subscripts
            .replace(/_(\w+|\{[^}]+\})/g, '<sub>$1</sub>')
            // Handle fractions like 3x^2 + 5x - 4
            .replace(/(\d+)x\^(\d+)/g, '<span class="font-mono">$1x<sup>$2</sup></span>')
            // Handle implicit exponents like 3x2 (should be 3x^2)
            .replace(/(\d+)x(\d+)/g, '<span class="font-mono">$1x<sup>$2</sup></span>')
            // Handle simple fractions with /
            .replace(/(\d+)\s*\/\s*(\d+)/g, '<span class="font-mono"><span class="border-t border-gray-400">$1</span><span class="text-xs">/$2</span></span>')
            // Handle mathematical symbols
            .replace(/±/g, '±')
            .replace(/≈/g, '≈')
            .replace(/≠/g, '≠')
            .replace(/≤/g, '≤')
            .replace(/≥/g, '≥')
            .replace(/∞/g, '∞')
            .replace(/√/g, '√')
            .replace(/∑/g, '∑')
            .replace(/∏/g, '∏')
            .replace(/∫/g, '∫')
            .replace(/∂/g, '∂')
            .replace(/∇/g, '∇')
            .replace(/∈/g, '∈')
            .replace(/∉/g, '∉')
            .replace(/⊂/g, '⊂')
            .replace(/⊃/g, '⊃')
            .replace(/∪/g, '∪')
            .replace(/∩/g, '∩')
            .replace(/∅/g, '∅')
            .replace(/∀/g, '∀')
            .replace(/∃/g, '∃')
            .replace(/→/g, '→')
            .replace(/←/g, '←')
            .replace(/↔/g, '↔')
            .replace(/⇒/g, '⇒')
            .replace(/⇐/g, '⇐')
            .replace(/⇔/g, '⇔')
            // Handle Greek letters
            .replace(/\\alpha/g, 'α')
            .replace(/\\beta/g, 'β')
            .replace(/\\gamma/g, 'γ')
            .replace(/\\delta/g, 'δ')
            .replace(/\\epsilon/g, 'ε')
            .replace(/\\zeta/g, 'ζ')
            .replace(/\\eta/g, 'η')
            .replace(/\\theta/g, 'θ')
            .replace(/\\iota/g, 'ι')
            .replace(/\\kappa/g, 'κ')
            .replace(/\\lambda/g, 'λ')
            .replace(/\\mu/g, 'μ')
            .replace(/\\nu/g, 'ν')
            .replace(/\\xi/g, 'ξ')
            .replace(/\\pi/g, 'π')
            .replace(/\\rho/g, 'ρ')
            .replace(/\\sigma/g, 'σ')
            .replace(/\\tau/g, 'τ')
            .replace(/\\upsilon/g, 'υ')
            .replace(/\\phi/g, 'φ')
            .replace(/\\chi/g, 'χ')
            .replace(/\\psi/g, 'ψ')
            .replace(/\\omega/g, 'ω')
            .replace(/\\Gamma/g, 'Γ')
            .replace(/\\Delta/g, 'Δ')
            .replace(/\\Theta/g, 'Θ')
            .replace(/\\Lambda/g, 'Λ')
            .replace(/\\Xi/g, 'Ξ')
            .replace(/\\Pi/g, 'Π')
            .replace(/\\Sigma/g, 'Σ')
            .replace(/\\Upsilon/g, 'Υ')
            .replace(/\\Phi/g, 'Φ')
            .replace(/\\Psi/g, 'Ψ')
            .replace(/\\Omega/g, 'Ω')
          
          html += `<span class="math-text">${processedText}</span>`
        }
      })

      containerRef.current.innerHTML = html
    } catch (error) {
      console.error('Math rendering error:', error)
      if (containerRef.current) {
        containerRef.current.textContent = children
      }
    }
  }, [children])

  return (
    <div 
      ref={containerRef} 
      className={`math-renderer ${className}`}
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.6'
      }}
    />
  )
}
