'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, ChevronUp, Save, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { EvalFile, ExportedTrace, TagsFile, EvalComponent } from '@/lib/eval/types'

interface EvalData {
  eval: EvalFile
  traces: Record<string, ExportedTrace>
  tags: TagsFile
}

export default function EvalViewerPage() {
  const params = useParams()
  const evalId = params.evalId as string

  const [data, setData] = useState<EvalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track new tags to persist
  const [newTags, setNewTags] = useState<TagsFile>({ conversation: [], extraction: [], generation: [] })

  useEffect(() => {
    fetchEval()
  }, [evalId])

  const fetchEval = async () => {
    try {
      const response = await fetch(`/api/admin/eval/${evalId}`)
      if (!response.ok) {
        throw new Error('Failed to load eval')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!data) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/eval/${evalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluation: data.eval.evaluation,
          summary: data.eval.summary,
          outcome: data.eval.outcome,
          newTags: Object.values(newTags).some(arr => arr.length > 0) ? newTags : undefined,
        }),
      })
      if (!response.ok) throw new Error('Failed to save')
      setHasChanges(false)
      setNewTags({ conversation: [], extraction: [], generation: [] })
    } catch (err) {
      alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data.eval, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${evalId}.eval.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateEvaluation = useCallback((
    traceId: string,
    component: EvalComponent,
    field: 'notes' | 'tags',
    value: string | string[]
  ) => {
    setData(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      updated.eval = { ...updated.eval }
      updated.eval.evaluation = { ...updated.eval.evaluation }
      updated.eval.evaluation[traceId] = { ...updated.eval.evaluation[traceId] }
      updated.eval.evaluation[traceId][component] = {
        ...updated.eval.evaluation[traceId][component],
        [field]: value,
      }
      return updated
    })
    setHasChanges(true)
  }, [])

  const addTag = useCallback((traceId: string, component: EvalComponent, tag: string) => {
    setData(prev => {
      if (!prev) return prev
      const currentTags = prev.eval.evaluation[traceId][component].tags
      if (currentTags.includes(tag)) return prev // Already has tag

      const updated = { ...prev }
      updated.eval = { ...updated.eval }
      updated.eval.evaluation = { ...updated.eval.evaluation }
      updated.eval.evaluation[traceId] = { ...updated.eval.evaluation[traceId] }
      updated.eval.evaluation[traceId][component] = {
        ...updated.eval.evaluation[traceId][component],
        tags: [...currentTags, tag],
      }

      // Track if it's a new tag (check against known tags)
      if (!prev.tags[component].includes(tag)) {
        setNewTags(prevTags => ({
          ...prevTags,
          [component]: prevTags[component].includes(tag) ? prevTags[component] : [...prevTags[component], tag],
        }))
      }

      return updated
    })
    setHasChanges(true)
  }, [])

  const removeTag = useCallback((traceId: string, component: EvalComponent, tag: string) => {
    setData(prev => {
      if (!prev) return prev
      const currentTags = prev.eval.evaluation[traceId][component].tags
      const updated = { ...prev }
      updated.eval = { ...updated.eval }
      updated.eval.evaluation = { ...updated.eval.evaluation }
      updated.eval.evaluation[traceId] = { ...updated.eval.evaluation[traceId] }
      updated.eval.evaluation[traceId][component] = {
        ...updated.eval.evaluation[traceId][component],
        tags: currentTags.filter(t => t !== tag),
      }
      return updated
    })
    setHasChanges(true)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (error || !data) {
    return <div className="flex items-center justify-center h-screen text-destructive">{error || 'No data'}</div>
  }

  const { eval: evalFile, traces, tags } = data
  const traceIds = evalFile.traces

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{evalFile.name}</h1>
            <p className="text-sm text-muted-foreground">{evalFile.date}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Purpose */}
        {evalFile.purpose && (
          <p className="text-muted-foreground mb-6">{evalFile.purpose}</p>
        )}

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-6">
          {traceIds.map(traceId => (
            <TraceColumn
              key={traceId}
              traceId={traceId}
              trace={traces[traceId]}
              evaluation={evalFile.evaluation[traceId]}
              isBaseline={traceId === evalFile.baseline}
              tags={tags}
              onNotesChange={(component, value) => updateEvaluation(traceId, component, 'notes', value)}
              onAddTag={(component, tag) => addTag(traceId, component, tag)}
              onRemoveTag={(component, tag) => removeTag(traceId, component, tag)}
            />
          ))}
        </div>

        {/* Summary & Outcome */}
        <div className="mt-8 space-y-4 border-t pt-6">
          <div>
            <label className="text-sm font-medium">Summary</label>
            <Textarea
              value={evalFile.summary}
              onChange={e => {
                setData(prev => prev ? { ...prev, eval: { ...prev.eval, summary: e.target.value } } : prev)
                setHasChanges(true)
              }}
              placeholder="What did you learn from this comparison?"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Outcome</label>
            <Textarea
              value={evalFile.outcome}
              onChange={e => {
                setData(prev => prev ? { ...prev, eval: { ...prev.eval, outcome: e.target.value } } : prev)
                setHasChanges(true)
              }}
              placeholder="What action will you take based on this eval?"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface TraceColumnProps {
  traceId: string
  trace: ExportedTrace | undefined
  evaluation: Record<EvalComponent, { notes: string; tags: string[] }>
  isBaseline: boolean
  tags: TagsFile
  onNotesChange: (component: EvalComponent, value: string) => void
  onAddTag: (component: EvalComponent, tag: string) => void
  onRemoveTag: (component: EvalComponent, tag: string) => void
}

function TraceColumn({
  traceId,
  trace,
  evaluation,
  isBaseline,
  tags,
  onNotesChange,
  onAddTag,
  onRemoveTag,
}: TraceColumnProps) {
  if (!trace) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-destructive">Trace {traceId} not found</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-3',
        isBaseline ? 'bg-blue-50 text-blue-900' : 'bg-gray-50'
      )}>
        <div className="font-medium">
          {isBaseline ? 'BASELINE' : 'VARIANT'}
        </div>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <div>ID: {traceId.slice(0, 12)}...</div>
          {trace.pipelineVersion && (
            <div>Pipeline: <span className="font-medium">{trace.pipelineVersion}</span></div>
          )}
          {trace.promptVersions && (
            <div>Prompts: extract={trace.promptVersions.extraction}, gen={trace.promptVersions.generation}</div>
          )}
          {trace.components.conversation.experimentVariant && (
            <div>Variant: <span className="font-medium">{trace.components.conversation.experimentVariant}</span></div>
          )}
        </div>
      </div>

      {/* Components */}
      <ComponentSection
        title="Conversation"
        component="conversation"
        evaluation={evaluation.conversation}
        tags={tags.conversation}
        onNotesChange={v => onNotesChange('conversation', v)}
        onAddTag={t => onAddTag('conversation', t)}
        onRemoveTag={t => onRemoveTag('conversation', t)}
      >
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {trace.components.conversation.messages.map((msg, idx) => (
            <div key={idx} className={cn(
              'text-xs p-2 rounded whitespace-pre-wrap',
              msg.role === 'assistant' ? 'bg-blue-50' : 'bg-gray-50'
            )}>
              <span className="font-medium">{msg.role}:</span> {msg.content}
            </div>
          ))}
        </div>
      </ComponentSection>

      <ComponentSection
        title="Extraction"
        component="extraction"
        evaluation={evaluation.extraction}
        tags={tags.extraction}
        onNotesChange={v => onNotesChange('extraction', v)}
        onAddTag={t => onAddTag('extraction', t)}
        onRemoveTag={t => onRemoveTag('extraction', t)}
      >
        {trace.components.extraction.themes && (
          <div className="space-y-2">
            {trace.components.extraction.themes.map((theme, idx) => (
              <div key={idx} className="text-xs">
                <span className="font-medium">{theme.theme_name}:</span>{' '}
                {theme.content}
              </div>
            ))}
          </div>
        )}
      </ComponentSection>

      <ComponentSection
        title="Generation"
        component="generation"
        evaluation={evaluation.generation}
        tags={tags.generation}
        onNotesChange={v => onNotesChange('generation', v)}
        onAddTag={t => onAddTag('generation', t)}
        onRemoveTag={t => onRemoveTag('generation', t)}
      >
        <div className="space-y-3 text-xs">
          <div>
            <span className="font-medium">Vision:</span>{' '}
            {trace.components.generation.vision}
          </div>
          <div>
            <span className="font-medium">Strategy:</span>{' '}
            {trace.components.generation.strategy}
          </div>
          <div>
            <span className="font-medium">Objectives ({trace.components.generation.objectives.length}):</span>
            <div className="mt-2 space-y-3">
              {trace.components.generation.objectives.map((obj, idx) => (
                <div key={obj.id} className="border rounded p-2 bg-white">
                  <div className="font-medium">{idx + 1}. {obj.pithy}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                    <div><span className="font-medium text-foreground">Metric:</span> {obj.metric?.metricName || obj.metric?.summary || '-'}</div>
                    <div><span className="font-medium text-foreground">Target:</span> {obj.metric?.direction && obj.metric?.metricValue ? `${obj.metric.direction} ${obj.metric.metricValue}` : obj.metric?.metricValue || '-'}</div>
                    <div><span className="font-medium text-foreground">Timeframe:</span> {obj.metric?.timeframe || '-'}</div>
                  </div>
                  {obj.explanation && (
                    <div className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Why:</span> {obj.explanation}</div>
                  )}
                  {obj.successCriteria && (
                    <div className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Success:</span> {obj.successCriteria}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ComponentSection>
    </div>
  )
}

interface ComponentSectionProps {
  title: string
  component: EvalComponent
  evaluation: { notes: string; tags: string[] }
  tags: string[]
  children: React.ReactNode
  onNotesChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

function ComponentSection({
  title,
  component,
  evaluation,
  tags,
  children,
  onNotesChange,
  onAddTag,
  onRemoveTag,
}: ComponentSectionProps) {
  const [expanded, setExpanded] = useState(component === 'generation')
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = (tag: string) => {
    if (tag.trim()) {
      onAddTag(tag.trim().toLowerCase().replace(/\s+/g, '-'))
      setTagInput('')
    }
  }

  const availableTags = tags.filter(t => !evaluation.tags.includes(t))

  return (
    <div className="border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium text-sm">{title}</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Content */}
          <div className="border rounded p-2 bg-gray-50">
            {children}
          </div>

          {/* Notes */}
          <Textarea
            value={evaluation.notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Notes..."
            className="text-xs min-h-[60px]"
          />

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {evaluation.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded cursor-pointer hover:bg-blue-200"
                onClick={() => onRemoveTag(tag)}
              >
                {tag} ×
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag(tagInput)
                }
              }}
              placeholder="+ tag"
              className="text-xs px-2 py-0.5 border rounded w-20"
              list={`${component}-tags`}
            />
            <datalist id={`${component}-tags`}>
              {availableTags.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
      )}
    </div>
  )
}
