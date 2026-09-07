'use client'

/**
 * PROTOTYPE: ground truth gate, over REAL project data. Disposable — exists to decide layout,
 * affordances and editing against the shipped read surface before implementation.
 *
 * Design: docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md
 *
 * No fixture. It fetches `GET /api/project/[id]/fragments` exactly as it ships and derives the
 * whole view client-side (`derive.ts`) — which is the test of design §16.6's claim that the read
 * surface is data-shaped, not screen-shaped. If anything here needed a backend change, that claim
 * was wrong.
 *
 *   /prototype/ground-truth-gate?project=<projectId>
 *
 * Baseline project: docs are in Test-Data/2026-09-07-gate-baseline/PROVENANCE.md; restore a
 * snapshot with `scripts/one-offs/gate-fixture.ts restore`.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { GroundTruthGate } from './gate'
import { buildGateModel, type ApiResponse, type GateModel } from './derive'

export default function GroundTruthGatePage() {
  const projectId = useSearchParams().get('project')
  const [model, setModel] = useState<GateModel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/project/${projectId}/fragments?status=active`)
      .then(async r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText} — are you signed in as the owner?`)
        return r.json() as Promise<ApiResponse>
      })
      .then(res => setModel(buildGateModel(res)))
      .catch(e => setError(String(e.message ?? e)))
  }, [projectId])

  if (!projectId) {
    return (
      <Shell>
        <p className="text-sm">
          Add a project id: <code className="rounded bg-muted px-1.5 py-0.5">?project=&lt;id&gt;</code>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Baseline: <code className="rounded bg-muted px-1.5 py-0.5">cmt9irda40002xnom8f4uziea</code> (dev)
        </p>
      </Shell>
    )
  }
  if (error) return <Shell><p className="text-sm text-destructive">{error}</p></Shell>
  if (!model) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the real fragments…
        </p>
      </Shell>
    )
  }
  return <GroundTruthGate model={model} projectId={projectId} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Prototype · ground truth gate · disposable
        </p>
        {children}
      </div>
    </div>
  )
}
