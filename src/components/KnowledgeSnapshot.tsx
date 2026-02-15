'use client'

/**
 * Static snapshot of the knowledgebase at the time strategy was generated.
 * Renders fragment contents from the trace's extractedContext field.
 *
 * Three extractedContext shapes exist:
 * - Initial generation: { source: 'fragments', fragmentCount, fragments: string[] }
 * - Refresh generation: { type: 'refresh', delta: { newFragmentCount, removedFragmentCount, summaries } }
 * - Legacy (pre-pipeline): { themes: [{ theme_name, content }], extraction_approach }
 */

interface KnowledgeSnapshotProps {
  extractedContext: Record<string, unknown> | null
  timestamp: string | null
}

export function KnowledgeSnapshot({ extractedContext, timestamp }: KnowledgeSnapshotProps) {
  if (!extractedContext) {
    return (
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center py-12 text-muted-foreground">
          No knowledge snapshot available for this strategy.
        </div>
      </div>
    )
  }

  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  // Current pipeline: initial generation stores fragment contents
  if (extractedContext.source === 'fragments') {
    const fragments = (extractedContext.fragments as string[]) || []
    const count = (extractedContext.fragmentCount as number) || fragments.length

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {count} insight{count !== 1 ? 's' : ''} used to generate this strategy
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fragments.map((content, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4">
              <p className="text-sm text-foreground">{content}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Current pipeline: refresh generation stores delta
  if (extractedContext.type === 'refresh') {
    const delta = extractedContext.delta as {
      newFragmentCount?: number
      removedFragmentCount?: number
      summaries?: string[]
    } | undefined

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          Incremental refresh
          {delta?.newFragmentCount ? ` — ${delta.newFragmentCount} new insight${delta.newFragmentCount !== 1 ? 's' : ''}` : ''}
          {delta?.removedFragmentCount ? `, ${delta.removedFragmentCount} removed` : ''}
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        {delta?.summaries && delta.summaries.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {delta.summaries.map((summary, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4">
                <p className="text-sm text-foreground">{summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Legacy: pre-pipeline traces with themes
  if ('themes' in extractedContext && Array.isArray(extractedContext.themes)) {
    const themes = extractedContext.themes as { theme_name: string; content: string }[]
    if (themes.length === 0) return (
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center py-12 text-muted-foreground">
          No knowledge snapshot available for this strategy.
        </div>
      </div>
    )

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {themes.length} theme{themes.length !== 1 ? 's' : ''} extracted for this strategy
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {themes.map((theme, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-1 text-sm">{theme.theme_name}</h3>
              <p className="text-sm text-muted-foreground">{theme.content}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Unknown shape — fallback
  return (
    <div className="max-w-6xl mx-auto px-6">
      <div className="text-center py-12 text-muted-foreground">
        No knowledge snapshot available for this strategy.
      </div>
    </div>
  )
}
