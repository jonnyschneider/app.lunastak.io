'use client'

/**
 * Static snapshot of the knowledgebase at the time strategy was generated.
 * Renders fragment contents from the trace's extractedContext field.
 *
 * extractedContext shapes:
 * - Initial: { source: 'fragments', fragments: [{ content, contentType }] }
 * - Refresh: { source: 'refresh', existingFragments: [...], newFragments: [...], removedCount }
 * - Legacy:  { themes: [{ theme_name, content }], extraction_approach }
 * - Legacy refresh: { type: 'refresh', delta: { newFragmentSummaries, ... } }
 */

interface FragmentSnapshot {
  content: string
  contentType?: string
}

interface KnowledgeSnapshotProps {
  extractedContext: Record<string, unknown> | null
  timestamp: string | null
}

/** Parse **Bold Title**\n\nBody into { title, body } */
function parseFragmentContent(content: string): { title: string | null; body: string } {
  const match = content.match(/^\*\*(.+?)\*\*\s*\n\n?([\s\S]*)$/)
  if (match) return { title: match[1], body: match[2].trim() }
  return { title: null, body: content }
}

function FragmentCard({ fragment }: { fragment: FragmentSnapshot }) {
  const { title, body } = parseFragmentContent(fragment.content)
  return (
    <div className="border border-border rounded-lg p-4">
      {title && <h3 className="font-medium text-foreground mb-1 text-sm">{title}</h3>}
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function FragmentGrid({ fragments, label }: { fragments: FragmentSnapshot[]; label?: string }) {
  if (fragments.length === 0) return null
  return (
    <section className="space-y-3">
      {label && (
        <h2 className="text-sm font-medium text-muted-foreground">
          {label} ({fragments.length})
        </h2>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fragments.map((f, idx) => <FragmentCard key={idx} fragment={f} />)}
      </div>
    </section>
  )
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

  // Current pipeline: initial generation
  if (extractedContext.source === 'fragments') {
    const fragments = (extractedContext.fragments || []) as FragmentSnapshot[]

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {fragments.length} insight{fragments.length !== 1 ? 's' : ''} used to generate this strategy
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        <FragmentGrid fragments={fragments} />
      </div>
    )
  }

  // Current pipeline: refresh generation with full snapshot
  if (extractedContext.source === 'refresh') {
    const existingFragments = (extractedContext.existingFragments || []) as FragmentSnapshot[]
    const newFragments = (extractedContext.newFragments || []) as FragmentSnapshot[]
    const removedCount = (extractedContext.removedCount as number) || 0
    const totalCount = existingFragments.length + newFragments.length

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-6">
        <div className="text-sm text-muted-foreground">
          {totalCount} insight{totalCount !== 1 ? 's' : ''} after refresh
          {removedCount > 0 && `, ${removedCount} removed`}
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        <FragmentGrid fragments={newFragments} label="Recently added" />
        <FragmentGrid fragments={existingFragments} label="Previous strategy" />
      </div>
    )
  }

  // Legacy refresh: { type: 'refresh', delta }
  if (extractedContext.type === 'refresh') {
    const delta = extractedContext.delta as {
      newFragmentCount?: number
      newFragmentSummaries?: string[]
    } | undefined
    const summaries = (delta?.newFragmentSummaries || []).map(s => ({ content: s }))

    return (
      <div className="max-w-6xl mx-auto px-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          Incremental refresh
          {delta?.newFragmentCount ? ` — ${delta.newFragmentCount} new insight${delta.newFragmentCount !== 1 ? 's' : ''}` : ''}
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </div>
        <FragmentGrid fragments={summaries} />
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
