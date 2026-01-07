'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  MessageSquare,
  Target,
  Plus,
  Upload,
  Loader2,
  ArrowRight,
  Sparkles,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Circle,
  X,
  MoreHorizontal,
  Crosshair,
} from 'lucide-react'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ProjectStats {
  fragmentCount: number
  conversationCount: number
  documentCount: number
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
}

interface ConversationSummary {
  id: string
  createdAt: string
  status: string
  messageCount: number
  fragmentCount: number
}

interface DocumentSummary {
  id: string
  fileName: string
  fileType: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  createdAt: string
  fragmentCount: number
}

interface StrategyOutputSummary {
  id: string
  createdAt: string
}

interface DimensionalSynthesis {
  dimension: string
  summary: string | null
  keyThemes: string[]
  gaps: string[]
  confidence: string
  fragmentCount: number
}

interface DeepDiveSummary {
  id: string
  topic: string
  status: string
  origin: string
  conversationCount: number
  documentCount: number
  lastActivityAt: string
  createdAt: string
}

interface ProjectData {
  id: string
  name: string
  stats: ProjectStats
  conversations: ConversationSummary[]
  documents: DocumentSummary[]
  deepDives: DeepDiveSummary[]
  strategyOutputs: StrategyOutputSummary[]
  syntheses: DimensionalSynthesis[]
  knowledgeSummary: string | null
  knowledgeUpdatedAt: string | null
  suggestedQuestions: string[]
}

// Dimension display names
const DIMENSION_LABELS: Record<Tier1Dimension, string> = {
  CUSTOMER_MARKET: 'Customer & Market',
  PROBLEM_OPPORTUNITY: 'Problem & Opportunity',
  VALUE_PROPOSITION: 'Value Proposition',
  DIFFERENTIATION_ADVANTAGE: 'Differentiation',
  COMPETITIVE_LANDSCAPE: 'Competition',
  BUSINESS_MODEL_ECONOMICS: 'Business Model',
  GO_TO_MARKET: 'Go-to-Market',
  PRODUCT_EXPERIENCE: 'Product & Experience',
  CAPABILITIES_ASSETS: 'Capabilities',
  RISKS_CONSTRAINTS: 'Risks & Constraints',
  STRATEGIC_INTENT: 'Strategic Intent',
}

// Get confidence icon
function ConfidenceIcon({ confidence }: { confidence: string }) {
  switch (confidence) {
    case 'HIGH':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
    case 'MEDIUM':
      return <Circle className="h-3.5 w-3.5 text-green-500" />
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
  }
}

// Dismissal types
interface Dismissal {
  itemType: string
  itemKey: string
  projectId: string | null
}

export default function ProjectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  // Expand/collapse state for sections
  const [showAllFocusAreas, setShowAllFocusAreas] = useState(false)
  const [showAllConversations, setShowAllConversations] = useState(false)
  const [showAllInputs, setShowAllInputs] = useState(false)
  const [showAllOutputs, setShowAllOutputs] = useState(false)
  const [showAllDeepDives, setShowAllDeepDives] = useState(false)

  // Fetch dismissals
  const fetchDismissals = async () => {
    try {
      const response = await fetch(`/api/dismissal?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        // Build a set of dismissed item keys for quick lookup
        const dismissed = new Set<string>()
        data.dismissals.forEach((d: Dismissal) => {
          dismissed.add(`${d.itemType}:${d.itemKey}`)
        })
        setDismissedItems(dismissed)
      }
    } catch (err) {
      console.error('Error fetching dismissals:', err)
    }
  }

  // Dismiss an item
  const dismissItem = async (itemType: string, itemContent: string) => {
    try {
      const response = await fetch('/api/dismissal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemContent, projectId }),
      })
      if (response.ok) {
        // Optimistically update the dismissed set using content directly (truncated to match server)
        const key = itemContent.slice(0, 255)
        setDismissedItems(prev => new Set(prev).add(`${itemType}:${key}`))
      }
    } catch (err) {
      console.error('Error dismissing item:', err)
    }
  }

  // Check if an item is dismissed
  const isItemDismissed = (itemType: string, itemContent: string): boolean => {
    const key = itemContent.slice(0, 255)
    return dismissedItems.has(`${itemType}:${key}`)
  }

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchProjectData()
    fetchDismissals()
  }, [session, status, router, projectId])

  const fetchProjectData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/project/${projectId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found')
        }
        throw new Error('Failed to fetch project data')
      }
      const data = await response.json()
      setProjectData(data)
    } catch (err) {
      console.error('Error fetching project:', err)
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchProjectData} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const stats = projectData?.stats || {
    fragmentCount: 0,
    conversationCount: 0,
    documentCount: 0,
    dimensionalCoverage: {},
  }

  // Calculate coverage percentage (dimensions with at least 1 fragment)
  const coveredDimensions = Object.values(stats.dimensionalCoverage).filter(d => d.fragmentCount > 0).length
  const coveragePercentage = Math.round((coveredDimensions / TIER_1_DIMENSIONS.length) * 100)

  // Get areas of focus (dimensions with LOW confidence or gaps), filtering out dismissed
  // Sort by least coverage (lowest fragment count first)
  const allAreasOfFocus = (projectData?.syntheses || [])
    .filter(s => s.confidence === 'LOW' || s.gaps.length > 0)
    .filter(s => !isItemDismissed('focus_area', s.dimension))
    .sort((a, b) => a.fragmentCount - b.fragmentCount)

  const FOCUS_AREA_LIMIT = 3
  const areasOfFocus = showAllFocusAreas ? allAreasOfFocus : allAreasOfFocus.slice(0, FOCUS_AREA_LIMIT)
  const hasMoreFocusAreas = allAreasOfFocus.length > FOCUS_AREA_LIMIT

  // Filter suggested questions to exclude dismissed ones
  const visibleQuestions = (projectData?.suggestedQuestions || [])
    .filter(q => !isItemDismissed('suggested_question', q))

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {projectData?.name || 'Your Strategy'}
          </h1>
          <p className="text-muted-foreground">
            Feed inputs, have conversations with Luna, and build your decision stack.
          </p>
        </div>

        {/* Top Section: What Luna Knows + Summary Stats */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* What Luna Knows - Left */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-green-600" />
                What Luna Knows
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectData?.knowledgeSummary ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {projectData.knowledgeSummary}
                  </p>
                  {projectData.knowledgeUpdatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(projectData.knowledgeUpdatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No knowledge yet</p>
                  <p className="text-xs mt-1">Have conversations with Luna to build context</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats + Dimensional Coverage - Right */}
          <div className="space-y-4">
            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.fragmentCount}</div>
                <div className="text-xs text-muted-foreground">Fragments</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.conversationCount}</div>
                <div className="text-xs text-muted-foreground">Chats</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.documentCount}</div>
                <div className="text-xs text-muted-foreground">Docs</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{coveragePercentage}%</div>
                <div className="text-xs text-muted-foreground">Coverage</div>
              </div>
            </div>

            {/* Dimensional Coverage - Compact List */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Dimensional Coverage</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {TIER_1_DIMENSIONS.map((dimension) => {
                    const coverage = stats.dimensionalCoverage[dimension]
                    const fragmentCount = coverage?.fragmentCount || 0
                    const synthesis = projectData?.syntheses?.find(s => s.dimension === dimension)
                    const confidence = synthesis?.confidence || (fragmentCount > 0 ? 'MEDIUM' : 'LOW')

                    return (
                      <div
                        key={dimension}
                        className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ConfidenceIcon confidence={confidence} />
                          <span className="text-muted-foreground">
                            {DIMENSION_LABELS[dimension]}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fragmentCount > 0 ? `${fragmentCount} fragments` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Middle Section: Inputs | Conversations | Outputs */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Inputs Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                Inputs
              </CardTitle>
              <CardDescription className="text-xs">
                Documents that inform your strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectData?.documents && projectData.documents.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const INPUT_LIMIT = 10
                    const allDocs = projectData.documents
                    const visibleDocs = showAllInputs ? allDocs : allDocs.slice(0, INPUT_LIMIT)
                    const hasMore = allDocs.length > INPUT_LIMIT

                    return (
                      <>
                        {visibleDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block text-xs">{doc.fileName}</span>
                            </div>
                            {doc.status === 'complete' && (
                              <Badge variant="default" className="text-xs bg-green-600 shrink-0">Done</Badge>
                            )}
                            {doc.status === 'processing' && (
                              <Badge variant="secondary" className="text-xs shrink-0">Processing</Badge>
                            )}
                          </div>
                        ))}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => setShowAllInputs(!showAllInputs)}
                          >
                            {showAllInputs ? 'Show less' : `Show ${allDocs.length - INPUT_LIMIT} more`}
                          </Button>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No documents yet</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </CardContent>
          </Card>

          {/* Conversations Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Conversations
              </CardTitle>
              <CardDescription className="text-xs">
                Your sessions with Luna
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectData?.conversations && projectData.conversations.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const CONVERSATION_LIMIT = 10
                    const allConversations = projectData.conversations
                    const visibleConversations = showAllConversations
                      ? allConversations
                      : allConversations.slice(0, CONVERSATION_LIMIT)
                    const hasMore = allConversations.length > CONVERSATION_LIMIT

                    return (
                      <>
                        {visibleConversations.map((conv) => (
                          <Link
                            key={conv.id}
                            href={`/conversation/${conv.id}`}
                            className="flex items-center justify-between p-2 rounded border hover:bg-accent transition-colors text-sm"
                          >
                            <div>
                              <div className="text-xs font-medium">
                                {new Date(conv.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {conv.messageCount} messages
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        ))}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => setShowAllConversations(!showAllConversations)}
                          >
                            {showAllConversations ? 'Show less' : `Show ${allConversations.length - CONVERSATION_LIMIT} more`}
                          </Button>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No conversations yet</p>
                </div>
              )}
              <Button asChild size="sm" className="w-full mt-3">
                <Link href="/">
                  <Plus className="h-3 w-3 mr-1" />
                  New Chat
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Outputs Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Outputs
              </CardTitle>
              <CardDescription className="text-xs">
                Your synthesized strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectData?.strategyOutputs && projectData.strategyOutputs.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const OUTPUT_LIMIT = 5
                    const allOutputs = projectData.strategyOutputs
                    const visibleOutputs = showAllOutputs ? allOutputs : allOutputs.slice(0, OUTPUT_LIMIT)
                    const hasMore = allOutputs.length > OUTPUT_LIMIT

                    return (
                      <>
                        {visibleOutputs.map((output) => (
                          <Link
                            key={output.id}
                            href={`/strategy/${output.id}`}
                            className="flex items-center justify-between p-2 rounded border hover:bg-accent transition-colors text-sm"
                          >
                            <div>
                              <div className="text-xs font-medium">Decision Stack</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(output.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        ))}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => setShowAllOutputs(!showAllOutputs)}
                          >
                            {showAllOutputs ? 'Show less' : `Show ${allOutputs.length - OUTPUT_LIMIT} more`}
                          </Button>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Target className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No outputs yet</p>
                  <p className="text-xs mt-1">Complete a chat to generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Opportunity to Enrich Strategy + Areas of Focus */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Opportunity to Enrich Strategy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-green-600" />
                Opportunity to Enrich Strategy
              </CardTitle>
              <CardDescription>
                Areas to explore next with Luna
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleQuestions.length > 0 ? (
                <div className="space-y-2">
                  {visibleQuestions.map((question, index) => (
                    <div
                      key={index}
                      className="flex items-stretch rounded-lg border hover:border-green-200 transition-colors text-sm overflow-hidden"
                    >
                      <Link
                        href={`/?question=${encodeURIComponent(question)}`}
                        className="flex-1 p-3 hover:bg-accent transition-colors"
                      >
                        {question}
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          dismissItem('suggested_question', question)
                        }}
                        className="px-3 flex items-center justify-center border-l hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4 text-green-600" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : projectData?.suggestedQuestions && projectData.suggestedQuestions.length > 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All suggestions addressed</p>
                  <p className="text-xs mt-1">New suggestions will appear as you continue exploring</p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No suggestions yet</p>
                  <p className="text-xs mt-1">Questions will appear after your first conversation</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Areas of Focus */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Areas of Focus
              </CardTitle>
              <CardDescription>
                Dimensions that need more exploration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {areasOfFocus.length > 0 ? (
                <div className="space-y-3">
                  {areasOfFocus.map((area) => (
                    <div key={area.dimension} className="flex items-stretch rounded-lg border overflow-hidden">
                      {/* Main content */}
                      <div className="flex-1 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {DIMENSION_LABELS[area.dimension as Tier1Dimension] || area.dimension}
                          </span>
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            Needs attention
                          </Badge>
                        </div>
                        {area.gaps.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Gap: {area.gaps[0]}
                          </p>
                        )}
                        {/* Compact action button group */}
                        <div className="flex items-center gap-1 pt-1">
                          <Link
                            href={`/?question=${encodeURIComponent(`Tell me more about your ${DIMENSION_LABELS[area.dimension as Tier1Dimension]?.toLowerCase() || area.dimension}`)}`}
                          >
                            <Button variant="outline" size="sm" className="h-7 px-2">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setUploadDialogOpen(true)}
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => dismissItem('focus_area', area.dimension)}
                              >
                                <X className="h-3.5 w-3.5 mr-2" />
                                Dismiss
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {/* Dismiss button - full height */}
                      <button
                        onClick={() => dismissItem('focus_area', area.dimension)}
                        className="px-3 flex items-center justify-center border-l hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4 text-amber-500" />
                      </button>
                    </div>
                  ))}
                  {hasMoreFocusAreas && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowAllFocusAreas(!showAllFocusAreas)}
                    >
                      {showAllFocusAreas ? 'Show less' : `Show ${allAreasOfFocus.length - FOCUS_AREA_LIMIT} more`}
                    </Button>
                  )}
                </div>
              ) : stats.fragmentCount > 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Looking good!</p>
                  <p className="text-xs mt-1">No major gaps detected in your strategy</p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No data yet</p>
                  <p className="text-xs mt-1">Have conversations to identify focus areas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deep Dives Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crosshair className="h-5 w-5 text-purple-600" />
                  Deep Dives
                </CardTitle>
                <CardDescription>
                  Topics you're exploring in depth
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Open add deep dive dialog
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Topic
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {projectData?.deepDives && projectData.deepDives.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const DEEP_DIVE_LIMIT = 3
                  const allDeepDives = projectData.deepDives
                  const visibleDeepDives = showAllDeepDives
                    ? allDeepDives
                    : allDeepDives.slice(0, DEEP_DIVE_LIMIT)
                  const hasMore = allDeepDives.length > DEEP_DIVE_LIMIT

                  return (
                    <>
                      {visibleDeepDives.map((dd) => (
                        <div
                          key={dd.id}
                          className="flex items-stretch rounded-lg border overflow-hidden hover:border-purple-200 transition-colors"
                        >
                          <div className="flex-1 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{dd.topic}</span>
                              <Badge
                                variant={dd.status === 'active' ? 'default' : 'secondary'}
                                className={dd.status === 'active' ? 'bg-purple-600' : ''}
                              >
                                {dd.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{dd.conversationCount} chats</span>
                              <span>{dd.documentCount} docs</span>
                              <span>
                                Last activity: {new Date(dd.lastActivityAt).toLocaleDateString()}
                              </span>
                            </div>
                            {/* Action button group */}
                            <div className="flex items-center gap-1 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => {
                                  // TODO: Navigate to new chat within deep dive
                                  router.push(`/?deepDiveId=${dd.id}`)
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setUploadDialogOpen(true)}
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 px-2">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      // TODO: Open deep dive sheet
                                    }}
                                  >
                                    View details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                      {hasMore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => setShowAllDeepDives(!showAllDeepDives)}
                        >
                          {showAllDeepDives
                            ? 'Show less'
                            : `Show ${allDeepDives.length - DEEP_DIVE_LIMIT} more`}
                        </Button>
                      )}
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Crosshair className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No deep dives yet</p>
                <p className="text-xs mt-1">
                  Create a topic to explore, or defer from a conversation
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={fetchProjectData}
      />
    </AppLayout>
  )
}
