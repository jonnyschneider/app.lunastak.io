'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Archive, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'

interface FragmentData {
  id: string
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
    ? fragments.filter(f =>
        f.content.toLowerCase().includes(searchText.toLowerCase()) ||
        f.dimensions.some(d => getDimensionLabel(d.dimension).toLowerCase().includes(searchText.toLowerCase()))
      )
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
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fragments..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <select
          value={dimensionFilter}
          onChange={(e) => setDimensionFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All dimensions</option>
          {allDimensions.map(d => (
            <option key={d} value={d}>{getDimensionLabel(d)}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All sources</option>
          <option value="conversation">Conversations</option>
          <option value="document">Documents</option>
        </select>

        <div className="flex items-center rounded-md border border-input">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 text-sm rounded-l-md transition-colors ${
              statusFilter === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 text-sm rounded-r-md transition-colors ${
              statusFilter === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{selectedIds.size} selected</span>
          {statusFilter === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleArchiveRestore(Array.from(selectedIds), 'archived')}
            >
              <Archive className="h-3 w-3 mr-1" />
              Archive
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleArchiveRestore(Array.from(selectedIds), 'active')}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restore
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Fragment list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading fragments...</div>
      ) : filteredFragments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {searchText ? 'No fragments match your search' : 'No fragments found'}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredFragments.map(fragment => {
            const isExpanded = expandedId === fragment.id
            const isSelected = selectedIds.has(fragment.id)
            const isArchived = fragment.status === 'archived'

            return (
              <Card
                key={fragment.id}
                className={`transition-colors ${isArchived ? 'opacity-60' : ''} ${isSelected ? 'ring-1 ring-primary' : ''}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(fragment.id)}
                      className="mt-1 shrink-0"
                    />

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : fragment.id)}
                    >
                      <p className={`text-sm ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {fragment.content}
                      </p>

                      {/* Tags row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {fragment.dimensions.map(d => (
                          <Badge
                            key={d.dimension}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {getDimensionLabel(d.dimension)}
                          </Badge>
                        ))}
                        {fragment.source && (
                          fragment.source.type === 'conversation' && onResumeConversation ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onResumeConversation(fragment.source!.id)
                              }}
                              className="text-[10px] text-primary hover:underline"
                            >
                              💬 {fragment.source.name}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {fragment.source.type === 'conversation' ? '💬' : '📄'} {fragment.source.name}
                            </span>
                          )
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDate(fragment.capturedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isArchived ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleArchiveRestore([fragment.id], 'active')}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleArchiveRestore([fragment.id], 'archived')}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : fragment.id)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
