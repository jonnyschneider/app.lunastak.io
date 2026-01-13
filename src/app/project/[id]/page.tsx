'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { ProjectEmptyState } from '@/components/ProjectEmptyState'
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
  Database,
  Star,
} from 'lucide-react'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import { AddDeepDiveDialog } from '@/components/add-deep-dive-dialog'
import { DeepDiveSheet } from '@/components/deep-dive-sheet'
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
  title: string | null
  createdAt: string
  status: string
  messageCount: number
  fragmentCount: number
  starred: boolean
  starredAt: string | null
}

// Format date as "13 Jan '26"
function formatShortDate(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = date.getFullYear().toString().slice(-2)
  return `${day} ${month} '${year}`
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
  const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
  const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)

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

  // Deep dive handlers
  const openDeepDiveSheet = (id: string) => {
    setSelectedDeepDiveId(id)
    setDeepDiveSheetOpen(true)
  }

  const handleStartDeepDiveChat = (deepDiveId: string) => {
    router.push(`/?deepDiveId=${deepDiveId}`)
  }

  const handleUploadToDeepDive = (deepDiveId: string) => {
    // Close sheet and open upload dialog
    setDeepDiveSheetOpen(false)
    setUploadDialogOpen(true)
  }

  // Toggle conversation star
  const toggleConversationStar = async (conversationId: string, currentStarred: boolean) => {
    // Optimistic update
    setProjectData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        conversations: prev.conversations.map(c =>
          c.id === conversationId
            ? { ...c, starred: !currentStarred, starredAt: !currentStarred ? new Date().toISOString() : null }
            : c
        ),
      }
    })

    try {
      const response = await fetch(`/api/conversation/${conversationId}/star`, {
        method: 'POST',
      })

      if (!response.ok) {
        // Revert on failure
        setProjectData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            conversations: prev.conversations.map(c =>
              c.id === conversationId
                ? { ...c, starred: currentStarred, starredAt: c.starredAt }
                : c
            ),
          }
        })
      }
    } catch (error) {
      console.error('Failed to toggle star:', error)
      // Revert on failure
      setProjectData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === conversationId
              ? { ...c, starred: currentStarred, starredAt: c.starredAt }
              : c
          ),
        }
      })
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
        <div className="container mx-auto px-6 py-8">
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

  // Show empty state when project has no content
  const isEmpty =
    (projectData?.stats?.fragmentCount ?? 0) === 0 &&
    (projectData?.conversations?.length ?? 0) === 0

  if (isEmpty && projectData) {
    return (
      <AppLayout>
        <ProjectEmptyState
          projectId={projectId}
          onStartConversation={() => router.push(`/?projectId=${projectId}`)}
          onUploadDocument={() => setUploadDialogOpen(true)}
        />
        <DocumentUploadDialog
          projectId={projectId}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadComplete={() => fetchProjectData()}
        />
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
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Refine Your Strategic Direction
          </h1>
          <p className="text-muted-foreground">
            Your second brain for strategy. Capture ideas, explore questions, and refine your thinking.
          </p>
        </div>

        {/* Documents | Chats | Generated Strategies */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Documents Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                Documents & Uploads
              </CardTitle>
              <CardDescription className="text-xs">
                Files that inform your strategy
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
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0 self-start mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{doc.fileName}</div>
                              <div className="text-xs text-muted-foreground">
                                {doc.status === 'complete'
                                  ? `${doc.fragmentCount} fragments`
                                  : doc.status === 'processing'
                                    ? 'Processing...'
                                    : doc.status}
                              </div>
                            </div>
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

          {/* Chats Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Chats
              </CardTitle>
              <CardDescription className="text-xs">
                Your conversations with Luna
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectData?.conversations && projectData.conversations.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const STARRED_LIMIT = 3
                    const RECENT_LIMIT = 3
                    const starredConversations = projectData.conversations.filter(c => c.starred)
                    const recentConversations = projectData.conversations.filter(c => !c.starred)
                    const visibleStarred = showAllConversations
                      ? starredConversations
                      : starredConversations.slice(0, STARRED_LIMIT)
                    const visibleRecent = showAllConversations
                      ? recentConversations
                      : recentConversations.slice(0, RECENT_LIMIT)
                    const totalHidden = (starredConversations.length - visibleStarred.length) +
                      (recentConversations.length - visibleRecent.length)

                    const renderConversationItem = (conv: ConversationSummary) => (
                      <div
                        key={conv.id}
                        className="flex items-center gap-1 p-2 rounded border hover:bg-accent transition-colors text-sm"
                      >
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            toggleConversationStar(conv.id, conv.starred)
                          }}
                          className="shrink-0 p-1 hover:bg-muted rounded transition-colors"
                          title={conv.starred ? 'Unstar' : 'Star'}
                        >
                          <Star className={`h-3 w-3 ${conv.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                        </button>
                        <Link
                          href={`/conversation/${conv.id}`}
                          className="flex-1 min-w-0 mr-1"
                        >
                          <div className="text-xs font-medium truncate">
                            {conv.title || 'Untitled conversation'}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{formatShortDate(conv.createdAt)}</span>
                            {conv.fragmentCount > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Analysed
                              </Badge>
                            )}
                          </div>
                        </Link>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    )

                    return (
                      <>
                        {/* Starred section */}
                        {visibleStarred.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 pt-1">
                              <Star className="h-3 w-3 fill-current" />
                              Starred
                            </div>
                            {visibleStarred.map(renderConversationItem)}
                          </>
                        )}
                        {/* Recent section */}
                        {visibleRecent.length > 0 && (
                          <>
                            {visibleStarred.length > 0 && (
                              <div className="text-xs font-medium text-muted-foreground pt-2">
                                Recent
                              </div>
                            )}
                            {visibleRecent.map(renderConversationItem)}
                          </>
                        )}
                        {totalHidden > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => setShowAllConversations(!showAllConversations)}
                          >
                            {showAllConversations ? 'Show less' : `Show ${totalHidden} more`}
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
                <Link href={`/?projectId=${projectId}`}>
                  <Plus className="h-3 w-3 mr-1" />
                  New Chat
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Generated Strategy Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Generated Strategies
              </CardTitle>
              <CardDescription className="text-xs">
                Decision stacks from Luna
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

        {/* Strategic Dimensions + Knowledge Base */}
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
                  <p className="text-xs mt-1 mb-4">Have conversations with Luna to build context</p>
                  <Button asChild size="sm">
                    <Link href={`/?projectId=${projectId}`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start a Conversation
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Knowledge Base - Right */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-green-600" />
                10 Strategic Dimensions
              </CardTitle>
              <CardDescription>
                Luna's knowledge map for your strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Row */}
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

              {/* 10 Dimensions Section */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Coverage across 10 strategic dimensions
                </h4>
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
                          {fragmentCount > 0 ? `${fragmentCount}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section: Luna's Questions + Areas of Focus */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Provocations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-green-600" />
                Provocations
              </CardTitle>
              <CardDescription>
                Questions that might unlock new strategic insights
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
                  <p className="text-sm">Luna hasn&apos;t started wondering yet</p>
                  <p className="text-xs mt-1">Questions will appear as Luna learns more about your strategy</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your Deep Dives */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Crosshair className="h-5 w-5 text-green-600" />
                    Your Deep Dives
                  </CardTitle>
                  <CardDescription>
                    Topics you&apos;ve flagged for further exploration
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDeepDiveOpen(true)}
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
                    // Filter out dismissed deep dives
                    const allDeepDives = projectData.deepDives.filter(
                      dd => !isItemDismissed('deep_dive', dd.id)
                    )
                    const visibleDeepDives = showAllDeepDives
                      ? allDeepDives
                      : allDeepDives.slice(0, DEEP_DIVE_LIMIT)
                    const hasMore = allDeepDives.length > DEEP_DIVE_LIMIT

                    return (
                      <>
                        {visibleDeepDives.map((dd) => (
                          <div
                            key={dd.id}
                            className="flex items-stretch rounded-lg border overflow-hidden hover:border-green-200 transition-colors"
                          >
                            {/* Clickable content area - opens sheet */}
                            <button
                              className="flex-1 p-3 space-y-2 text-left hover:bg-accent/50 transition-colors"
                              onClick={() => openDeepDiveSheet(dd.id)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{dd.topic}</span>
                                <Badge
                                  variant={dd.status === 'active' ? 'outline' : 'secondary'}
                                  className={dd.status === 'active' ? 'text-xs text-amber-600 border-amber-300' : 'text-xs'}
                                >
                                  {dd.status === 'resolved'
                                    ? 'Resolved'
                                    : dd.conversationCount > 0
                                      ? 'In progress'
                                      : 'Ready to explore'}
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
                              <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/?deepDiveId=${dd.id}`)
                                  }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setUploadDialogOpen(true)
                                  }}
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openDeepDiveSheet(dd.id)
                                      }}
                                    >
                                      View details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        dismissItem('deep_dive', dd.id)
                                      }}
                                    >
                                      <X className="h-3.5 w-3.5 mr-2" />
                                      Dismiss
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </button>
                            {/* Dismiss button - full height */}
                            <button
                              onClick={() => dismissItem('deep_dive', dd.id)}
                              className="px-3 flex items-center justify-center border-l hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                              title="Dismiss"
                            >
                              <X className="h-4 w-4 text-amber-500" />
                            </button>
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
                    Flag a topic to explore, or defer from a conversation
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Worth Exploring */}
        <div className="grid gap-6 lg:grid-cols-1">
          {/* Worth Exploring */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Close Gaps with 10 Strategic Dimensions
              </CardTitle>
              <CardDescription>
                Luna suggests exploring these areas to improve your strategic coverage
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
                      {area.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {area.summary}
                        </p>
                      )}
                      {area.gaps.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-600">Gaps to explore:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {area.gaps.slice(0, 3).map((gap, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span className="line-clamp-1">{gap}</span>
                              </li>
                            ))}
                            {area.gaps.length > 3 && (
                              <li className="text-amber-500 text-xs">+{area.gaps.length - 3} more</li>
                            )}
                          </ul>
                        </div>
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
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={fetchProjectData}
      />

      {/* Add Deep Dive Dialog */}
      <AddDeepDiveDialog
        projectId={projectId}
        open={addDeepDiveOpen}
        onOpenChange={setAddDeepDiveOpen}
        onCreated={fetchProjectData}
      />

      {/* Deep Dive Sheet */}
      <DeepDiveSheet
        deepDiveId={selectedDeepDiveId}
        open={deepDiveSheetOpen}
        onOpenChange={setDeepDiveSheetOpen}
        onResolve={fetchProjectData}
        onDismiss={(id) => dismissItem('deep_dive', id)}
        onStartChat={handleStartDeepDiveChat}
        onUploadDoc={handleUploadToDeepDive}
      />
    </AppLayout>
  )
}
