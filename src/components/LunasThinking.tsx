'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CircleCheckBig, Blend, Telescope } from 'lucide-react'
import { ExtractedContextVariant, isEmergentContext } from '@/lib/types'
import { cn } from '@/lib/utils'

interface LunasThinkingProps {
  extractedContext: ExtractedContextVariant | null
  thoughts: string
}

export function LunasThinking({ extractedContext, thoughts }: LunasThinkingProps) {
  const [reflectionExpanded, setReflectionExpanded] = useState(false)
  const [reasoningExpanded, setReasoningExpanded] = useState(false)

  const isEmergent = extractedContext ? isEmergentContext(extractedContext) : false
  const themes = isEmergent && 'themes' in extractedContext! ? extractedContext.themes : []
  const summary = extractedContext?.reflective_summary

  const hasThemes = themes.length > 0
  const hasStrengths = (summary?.strengths?.length ?? 0) > 0
  const hasEmerging = (summary?.emerging?.length ?? 0) > 0
  const hasOpportunities = (summary?.opportunities_for_enrichment?.length ?? 0) > 0
  const hasSummary = hasStrengths || hasEmerging || hasOpportunities
  const hasThoughts = !!thoughts
  const summaryCount = [hasStrengths, hasEmerging, hasOpportunities].filter(Boolean).length

  if (!hasThemes && !hasSummary && !hasThoughts) {
    return (
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center py-12 text-muted-foreground">
          No insights captured yet.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 space-y-8">
      {/* Themes - full cards with content visible */}
      {hasThemes && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Key Themes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {themes.map((theme, idx) => (
              <div key={idx} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <h3 className="font-medium text-foreground mb-2">
                  {theme.theme_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {theme.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reflective Summary - accordion with 3 card grid */}
      {hasSummary && (
        <section>
          <button
            onClick={() => setReflectionExpanded(!reflectionExpanded)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors">
                  Reflection
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  What's clear, emerging, and worth exploring
                </p>
              </div>
              {reflectionExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
          </button>
          {reflectionExpanded && (
            <div className={cn(
              'grid gap-4 mt-4',
              summaryCount === 1 && 'grid-cols-1 max-w-md',
              summaryCount === 2 && 'grid-cols-1 sm:grid-cols-2',
              summaryCount === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            )}>
              {hasStrengths && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <CircleCheckBig className="h-4 w-4" />
                    What's Clear
                  </h3>
                  <ul className="space-y-2">
                    {summary!.strengths.map((item, idx) => (
                      <li key={idx} className="text-sm text-foreground flex gap-2">
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasEmerging && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Blend className="h-4 w-4" />
                    What's Emerging
                  </h3>
                  <ul className="space-y-2">
                    {summary!.emerging.map((item, idx) => (
                      <li key={idx} className="text-sm text-foreground flex gap-2">
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasOpportunities && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Telescope className="h-4 w-4" />
                    Worth Exploring
                  </h3>
                  <ul className="space-y-2">
                    {summary!.opportunities_for_enrichment.map((item, idx) => (
                      <li key={idx} className="text-sm text-foreground flex gap-2">
                        <span className="text-muted-foreground shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Luna's Reasoning - accordion */}
      {hasThoughts && (
        <section>
          <button
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors">
                  Luna's Reasoning
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  The rationale behind your strategy
                </p>
              </div>
              {reasoningExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
          </button>
          {reasoningExpanded && (
            <div className="mt-4 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {thoughts}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
