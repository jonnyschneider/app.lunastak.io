'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { FirstTimeEmptyState } from '@/components/FirstTimeEmptyState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  MessageSquare,
  Plus,
  Upload,
  Loader2,
  Star,
  NotebookPen,
  CornerDownRight,
} from 'lucide-react'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import { AddDeepDiveDialog } from '@/components/add-deep-dive-dialog'
import { DeepDiveSheet } from '@/components/deep-dive-sheet'
import { ChatSheet, GapExploration } from '@/components/chat-sheet'
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
import { KnowledgebaseHeader } from '@/components/KnowledgebaseHeader'
import { ExploreNextSection, ExploreItem } from '@/components/ExploreNextSection'
import { GoToStrategyCard } from '@/components/GoToStrategyCard'
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
  deepDiveId: string | null
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
  const [uploadDeepDiveId, setUploadDeepDiveId] = useState<string | undefined>()
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>()
  const [chatDeepDiveId, setChatDeepDiveId] = useState<string | undefined>()
  const [chatGapExploration, setChatGapExploration] = useState<GapExploration | undefined>()
  const [chatResumeConversationId, setChatResumeConversationId] = useState<string | undefined>()
  const [chatViewOnly, setChatViewOnly] = useState(false)
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  // Expand/collapse state for sections
  const [showAllInputs, setShowAllInputs] = useState(false)
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
    // Close deep dive sheet and open chat with deep dive context
    setDeepDiveSheetOpen(false)
    setChatDeepDiveId(deepDiveId)
    setChatInitialQuestion(undefined) // Let user guide direction
    setChatGapExploration(undefined)
    setChatResumeConversationId(undefined)
    setChatViewOnly(false)
    setChatSheetOpen(true)
  }

  const handleUploadToDeepDive = (deepDiveId: string) => {
    // Close sheet and open upload dialog with deep dive context
    setDeepDiveSheetOpen(false)
    setUploadDeepDiveId(deepDiveId)
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
        <FirstTimeEmptyState
          projectId={projectId}
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

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Your Thinking
          </h1>
          <p className="text-muted-foreground">
            Capture ideas, explore questions, and refine your thinking.
          </p>
        </div>

        {/* Knowledgebase Header */}
        <KnowledgebaseHeader
          fragmentCount={stats.fragmentCount}
          chatCount={stats.conversationCount}
          docCount={stats.documentCount}
          coveragePercentage={coveragePercentage}
          newInsightsCount={stats.unsynthesizedFragmentCount}
          knowledgeSummary={projectData?.knowledgeSummary || null}
          dimensionalCoverage={stats.dimensionalCoverage}
          syntheses={projectData?.syntheses || []}
          onRefreshClick={() => setRefreshStrategyDialogOpen(true)}
        />

        {/* Documents | Chats */}
        <div className="grid gap-6 md:grid-cols-2">
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
                    onClick={() => {
                      setUploadDeepDiveId(undefined)
                      setUploadDialogOpen(true)
                    }}
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

                  // Find the initial conversation (oldest extracted conversation without deepDiveId)
                  // This is the original strategy-generating conversation - view only
                  const initialConversationId = projectData.conversations
                    .filter(c => !c.deepDiveId && c.status === 'extracted')
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id

                  const renderConversationItem = (conv: ConversationSummary, index: number) => {
                    const isInitialConversation = conv.id === initialConversationId
                    const deepDive = conv.deepDiveId
                      ? projectData?.deepDives?.find(dd => dd.id === conv.deepDiveId)
                      : null
                    const handleClick = () => {
                      setChatInitialQuestion(undefined)
                      setChatDeepDiveId(undefined)
                      setChatGapExploration(undefined)
                      setChatResumeConversationId(conv.id)
                      setChatViewOnly(isInitialConversation)
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
                            {deepDive && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                <CornerDownRight className="h-2.5 w-2.5" />
                                <span>Part of:</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openDeepDiveSheet(deepDive.id)
                                  }}
                                  className="border border-border rounded-full px-1.5 py-0.5 hover:bg-accent transition-colors"
                                >
                                  {deepDive.topic.length > 20 ? `${deepDive.topic.slice(0, 20)}…` : deepDive.topic}
                                </button>
                              </div>
                            )}
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
                    setChatDeepDiveId(undefined)
                    setChatGapExploration(undefined)
                    setChatResumeConversationId(undefined)
                    setChatViewOnly(false)
                    setChatSheetOpen(true)
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Chat
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Explore Next + Go to Strategy */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ExploreNextSection
            deepDives={projectData?.deepDives || []}
            provocations={projectData?.suggestedQuestions || []}
            syntheses={projectData?.syntheses || []}
            isItemDismissed={isItemDismissed}
            onDismissItem={dismissItem}
            onItemClick={(item: ExploreItem) => {
              if (item.type === 'deep-dive') {
                const ddId = item.id.replace('dd-', '')
                openDeepDiveSheet(ddId)
              } else if (item.type === 'provocation') {
                setChatInitialQuestion(item.description)
                setChatDeepDiveId(undefined)
                setChatGapExploration(undefined)
                setChatResumeConversationId(undefined)
                setChatViewOnly(false)
                setChatSheetOpen(true)
              } else if (item.type === 'gap') {
                setChatDeepDiveId(undefined)
                setChatInitialQuestion(undefined)
                setChatGapExploration({
                  dimension: item.dimension || '',
                  summary: item.description,
                })
                setChatResumeConversationId(undefined)
                setChatViewOnly(false)
                setChatSheetOpen(true)
              }
            }}
            onAddDeepDive={() => setAddDeepDiveOpen(true)}
          />
          <GoToStrategyCard />
        </div>
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={fetchProjectData}
        deepDiveId={uploadDeepDiveId}
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
            setChatViewOnly(false)
            // Refresh data after conversation to update knowledge base
            fetchProjectData()
          }
        }}
        initialQuestion={chatInitialQuestion}
        deepDiveId={chatDeepDiveId}
        gapExploration={chatGapExploration}
        resumeConversationId={chatResumeConversationId}
        hasExistingStrategy={(projectData?.strategyOutputs?.length ?? 0) > 0}
        viewOnly={chatViewOnly}
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
        onStartChat={handleStartDeepDiveChat}
        onUploadDoc={handleUploadToDeepDive}
        onViewConversation={(conversationId) => {
          // Close deep dive sheet and open conversation in ChatSheet
          setDeepDiveSheetOpen(false)
          setChatInitialQuestion(undefined)
          setChatDeepDiveId(undefined)
          setChatGapExploration(undefined)
          setChatResumeConversationId(conversationId)
          setChatViewOnly(false)
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
