'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EvalSummary {
  id: string
  name: string
  date: string
  traceCount: number
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
        <div className="space-y-2">
          {evals.map(ev => (
            <Link
              key={ev.id}
              href={`/admin/eval/${ev.id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-medium">{ev.name}</h2>
                  <p className="text-sm text-muted-foreground">{ev.date}</p>
                </div>
                <span className="text-sm text-muted-foreground">{ev.traceCount} traces</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
