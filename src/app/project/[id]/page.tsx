'use client'

import React, { useEffect, useState } from 'react'
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
  Sparkles,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  X,
  MoreHorizontal,
  Crosshair,
  Database,
  Star,
  NotebookPen,
  RefreshCw,
} from 'lucide-react'
import { TIER_1_DIMENSIONS, Tier1Dimension } from '@/lib/constants/dimensions'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import { AddDeepDiveDialog } from '@/components/add-deep-dive-dialog'
import { DeepDiveSheet } from '@/components/deep-dive-sheet'
import { ChatSheet, GapExploration } from '@/components/chat-sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemSeparator,
} from '@/components/ui/item'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FakeDoorDialog } from '@/components/FakeDoorDialog'
import { SynthesisDialog } from '@/components/SynthesisDialog'
import { RefreshStrategyDialog } from '@/components/RefreshStrategyDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StructuredProvocation } from '@/lib/types'

interface ProjectStats {
  fragmentCount: number
  conversationCount: number
  documentCount: number
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  unsynthesizedFragmentCount: number
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
  gaps: StructuredProvocation[]
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
  suggestedQuestions: StructuredProvocation[]
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

// Harvey ball for confidence visualization
function HarveyBall({ confidence }: { confidence: string }) {
  const size = 14
  const radius = 6
  const cx = 7
  const cy = 7

  // Map confidence to fill percentage
  const fillPercent = confidence === 'HIGH' ? 100 : confidence === 'MEDIUM' ? 50 : 0

  if (fillPercent === 0) {
    // Empty circle
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-muted-foreground/40">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  if (fillPercent === 100) {
    // Full circle
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-green-600">
        <circle cx={cx} cy={cy} r={radius} fill="currentColor" />
      </svg>
    )
  }

  // Half circle (50%)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-green-600">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d={`M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx} ${cy + radius} Z`}
        fill="currentColor"
      />
    </svg>
  )
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
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>()
  const [chatDeepDiveId, setChatDeepDiveId] = useState<string | undefined>()
  const [chatGapExploration, setChatGapExploration] = useState<GapExploration | undefined>()
  const [chatResumeConversationId, setChatResumeConversationId] = useState<string | undefined>()
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  // Expand/collapse state for sections
  const [showAllFocusAreas, setShowAllFocusAreas] = useState(false)
  const [showAllInputs, setShowAllInputs] = useState(false)
  const [showAllOutputs, setShowAllOutputs] = useState(false)
  const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
  const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false)
  const [fakeDoorConfig, setFakeDoorConfig] = useState<{
    name: string
    description: string
    feature: string
  } | null>(null)
  const [synthesisDialogOpen, setSynthesisDialogOpen] = useState(false)
  const [refreshStrategyDialogOpen, setRefreshStrategyDialogOpen] = useState(false)
  const [chatsActiveTab, setChatsActiveTab] = useState<string | undefined>(undefined)

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

    // Don't redirect to signin - guests can access projects via cookie
    // The API will return 401 if unauthorized
    fetchProjectData()
    fetchDismissals()
  }, [status, projectId])

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

  // Fake door handlers
  const handleFakeDoor = (feature: string) => {
    const featureConfig: Record<string, { name: string; description: string }> = {
      'Add Memo': {
        name: 'Memos',
        description: 'Capture quick thoughts, voice notes, or observations directly in your project.\n\nJot down ideas from meetings, record voice memos on the go, or capture spontaneous insights. Luna will extract strategic themes from your memos.',
      },
      'Create from Blank': {
        name: 'Blank Canvas Strategy',
        description: 'Start with a fresh strategic framework, unconstrained by your existing inputs.\n\nBuild your decision stack from first principles, defining vision, strategy, and objectives without prior context.',
      },
    }

    setFakeDoorConfig({
      ...featureConfig[feature],
      feature,
    })
    setFakeDoorOpen(true)
  }

  const handleFakeDoorInterest = () => {
    if (!fakeDoorConfig) return
    // Log interest for now - project-level events don't have conversationId required by Event model.
    // TODO: Once beta scope is locked, implement as Statsig custom event for proper analytics.
    console.log(`[FakeDoor] User interested in: ${fakeDoorConfig.feature} (project: ${projectId})`)
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
    unsynthesizedFragmentCount: 0,
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

  // Filter suggested questions to exclude dismissed ones (use description as identifier)
  const visibleQuestions = (projectData?.suggestedQuestions || [])
    .filter(q => !isItemDismissed('suggested_question', q.description))

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
                Documents & Memos
              </CardTitle>
              <CardDescription className="text-xs">
                Files and notes that inform your strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {projectData?.documents && projectData.documents.length > 0 ? (
                (() => {
                  const INPUT_LIMIT = 10
                  const allDocs = projectData.documents
                  const visibleDocs = showAllInputs ? allDocs : allDocs.slice(0, INPUT_LIMIT)
                  const hasMore = allDocs.length > INPUT_LIMIT

                  return (
                    <ItemGroup>
                      {visibleDocs.map((doc, index) => (
                        <React.Fragment key={doc.id}>
                          {index > 0 && <ItemSeparator />}
                          <Item size="sm">
                            <ItemContent>
                              <ItemTitle className="text-xs truncate">{doc.fileName}</ItemTitle>
                              <ItemDescription className="text-xs">
                                {doc.status === 'complete'
                                  ? `${doc.fragmentCount} fragments`
                                  : doc.status === 'processing'
                                    ? 'Processing...'
                                    : doc.status}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        </React.Fragment>
                      ))}
                      {hasMore && (
                        <>
                          <ItemSeparator />
                          <div className="px-4 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => setShowAllInputs(!showAllInputs)}
                            >
                              {showAllInputs ? 'Show less' : `Show ${allDocs.length - INPUT_LIMIT} more`}
                            </Button>
                          </div>
                        </>
                      )}
                    </ItemGroup>
                  )
                })()
              ) : (
                <div className="text-center py-4 px-6 text-muted-foreground">
                  <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No documents yet</p>
                </div>
              )}
              <div className="p-4 pt-3 border-t">
                <div className="flex w-full">
                  <Button
                    size="sm"
                    className="flex-1 rounded-r-none"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload Doc
                  </Button>
                  <div className="w-px bg-primary-foreground/20" />
                  <Button
                    size="sm"
                    className="flex-1 rounded-l-none"
                    onClick={() => handleFakeDoor('Add Memo')}
                  >
                    <NotebookPen className="h-3 w-3 mr-1" />
                    Add Memo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chats Column */}
          <Card data-section="chats">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Chats
              </CardTitle>
              <CardDescription className="text-xs">
                Your conversations with Luna
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {projectData?.conversations && projectData.conversations.length > 0 ? (
                (() => {
                  const analysedConversations = projectData.conversations.filter(
                    c => c.status === 'extracted' || c.fragmentCount > 0
                  )
                  const inProgressConversations = projectData.conversations.filter(
                    c => c.status === 'in_progress'
                  )

                  const renderConversationItem = (conv: ConversationSummary, index: number) => {
                    const handleClick = () => {
                      setChatInitialQuestion(undefined)
                      setChatDeepDiveId(undefined)
                      setChatGapExploration(undefined)
                      setChatResumeConversationId(conv.id)
                      setChatSheetOpen(true)
                    }

                    return (
                      <React.Fragment key={conv.id}>
                        {index > 0 && <ItemSeparator />}
                        <Item
                          size="sm"
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={handleClick}
                        >
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleConversationStar(conv.id, conv.starred)
                            }}
                            className="shrink-0 p-1 hover:bg-muted rounded transition-colors"
                            title={conv.starred ? 'Unstar' : 'Star'}
                          >
                            <Star className={`h-3 w-3 ${conv.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                          </button>
                          <ItemContent>
                            <ItemTitle className="text-xs truncate">
                              {conv.title || 'Untitled conversation'}
                            </ItemTitle>
                            <ItemDescription className="text-xs">
                              {formatShortDate(conv.createdAt)}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      </React.Fragment>
                    )
                  }

                  return (
                    <Tabs
                      value={chatsActiveTab ?? (inProgressConversations.length > 0 ? 'in-progress' : 'analysed')}
                      onValueChange={setChatsActiveTab}
                      className="h-full"
                    >
                      <div className="border-b px-4">
                        <TabsList className="h-10 bg-transparent p-0 gap-4">
                          <TabsTrigger
                            value="analysed"
                            className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                          >
                            Analysed
                            {analysedConversations.length > 0 && (
                              <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                                {analysedConversations.length}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger
                            value="in-progress"
                            className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                          >
                            In Progress
                            {inProgressConversations.length > 0 && (
                              <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                                {inProgressConversations.length}
                              </span>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="analysed" className="mt-0">
                        {analysedConversations.length > 0 ? (
                          <ItemGroup>
                            {analysedConversations.map((conv, index) => renderConversationItem(conv, index))}
                          </ItemGroup>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <p className="text-xs">No analysed conversations yet</p>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="in-progress" className="mt-0">
                        {inProgressConversations.length > 0 ? (
                          <ItemGroup>
                            {inProgressConversations.map((conv, index) => renderConversationItem(conv, index))}
                          </ItemGroup>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground">
                            <p className="text-xs">No conversations in progress</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )
                })()
              ) : (
                <div className="text-center py-4 px-6 text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No conversations yet</p>
                </div>
              )}
              <div className="p-4 pt-3 border-t">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setChatInitialQuestion(undefined)
                    setChatSheetOpen(true)
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Chat
                </Button>
              </div>
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
            <CardContent className="p-0">
              {projectData?.strategyOutputs && projectData.strategyOutputs.length > 0 ? (
                (() => {
                  const OUTPUT_LIMIT = 5
                  const allOutputs = projectData.strategyOutputs
                  const visibleOutputs = showAllOutputs ? allOutputs : allOutputs.slice(0, OUTPUT_LIMIT)
                  const hasMore = allOutputs.length > OUTPUT_LIMIT

                  return (
                    <ItemGroup>
                      {visibleOutputs.map((output, index) => (
                        <React.Fragment key={output.id}>
                          {index > 0 && <ItemSeparator />}
                          <Item asChild size="sm" className="cursor-pointer hover:bg-accent/50">
                            <Link href={`/strategy/${output.id}`}>
                              <ItemContent>
                                <ItemTitle className="text-xs">Decision Stack</ItemTitle>
                                <ItemDescription className="text-xs">
                                  {new Date(output.createdAt).toLocaleDateString()}
                                </ItemDescription>
                              </ItemContent>
                            </Link>
                          </Item>
                        </React.Fragment>
                      ))}
                      {hasMore && (
                        <>
                          <ItemSeparator />
                          <div className="px-4 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => setShowAllOutputs(!showAllOutputs)}
                            >
                              {showAllOutputs ? 'Show less' : `Show ${allOutputs.length - OUTPUT_LIMIT} more`}
                            </Button>
                          </div>
                        </>
                      )}
                    </ItemGroup>
                  )
                })()
              ) : (
                <div className="text-center py-4 px-6 text-muted-foreground">
                  <Target className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No outputs yet</p>
                  <p className="text-xs mt-1">Complete a chat to generate</p>
                </div>
              )}
              <div className="p-4 pt-3 border-t">
                <div className="flex w-full">
                  <Button
                    size="sm"
                    className="flex-1 rounded-r-none"
                    onClick={() => setRefreshStrategyDialogOpen(true)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh Strategy
                  </Button>
                  <div className="w-px bg-primary-foreground/20" />
                  <Button
                    size="sm"
                    className="flex-1 rounded-l-none"
                    onClick={() => handleFakeDoor('Create from Blank')}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Blank Canvas
                  </Button>
                </div>
              </div>
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
              <CardDescription>
                Key strategic insights from your thinking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const unfinishedCount = projectData?.conversations?.filter(c => c.status === 'in_progress').length || 0
                const fragmentCount = stats.fragmentCount
                const chatCount = stats.conversationCount
                const docCount = stats.documentCount
                const newInsightsCount = stats.unsynthesizedFragmentCount

                return projectData?.knowledgeSummary ? (
                  <div className="space-y-4">
                    {/* Metadata header - Counters */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs border border-green-600 text-green-700 flex items-center justify-center">
                          {fragmentCount}
                        </span>
                        <span>insights</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs border border-green-600 text-green-700 flex items-center justify-center">
                          {chatCount}
                        </span>
                        <span>chats</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs border border-green-600 text-green-700 flex items-center justify-center">
                          {docCount}
                        </span>
                        <span>docs</span>
                      </div>
                      {unfinishedCount > 0 && (
                        <button
                          onClick={() => {
                            setChatsActiveTab('in-progress')
                            document.querySelector('[data-section="chats"]')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:underline"
                        >
                          <span className="h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs bg-red-500 text-white flex items-center justify-center">
                            {unfinishedCount}
                          </span>
                          unfinished
                        </button>
                      )}
                      <button
                        onClick={() => newInsightsCount > 0 && setSynthesisDialogOpen(true)}
                        className={`flex items-center gap-1.5 ${
                          newInsightsCount > 0
                            ? 'text-green-700 hover:text-green-800 hover:underline cursor-pointer'
                            : 'text-muted-foreground cursor-default'
                        }`}
                        disabled={newInsightsCount === 0}
                      >
                        <span className={`h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs flex items-center justify-center ${
                          newInsightsCount > 0
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {newInsightsCount}
                        </span>
                        new to include
                      </button>
                    </div>

                    {/* Summary */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {projectData.knowledgeSummary}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No knowledge yet</p>
                    <p className="text-xs mt-1 mb-4">Have conversations with Luna to build context</p>
                    {unfinishedCount > 0 && (
                      <button
                        onClick={() => {
                          setChatsActiveTab('in-progress')
                          document.querySelector('[data-section="chats"]')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 hover:underline block mx-auto mb-4"
                      >
                        {unfinishedCount} unfinished thread{unfinishedCount !== 1 ? 's' : ''}
                      </button>
                    )}
                    <Button asChild size="sm">
                      <Link href={`/?projectId=${projectId}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start a Conversation
                      </Link>
                    </Button>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Knowledge Base - Right */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-green-600" />
                10 Strategic Dimensions
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className="h-5 min-w-5 rounded-full px-1.5 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                  {coveragePercentage}%
                </span>
                coverage of strategic areas
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                        <HarveyBall confidence={confidence} />
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
            </CardContent>
          </Card>
        </div>

        {/* Deep Dives - Full Width Panel */}
        {(() => {
          const allDeepDives = projectData?.deepDives?.filter(
            dd => !isItemDismissed('deep_dive', dd.id)
          ) || []
          const inProgress = allDeepDives.filter(dd => dd.conversationCount > 0)
          const readyToExplore = allDeepDives.filter(dd => dd.conversationCount === 0)
          const totalCount = allDeepDives.length

          const renderDeepDiveItem = (dd: DeepDiveSummary, index: number) => (
            <React.Fragment key={dd.id}>
              {index > 0 && <ItemSeparator />}
              <Item
                size="sm"
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => openDeepDiveSheet(dd.id)}
              >
                <ItemContent>
                  <ItemTitle>{dd.topic}</ItemTitle>
                  <ItemDescription className="text-xs">
                    {dd.conversationCount > 0
                      ? `${dd.conversationCount} chat${dd.conversationCount !== 1 ? 's' : ''}`
                      : 'Not started'}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded hover:bg-muted">
                        <MoreHorizontal className="h-3 w-3 text-green-600" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        setChatDeepDiveId(dd.id)
                        setChatInitialQuestion(undefined)
                        setChatGapExploration(undefined)
                        setChatSheetOpen(true)
                      }}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        dismissItem('deep_dive', dd.id)
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Dismiss
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            </React.Fragment>
          )

          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crosshair className="h-5 w-5 text-green-600" />
                  Deep Dives
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                  {/* Left: Tabbed List */}
                  <div className="min-h-[200px] flex flex-col">
                    <div className="flex-1">
                    {totalCount > 0 ? (
                      <Tabs defaultValue={inProgress.length > 0 ? 'in-progress' : 'ready'} className="h-full">
                        <div className="border-b px-4">
                          <TabsList className="h-10 bg-transparent p-0 gap-4">
                            <TabsTrigger
                              value="in-progress"
                              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                              In Progress
                              {inProgress.length > 0 && (
                                <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                                  {inProgress.length}
                                </span>
                              )}
                            </TabsTrigger>
                            <TabsTrigger
                              value="ready"
                              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                            >
                              Ready to Explore
                              {readyToExplore.length > 0 && (
                                <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                                  {readyToExplore.length}
                                </span>
                              )}
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        <TabsContent value="in-progress" className="mt-0">
                          {inProgress.length > 0 ? (
                            <ItemGroup>
                              {inProgress.map((dd, index) => renderDeepDiveItem(dd, index))}
                            </ItemGroup>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="text-sm">No deep dives in progress</p>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="ready" className="mt-0">
                          {readyToExplore.length > 0 ? (
                            <ItemGroup>
                              {readyToExplore.map((dd, index) => renderDeepDiveItem(dd, index))}
                            </ItemGroup>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="text-sm">No deep dives ready to explore</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="flex items-center justify-center h-full py-8 text-muted-foreground">
                        <div className="text-center">
                          <Crosshair className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No deep dives yet</p>
                          <p className="text-xs mt-1">Flag topics to explore further</p>
                        </div>
                      </div>
                    )}
                    </div>
                    <div className="p-4 pt-3 border-t mt-auto">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setAddDeepDiveOpen(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Deep Dive
                      </Button>
                    </div>
                  </div>

                  {/* Right: Explainer */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">What are Deep Dives?</h4>
                      <p className="text-sm text-muted-foreground">
                        Deep Dives are topics you&apos;ve flagged for focused exploration.
                        Unlike quick conversations, these are threads you return to multiple times
                        to build deeper understanding.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">How to create one</h4>
                      <p className="text-sm text-muted-foreground">
                        During any conversation, tell Luna you want to explore a topic further.
                        You can also promote uploaded documents or create one directly using the Add button.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Provocations + Strategic Gaps */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Provocations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-green-600" />
                Provocations
              </CardTitle>
              <CardDescription>
                Sharp perspectives that unlock new insights
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {visibleQuestions.length > 0 ? (
                <ItemGroup>
                  {visibleQuestions.map((question, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <ItemSeparator />}
                        <Item
                          size="sm"
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => {
                            setChatInitialQuestion(question.description)
                            setChatSheetOpen(true)
                          }}
                        >
                          <ItemContent>
                            <ItemTitle>{question.title}</ItemTitle>
                            <ItemDescription className="text-xs">{question.description}</ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                dismissItem('suggested_question', question.description)
                              }}
                              className="p-1 rounded hover:bg-muted"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3 text-green-600" />
                            </button>
                          </ItemActions>
                        </Item>
                      </React.Fragment>
                    )
                  )}
                </ItemGroup>
              ) : projectData?.suggestedQuestions && projectData.suggestedQuestions.length > 0 ? (
                <div className="text-center py-6 px-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All suggestions addressed</p>
                  <p className="text-xs mt-1">New suggestions will appear as you continue exploring</p>
                </div>
              ) : (
                <div className="text-center py-6 px-6 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Luna hasn&apos;t started wondering yet</p>
                  <p className="text-xs mt-1">Questions will appear as Luna learns more about your strategy</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategic Gaps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Strategic Gaps
              </CardTitle>
              <CardDescription>
                Cover your bases by focussing on gaps
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
            {areasOfFocus.length > 0 ? (
              <ItemGroup>
                {areasOfFocus.map((area, index) => {
                  // Use first gap as the main content, dimension as subtle label
                  const gap = area.gaps[0]
                  const title = gap?.title || 'Explore this area'
                  const description = gap?.description || area.summary || ''
                  const dimensionLabel = DIMENSION_LABELS[area.dimension as Tier1Dimension] || area.dimension

                  return (
                    <React.Fragment key={area.dimension}>
                      {index > 0 && <ItemSeparator />}
                      <Item
                        size="sm"
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => {
                          setChatDeepDiveId(undefined)
                          setChatInitialQuestion(undefined)
                          setChatGapExploration({
                            dimension: area.dimension,
                            summary: area.summary || undefined,
                          })
                          setChatSheetOpen(true)
                        }}
                      >
                        <ItemContent>
                          <ItemTitle>{title}</ItemTitle>
                          <ItemDescription className="text-xs">{description}</ItemDescription>
                          <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5 mt-1 w-fit">
                            {dimensionLabel}
                          </span>
                        </ItemContent>
                        <ItemActions>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              dismissItem('focus_area', area.dimension)
                            }}
                            className="p-1 rounded hover:bg-muted"
                            title="Dismiss"
                          >
                            <X className="h-3 w-3 text-green-600" />
                          </button>
                        </ItemActions>
                      </Item>
                    </React.Fragment>
                  )
                })}
                {hasMoreFocusAreas && (
                  <>
                    <ItemSeparator />
                    <div className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => setShowAllFocusAreas(!showAllFocusAreas)}
                      >
                        {showAllFocusAreas ? 'Show less' : `Show ${allAreasOfFocus.length - FOCUS_AREA_LIMIT} more`}
                      </Button>
                    </div>
                  </>
                )}
              </ItemGroup>
            ) : stats.fragmentCount > 0 ? (
              <div className="text-center py-6 px-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">Looking good!</p>
                <p className="text-xs mt-1">No major gaps detected</p>
              </div>
            ) : (
              <div className="text-center py-6 px-6 text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No gaps identified yet</p>
                <p className="text-xs mt-1">Chat with Luna to discover areas to explore</p>
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

      {/* Chat Sheet */}
      <ChatSheet
        projectId={projectId}
        open={chatSheetOpen}
        onOpenChange={(open) => {
          setChatSheetOpen(open)
          if (!open) {
            setChatInitialQuestion(undefined)
            setChatDeepDiveId(undefined)
            setChatGapExploration(undefined)
            setChatResumeConversationId(undefined)
            // Refresh data after conversation to update knowledge base
            fetchProjectData()
          }
        }}
        initialQuestion={chatInitialQuestion}
        deepDiveId={chatDeepDiveId}
        gapExploration={chatGapExploration}
        resumeConversationId={chatResumeConversationId}
        hasExistingStrategy={(projectData?.strategyOutputs?.length ?? 0) > 0}
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
        onViewConversation={(conversationId) => {
          // Close deep dive sheet and open conversation in ChatSheet
          setDeepDiveSheetOpen(false)
          setChatInitialQuestion(undefined)
          setChatDeepDiveId(undefined)
          setChatGapExploration(undefined)
          setChatResumeConversationId(conversationId)
          setChatSheetOpen(true)
        }}
      />

      {/* Fake Door Dialog */}
      {fakeDoorConfig && (
        <FakeDoorDialog
          open={fakeDoorOpen}
          onOpenChange={setFakeDoorOpen}
          featureName={fakeDoorConfig.name}
          description={fakeDoorConfig.description}
          onInterest={handleFakeDoorInterest}
        />
      )}

      {/* Synthesis Dialog */}
      <SynthesisDialog
        projectId={projectId}
        open={synthesisDialogOpen}
        onOpenChange={setSynthesisDialogOpen}
        onComplete={fetchProjectData}
      />

      {/* Refresh Strategy Dialog */}
      <RefreshStrategyDialog
        projectId={projectId}
        open={refreshStrategyDialogOpen}
        onOpenChange={setRefreshStrategyDialogOpen}
        onComplete={(traceId) => {
          setRefreshStrategyDialogOpen(false)
          router.push(`/strategy/${traceId}`)
        }}
      />
    </AppLayout>
  )
}
