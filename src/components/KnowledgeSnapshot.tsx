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

import { useState } from 'react'
import Link from 'next/link'
import { Glasses, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const TRUNCATE_LENGTH = 150

interface FragmentSnapshot {
  content: string
  contentType?: string
}

interface KnowledgeSnapshotProps {
  extractedContext: Record<string, unknown> | null
  timestamp: string | null
  projectId?: string
}

/** Parse **Bold Title**\n\nBody into { title, body } */
function parseFragmentContent(content: string): { title: string | null; body: string } {
  const match = content.match(/^\*\*(.+?)\*\*\s*\n\n?([\s\S]*)$/)
  if (match) return { title: match[1], body: match[2].trim() }
  return { title: null, body: content }
}

function FragmentCard({ fragment }: { fragment: FragmentSnapshot }) {
  const { title, body } = parseFragmentContent(fragment.content)
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = body.length > TRUNCATE_LENGTH
  const displayBody = expanded || !needsTruncation ? body : body.slice(0, TRUNCATE_LENGTH) + '…'

  return (
    <button
      className="border border-border rounded-lg p-4 text-left w-full hover:bg-muted/30 transition-colors"
      onClick={() => needsTruncation && setExpanded(!expanded)}
    >
      {title && <h3 className="font-medium text-foreground mb-1 text-sm">{title}</h3>}
      <p className="text-sm text-muted-foreground">{displayBody}</p>
    </button>
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
      <div className="grid gap-3 sm:grid-cols-2 items-start">
        {fragments.map((f, idx) => <FragmentCard key={idx} fragment={f} />)}
      </div>
    </section>
  )
}

function SnapshotHeader({ description, formattedDate, projectId }: {
  description: string
  formattedDate: string | null
  projectId?: string
}) {
  return (
    <div className="space-y-4">
      {projectId && (
        <Card className="bg-primary/[0.03] border-primary/20">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-lg bg-primary/10 p-3 shrink-0">
              <Glasses className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Your Thinking</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                View and manage your chats, documents, and deep dives
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/project/${projectId}`}>
                View
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          All the insights from your chats and documents that were used to generate this strategy.
        </p>
        <span className="text-sm text-muted-foreground">
          {description}
          {formattedDate && <span> &middot; {formattedDate}</span>}
        </span>
      </div>
    </div>
  )
}

export function KnowledgeSnapshot({ extractedContext, timestamp, projectId }: KnowledgeSnapshotProps) {
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
        <SnapshotHeader
          description={`${fragments.length} insight${fragments.length !== 1 ? 's' : ''}`}
          formattedDate={formattedDate}
          projectId={projectId}
        />
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
        <SnapshotHeader
          description={`${totalCount} insight${totalCount !== 1 ? 's' : ''} after refresh${removedCount > 0 ? `, ${removedCount} removed` : ''}`}
          formattedDate={formattedDate}
          projectId={projectId}
        />
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
        <SnapshotHeader
          description={`Incremental refresh${delta?.newFragmentCount ? ` — ${delta.newFragmentCount} new insight${delta.newFragmentCount !== 1 ? 's' : ''}` : ''}`}
          formattedDate={formattedDate}
          projectId={projectId}
        />
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
        <SnapshotHeader
          description={`${themes.length} theme${themes.length !== 1 ? 's' : ''}`}
          formattedDate={formattedDate}
          projectId={projectId}
        />
        <div className="grid gap-3 sm:grid-cols-2 items-start">
          {themes.map((theme, idx) => (
            <FragmentCard key={idx} fragment={{ content: `**${theme.theme_name}**\n\n${theme.content}` }} />
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
