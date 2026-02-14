'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────

interface FixtureIndex {
  file: string
  name: string
  description: string
  tags: string[]
  pipelinePaths: string[]
  conversations: { total: number; initial: number; followUp: number }
  fragments: number
  hasSyntheses: boolean
  hasGeneratedOutput: boolean
  createdAt: string
  apiVersion: string
  notes: string
}

interface Snapshot {
  id: string
  fixture: string
  route: string
  payload: Record<string, unknown>
  response: unknown
  timestamp: string
  notes: string
  durationMs: number
}

type RouteConfig = {
  label: string
  method: string
  path: string | ((projectId: string) => string)
  triggerType: string
  buildPayload: (fixture: any, projectId: string) => Record<string, unknown> | null
  requiresHydration: boolean
  responseType: 'stream' | 'json'
}

// ─── Route definitions ─────────────────────────────────

const ROUTES: RouteConfig[] = [
  {
    label: 'Extract (initial)',
    method: 'POST',
    path: '/api/extract',
    triggerType: 'conversation_ended',
    responseType: 'stream',
    requiresHydration: true,
    buildPayload: (fixture: any) => {
      const conv = fixture.projects?.[0]?.conversations?.find(
        (c: any) => c.isInitialConversation && c.status === 'in_progress'
      )
      if (!conv) return null
      return { conversationId: conv._hydratedId || conv.id, lightweight: false }
    },
  },
  {
    label: 'Extract (follow-up)',
    method: 'POST',
    path: '/api/extract',
    triggerType: 'conversation_ended',
    responseType: 'stream',
    requiresHydration: true,
    buildPayload: (fixture: any) => {
      const conv = fixture.projects?.[0]?.conversations?.find(
        (c: any) => !c.isInitialConversation && c.status === 'in_progress'
      )
      if (!conv) return null
      return { conversationId: conv._hydratedId || conv.id, lightweight: true }
    },
  },
  {
    label: 'Generate (initial)',
    method: 'POST',
    path: '/api/generate',
    triggerType: 'conversation_ended',
    responseType: 'json',
    requiresHydration: true,
    buildPayload: (fixture: any) => {
      const conv = fixture.projects?.[0]?.conversations?.find(
        (c: any) => c.isInitialConversation || c.status === 'extracted'
      )
      if (!conv) return null
      return { conversationId: conv._hydratedId || conv.id }
    },
  },
  {
    label: 'Refresh Strategy',
    method: 'POST',
    path: (projectId: string) => `/api/project/${projectId}/refresh-strategy`,
    triggerType: 'refresh_requested',
    responseType: 'stream',
    requiresHydration: true,
    buildPayload: () => ({}),
  },
  {
    label: 'Template Entry',
    method: 'POST',
    path: (projectId: string) => `/api/project/${projectId}/template-entry`,
    triggerType: 'template_submitted',
    responseType: 'json',
    requiresHydration: false,
    buildPayload: () => ({
      statements: {
        vision: 'Test vision statement',
        strategy: 'Test strategy statement',
        objectives: [],
        opportunities: [],
        principles: [],
      },
    }),
  },
]

// ─── Helpers ───────────────────────────────────────────

const SNAPSHOTS_KEY = 'pipeline-test-snapshots'

function loadSnapshots(): Snapshot[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSnapshots(snapshots: Snapshot[]) {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots))
}

function generateId() {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function readStream(response: Response): Promise<unknown[]> {
  const reader = response.body?.getReader()
  if (!reader) return []
  const decoder = new TextDecoder()
  const chunks: unknown[] = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.trim()) {
        try {
          chunks.push(JSON.parse(line))
        } catch {
          chunks.push({ raw: line })
        }
      }
    }
  }
  if (buffer.trim()) {
    try {
      chunks.push(JSON.parse(buffer))
    } catch {
      chunks.push({ raw: buffer })
    }
  }
  return chunks
}

// ─── Components ────────────────────────────────────────

function FixtureCard({ fixture, selected, onSelect }: {
  fixture: FixtureIndex
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{fixture.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{fixture.description}</p>
        </div>
        <span className="text-xs text-muted-foreground">v{fixture.apiVersion}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {fixture.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {tag}
          </span>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        {fixture.conversations.total} conversations &middot; {fixture.fragments} fragments
        {fixture.hasSyntheses && ' · syntheses'}
        {fixture.hasGeneratedOutput && ' · generated output'}
      </div>
    </button>
  )
}

function JsonViewer({ data, maxHeight = '400px' }: { data: unknown; maxHeight?: string }) {
  return (
    <pre
      className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-auto border"
      style={{ maxHeight }}
    >
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  )
}

function SnapshotCard({ snapshot, onCompare, onDelete }: {
  snapshot: Snapshot
  onCompare: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{snapshot.route}</span>
            <span className="text-xs text-muted-foreground">{snapshot.fixture}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(snapshot.timestamp).toLocaleString()} &middot; {snapshot.durationMs}ms
          </div>
          {snapshot.notes && (
            <div className="text-xs mt-1 text-blue-600 dark:text-blue-400">{snapshot.notes}</div>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setExpanded(!expanded)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200">
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={onCompare} className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 text-blue-700 dark:text-blue-300">
            Compare
          </button>
          <button onClick={onDelete} className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900 hover:bg-red-200 text-red-700 dark:text-red-300">
            Delete
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Payload</div>
            <JsonViewer data={snapshot.payload} maxHeight="150px" />
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Response</div>
            <JsonViewer data={snapshot.response} maxHeight="400px" />
          </div>
        </div>
      )}
    </div>
  )
}

function CompareView({ a, b, onClose }: { a: Snapshot; b: Snapshot; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Compare Snapshots</h2>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto grid grid-cols-2 divide-x">
          {[a, b].map((snap, i) => (
            <div key={i} className="p-4 space-y-3 overflow-auto">
              <div>
                <div className="font-medium text-sm">{snap.route}</div>
                <div className="text-xs text-muted-foreground">
                  {snap.fixture} &middot; {new Date(snap.timestamp).toLocaleString()} &middot; {snap.durationMs}ms
                </div>
                {snap.notes && <div className="text-xs mt-1 text-blue-600">{snap.notes}</div>}
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Payload</div>
                <JsonViewer data={snap.payload} maxHeight="150px" />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Response</div>
                <JsonViewer data={snap.response} maxHeight="500px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────

export default function PipelineTestPage() {
  const [fixtures, setFixtures] = useState<FixtureIndex[]>([])
  const [selectedFixture, setSelectedFixture] = useState<FixtureIndex | null>(null)
  const [fixtureData, setFixtureData] = useState<any>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteConfig | null>(null)
  const [projectId, setProjectId] = useState('')
  const [payload, setPayload] = useState('')
  const [response, setResponse] = useState<unknown>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [snapshotNote, setSnapshotNote] = useState('')
  const [compareA, setCompareA] = useState<Snapshot | null>(null)
  const [compareB, setCompareB] = useState<Snapshot | null>(null)
  const [tab, setTab] = useState<'run' | 'snapshots'>('run')

  // Load fixture index
  useEffect(() => {
    fetch('/api/dev/fixtures')
      .then(r => r.json())
      .then(data => setFixtures(data.fixtures || []))
      .catch(() => setError('Failed to load fixture index'))
  }, [])

  // Load snapshots from localStorage
  useEffect(() => {
    setSnapshots(loadSnapshots())
  }, [])

  // Load fixture JSON when selected
  const handleSelectFixture = useCallback(async (fixture: FixtureIndex) => {
    setSelectedFixture(fixture)
    setSelectedRoute(null)
    setPayload('')
    setResponse(null)
    setError(null)
    try {
      const r = await fetch(`/api/dev/fixtures/${fixture.file}`)
      const data = await r.json()
      setFixtureData(data)
    } catch {
      setError(`Failed to load fixture: ${fixture.file}`)
    }
  }, [])

  // Build payload when route selected
  const handleSelectRoute = useCallback((route: RouteConfig) => {
    setSelectedRoute(route)
    setResponse(null)
    setError(null)
    setDurationMs(null)
    if (fixtureData) {
      const built = route.buildPayload(fixtureData, projectId)
      setPayload(built ? JSON.stringify(built, null, 2) : '// No matching data in fixture for this route')
    }
  }, [fixtureData, projectId])

  // Fire the request
  const handleRun = useCallback(async () => {
    if (!selectedRoute) return
    setIsRunning(true)
    setError(null)
    setResponse(null)

    const start = Date.now()
    try {
      let parsedPayload: Record<string, unknown> = {}
      try {
        parsedPayload = JSON.parse(payload)
      } catch {
        setError('Invalid JSON payload')
        setIsRunning(false)
        return
      }

      const url = typeof selectedRoute.path === 'function'
        ? selectedRoute.path(projectId)
        : selectedRoute.path

      const res = await fetch(url, {
        method: selectedRoute.method,
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(parsedPayload).length > 0 ? JSON.stringify(parsedPayload) : undefined,
      })

      const elapsed = Date.now() - start
      setDurationMs(elapsed)

      if (!res.ok) {
        const text = await res.text()
        setError(`${res.status}: ${text}`)
        setIsRunning(false)
        return
      }

      if (selectedRoute.responseType === 'stream') {
        const chunks = await readStream(res)
        setResponse(chunks)
      } else {
        const json = await res.json()
        setResponse(json)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsRunning(false)
    }
  }, [selectedRoute, payload, projectId])

  // Save snapshot
  const handleSaveSnapshot = useCallback(() => {
    if (!selectedRoute || !selectedFixture || !response) return
    let parsedPayload: Record<string, unknown> = {}
    try { parsedPayload = JSON.parse(payload) } catch { /* ignore */ }

    const snap: Snapshot = {
      id: generateId(),
      fixture: selectedFixture.name,
      route: selectedRoute.label,
      payload: parsedPayload,
      response,
      timestamp: new Date().toISOString(),
      notes: snapshotNote,
      durationMs: durationMs || 0,
    }
    const updated = [snap, ...snapshots]
    setSnapshots(updated)
    saveSnapshots(updated)
    setSnapshotNote('')
  }, [selectedRoute, selectedFixture, response, payload, snapshotNote, durationMs, snapshots])

  // Delete snapshot
  const handleDeleteSnapshot = useCallback((id: string) => {
    const updated = snapshots.filter(s => s.id !== id)
    setSnapshots(updated)
    saveSnapshots(updated)
  }, [snapshots])

  // Compare setup
  const handleCompare = useCallback((snap: Snapshot) => {
    if (!compareA) {
      setCompareA(snap)
    } else if (!compareB) {
      setCompareB(snap)
    } else {
      setCompareA(snap)
      setCompareB(null)
    }
  }, [compareA, compareB])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline Test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fire pipeline routes with fixture data, capture and compare responses
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('run')}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'run' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            Run
          </button>
          <button
            onClick={() => setTab('snapshots')}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'snapshots' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            Snapshots ({snapshots.length})
          </button>
        </div>
      </div>

      {tab === 'run' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Fixture + Route selection */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium mb-2">Fixtures</h2>
              <div className="space-y-2">
                {fixtures.map(f => (
                  <FixtureCard
                    key={f.file}
                    fixture={f}
                    selected={selectedFixture?.file === f.file}
                    onSelect={() => handleSelectFixture(f)}
                  />
                ))}
                {fixtures.length === 0 && (
                  <p className="text-sm text-muted-foreground">Loading fixtures...</p>
                )}
              </div>
            </div>

            {selectedFixture && (
              <div>
                <h2 className="text-sm font-medium mb-2">Project ID</h2>
                <input
                  type="text"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  placeholder="Hydrated project ID"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Hydrate fixture first, then paste the project ID
                </p>
              </div>
            )}

            {selectedFixture && (
              <div>
                <h2 className="text-sm font-medium mb-2">Routes</h2>
                <div className="space-y-1.5">
                  {ROUTES.filter(r =>
                    selectedFixture.pipelinePaths.includes(r.triggerType) ||
                    r.triggerType === 'template_submitted'
                  ).map(route => (
                    <button
                      key={route.label}
                      onClick={() => handleSelectRoute(route)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                        selectedRoute?.label === route.label
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">{route.method}</span>
                      {route.label}
                      <span className="text-xs text-muted-foreground ml-2">({route.responseType})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Middle: Payload editor */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium mb-2">Payload</h2>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-white dark:bg-gray-900 resize-y"
                placeholder="Select a fixture and route to pre-fill payload"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRun}
                disabled={!selectedRoute || isRunning}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Right: Response + Snapshot */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium">Response</h2>
                {durationMs !== null && (
                  <span className="text-xs text-muted-foreground">{durationMs}ms</span>
                )}
              </div>
              {response ? (
                <JsonViewer data={response} maxHeight="350px" />
              ) : (
                <div className="h-48 flex items-center justify-center border rounded-lg text-sm text-muted-foreground">
                  Run a request to see the response
                </div>
              )}
            </div>

            {response !== null && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={snapshotNote}
                  onChange={e => setSnapshotNote(e.target.value)}
                  placeholder="Snapshot note (optional)"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900"
                />
                <button
                  onClick={handleSaveSnapshot}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90"
                >
                  Save Snapshot
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'snapshots' && (
        <div className="space-y-4">
          {compareA && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
              Comparing: <strong>{compareA.route}</strong> ({new Date(compareA.timestamp).toLocaleString()})
              {compareB
                ? <> vs <strong>{compareB.route}</strong> ({new Date(compareB.timestamp).toLocaleString()})</>
                : <> — click Compare on another snapshot</>
              }
              {compareB && (
                <button onClick={() => { setCompareA(null); setCompareB(null) }} className="ml-3 text-xs underline">
                  Clear
                </button>
              )}
            </div>
          )}

          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots saved yet. Run a request and save it.</p>
          ) : (
            <div className="space-y-2">
              {snapshots.map(snap => (
                <SnapshotCard
                  key={snap.id}
                  snapshot={snap}
                  onCompare={() => handleCompare(snap)}
                  onDelete={() => handleDeleteSnapshot(snap.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare modal */}
      {compareA && compareB && (
        <CompareView
          a={compareA}
          b={compareB}
          onClose={() => { setCompareA(null); setCompareB(null) }}
        />
      )}
    </div>
  )
}
