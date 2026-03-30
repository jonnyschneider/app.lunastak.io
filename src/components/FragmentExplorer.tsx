'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Archive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'

interface FragmentData {
  id: string
  title: string | null
  content: string
  contentType: string
  status: string
  confidence: string | null
  sourceType: string
  dimensions: { dimension: string; confidence: string | null }[]
  source: { type: 'conversation' | 'document'; id: string; name: string } | null
  capturedAt: string
}

interface FragmentExplorerProps {
  projectId: string
  initialDimensionFilter?: string
  onResumeConversation?: (conversationId: string) => void
}

function getDimensionLabel(dimension: string): string {
  const ctx = DIMENSION_CONTEXT[dimension as Tier1Dimension]
  return ctx?.name || dimension.replace(/_/g, ' ').toLowerCase()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  return `${day} ${month}`
}

function getDisplayTitle(fragment: FragmentData): string {
  if (fragment.title) return fragment.title
  // Fallback: first line of content, stripped of markdown bold
  const firstLine = fragment.content.split('\n')[0]
  return firstLine.replace(/^\*\*(.+?)\*\*$/, '$1').slice(0, 80)
}

export function FragmentExplorer({ projectId, initialDimensionFilter, onResumeConversation }: FragmentExplorerProps) {
  const [fragments, setFragments] = useState<FragmentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)
  const [archivedCount, setArchivedCount] = useState(0)

  // Filters
  const [dimensionFilter, setDimensionFilter] = useState<string>(initialDimensionFilter || '')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [searchText, setSearchText] = useState('')

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchFragments = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (dimensionFilter) params.set('dimension', dimensionFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (sourceFilter) params.set('source', sourceFilter)

    try {
      const res = await fetch(`/api/project/${projectId}/fragments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFragments(data.fragments)
        setActiveCount(data.activeCount)
        setArchivedCount(data.archivedCount)
      }
    } catch (err) {
      console.error('Failed to fetch fragments:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, dimensionFilter, statusFilter, sourceFilter])

  useEffect(() => {
    fetchFragments()
  }, [fetchFragments])

  const handleArchiveRestore = async (ids: string[], newStatus: 'archived' | 'active') => {
    try {
      await fetch(`/api/project/${projectId}/fragments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: newStatus }),
      })
      setSelectedIds(new Set())
      fetchFragments()
    } catch (err) {
      console.error('Failed to update fragments:', err)
    }
  }

  // Client-side search filter
  const filteredFragments = searchText
    ? fragments.filter(f => {
        const q = searchText.toLowerCase()
        return (
          (f.title && f.title.toLowerCase().includes(q)) ||
          f.content.toLowerCase().includes(q) ||
          f.dimensions.some(d => getDimensionLabel(d.dimension).toLowerCase().includes(q))
        )
      })
    : fragments

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allDimensions = Object.keys(DIMENSION_CONTEXT) as Tier1Dimension[]

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fragments..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={dimensionFilter || '_all'} onValueChange={(v) => setDimensionFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="All dimensions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All dimensions</SelectItem>
            {allDimensions.map(d => (
              <SelectItem key={d} value={d}>{getDimensionLabel(d)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter || '_all'} onValueChange={(v) => setSourceFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All sources</SelectItem>
            <SelectItem value="conversation">Conversations</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-md border border-input text-xs">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 rounded-l-md transition-colors ${
              statusFilter === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-2.5 py-1 rounded-r-md transition-colors ${
              statusFilter === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{selectedIds.size} selected</span>
          {statusFilter === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleArchiveRestore(Array.from(selectedIds), 'archived')}
            >
              <Archive className="h-3 w-3 mr-1" />
              Archive
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleArchiveRestore(Array.from(selectedIds), 'active')}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restore
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Fragment list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-xs">Loading fragments...</div>
      ) : filteredFragments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          {searchText ? 'No fragments match your search' : 'No fragments found'}
        </div>
      ) : (
        <div className="border-t border-border">
          {filteredFragments.map(fragment => {
            const isExpanded = expandedId === fragment.id
            const isSelected = selectedIds.has(fragment.id)
            const isArchived = fragment.status === 'archived'
            const title = getDisplayTitle(fragment)

            return (
              <div
                key={fragment.id}
                className={`group border-b border-border py-2.5 px-1 transition-colors hover:bg-muted/30 ${
                  isArchived ? 'opacity-50' : ''
                } ${isSelected ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(fragment.id)}
                    className="mt-0.5 shrink-0"
                  />

                  {/* Content area */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : fragment.id)}
                  >
                    {/* Row 1: title + source + date */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium truncate flex-1">
                        {title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                        {fragment.source && (
                          fragment.source.type === 'conversation' && onResumeConversation ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onResumeConversation(fragment.source!.id)
                              }}
                              className="text-primary hover:underline"
                            >
                              {fragment.source.name}
                            </button>
                          ) : (
                            <span>{fragment.source.name}</span>
                          )
                        )}
                        <span>{formatDate(fragment.capturedAt)}</span>
                      </div>
                    </div>

                    {/* Row 2: dimension pills */}
                    {fragment.dimensions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {fragment.dimensions.map(d => (
                          <Badge
                            key={d.dimension}
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 font-normal text-muted-foreground border-border"
                          >
                            {getDimensionLabel(d.dimension)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Expanded: full content */}
                    {isExpanded && (
                      <div className="mt-2 pl-0 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {fragment.content}
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isArchived ? (
                      <button
                        onClick={() => handleArchiveRestore([fragment.id], 'active')}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Restore"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveRestore([fragment.id], 'archived')}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Archive"
                      >
                        <Archive className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
