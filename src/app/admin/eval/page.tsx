'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EvalSummary {
  id: string
  name: string
  date: string
  purpose: string
  summary: string
  outcome: string
  traceCount: number
  baseline: string
}

export default function EvalListPage() {
  const [evals, setEvals] = useState<EvalSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/eval')
      .then(r => r.json())
      .then(data => setEvals(data.evals || []))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Evaluations</h1>

      {evals.length === 0 ? (
        <p className="text-muted-foreground">
          No evals yet. Create one with:
          <code className="block mt-2 p-2 bg-gray-100 rounded text-sm">
            npx tsx scripts/create-eval.ts --name "my-eval" --traces id1,id2 --baseline id1
          </code>
        </p>
      ) : (
        <div className="space-y-4">
          {evals.map(ev => (
            <Link
              key={ev.id}
              href={`/admin/eval/${ev.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="font-medium">{ev.name}</h2>
                  <p className="text-sm text-muted-foreground">{ev.date} · {ev.traceCount} traces</p>
                </div>
                {ev.outcome && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    ev.outcome === 'pass' ? 'bg-green-100 text-green-800' :
                    ev.outcome === 'fail' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ev.outcome || 'pending'}
                  </span>
                )}
              </div>
              {ev.purpose && (
                <p className="text-sm text-muted-foreground mb-2">{ev.purpose}</p>
              )}
              {ev.summary && (
                <p className="text-sm bg-amber-50 border-l-2 border-amber-200 pl-3 py-1 text-amber-900 italic">
                  {ev.summary.length > 200 ? ev.summary.slice(0, 200) + '...' : ev.summary}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
