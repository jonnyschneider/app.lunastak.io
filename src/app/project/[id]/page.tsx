'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { getStatsigClient } from '@/components/StatsigProvider'
import { AppLayout } from '@/components/layout/app-layout'
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
import {
  useProUpgradeFlow,
  ProFeatureInterstitial,
  UpgradeSuccessDialog,
  ProComingSoonDialog,
} from '@/components/ProUpgradeFlow'
import { SynthesisDialog } from '@/components/SynthesisDialog'
import { RefreshStrategyDialog } from '@/components/RefreshStrategyDialog'
import { KnowledgebaseHeader } from '@/components/KnowledgebaseHeader'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { useDocumentProcessingContext } from '@/components/providers/DocumentProcessingProvider'
import { ExploreNextSection, ExploreItem } from '@/components/ExploreNextSection'
import StrategyDisplay from '@/components/StrategyDisplay'
import { OpportunitySection } from '@/components/OpportunitySection'
import { FragmentExplorer } from '@/components/FragmentExplorer'
import { Launchpad } from '@/components/Launchpad'
import { ImportBundleDialog } from '@/components/ImportBundleDialog'
import { StructuredProvocation, StrategyStatements } from '@/lib/types'

// Debounce utility to prevent rapid-fire refetches (e.g. multiple events in quick succession)
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
  }
  return debounced as T & { cancel: () => void }
}

interface ProjectStats {
  fragmentCount: number
  conversationCount: number
  documentCount: number
  dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }>
  strategyIsStale: boolean
  fragmentsSinceStrategy: number
  fragmentsSinceSummary: number
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
  firstMessageContent: string | null
  originType: string | null
  originText: string | null
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
  isDemo?: boolean
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
  const { hasActiveGeneration, isRunning, getProgressLabel } = useGenerationStatusContext()
  const { isProcessing: isProcessingDocuments, processingCount } = useDocumentProcessingContext()
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
  const [chatOrigin, setChatOrigin] = useState<{ type: string; text: string } | undefined>()
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  // Expand/collapse state for sections
  const [showAllInputs, setShowAllInputs] = useState(false)
  const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
  const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)
  const [synthesisDialogOpen, setSynthesisDialogOpen] = useState(false)
  const [refreshStrategyDialogOpen, setRefreshStrategyDialogOpen] = useState(false)
  const [chatsActiveTab, setChatsActiveTab] = useState<string | undefined>(undefined)
  // Main tab state (persisted per project)
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`project-${projectId}-tab`)
      // Migrate old three-tab values
      if (stored === 'direction' || stored === 'action') return 'decision-stack'
      if (stored === 'knowledge') return 'knowledgebase'
      return stored || 'decision-stack'
    }
    return 'decision-stack'
  })

  useEffect(() => {
    localStorage.setItem(`project-${projectId}-tab`, activeTab)
  }, [activeTab, projectId])
  // Fragment explorer state
  const [fragmentExplorerOpen, setFragmentExplorerOpen] = useState(false)
  const [fragmentExplorerDimension, setFragmentExplorerDimension] = useState<string | undefined>()
  // Strategy data for Direction tab
  const [strategyData, setStrategyData] = useState<{
    strategy: StrategyStatements
    conversationId: string
    traceId: string
  } | null>(null)
  // Opportunity generation state
  const [isGeneratingOpportunities, setIsGeneratingOpportunities] = useState(false)
  const [opportunityCoverageWarnings, setOpportunityCoverageWarnings] = useState<
    { dimension: string; dimensionLabel: string; confidence: string; fragmentCount: number }[]
  >([])
  const [showCoverageWarning, setShowCoverageWarning] = useState(false)
  // Track recent generation to hide "Generate strategy" button while knowledgebase syncs
  const [recentlyGenerated, setRecentlyGenerated] = useState(false)
  // Track if current upload is first content (set when upload starts, cleared on completion)
  const [pendingFirstContentUpload, setPendingFirstContentUpload] = useState(false)

  // Pro upgrade flow for gated features
  const {
    interstitialOpen,
    setInterstitialOpen,
    successOpen,
    setSuccessOpen,
    comingSoonOpen,
    setComingSoonOpen,
    currentFeature,
    triggerUpgrade,
    handleUpgrade,
    handleContinue,
  } = useProUpgradeFlow()

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

  // Debounced fetchProjectData — prevents rapid-fire refetches from multiple events
  const fetchProjectDataRef = useRef<ReturnType<typeof debounce>>()

  // Create debounced version once per projectId
  useEffect(() => {
    fetchProjectDataRef.current = debounce(async () => {
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
    }, 500)

    return () => fetchProjectDataRef.current?.cancel()
  }, [projectId])

  const fetchProjectData = useCallback(() => {
    fetchProjectDataRef.current?.()
  }, [])

  useEffect(() => {
    if (status === 'loading') return

    // Don't redirect to signin - guests can access projects via cookie
    // The API will return 401 if unauthorized
    fetchProjectData()
    fetchDismissals()
  }, [status, projectId])

  // Fetch strategy data when strategyOutputs change
  useEffect(() => {
    const traceId = projectData?.strategyOutputs?.[0]?.id
    if (!traceId) {
      setStrategyData(null)
      return
    }
    fetch(`/api/trace/${traceId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.output) {
          setStrategyData({
            strategy: data.output,
            conversationId: data.conversationId,
            traceId,
          })
        }
      })
      .catch(err => console.error('Failed to fetch strategy:', err))
  }, [projectData?.strategyOutputs])

  // Listen for strategySaved event (fired after extraction starts generation)
  useEffect(() => {
    const handleStrategySaved = () => {
      fetchProjectData()
    }
    window.addEventListener('strategySaved', handleStrategySaved)
    return () => window.removeEventListener('strategySaved', handleStrategySaved)
  }, [])

  // Listen for generationComplete event (fired when strategy generation finishes)
  useEffect(() => {
    const handleGenerationComplete = () => {
      setRecentlyGenerated(true)
      fetchProjectData()
      // Allow button to reappear after a short delay
      const timeout = setTimeout(() => setRecentlyGenerated(false), 5000)
      return () => clearTimeout(timeout)
    }
    window.addEventListener('generationComplete', handleGenerationComplete)
    return () => {
      window.removeEventListener('generationComplete', handleGenerationComplete)
    }
  }, [])

  // Listen for documentProcessed event - open chat if this was first content
  useEffect(() => {
    const handleDocumentProcessed = (event: CustomEvent<{ projectId: string }>) => {
      if (event.detail.projectId !== projectId) return

      fetchProjectData()

      if (pendingFirstContentUpload) {
        setPendingFirstContentUpload(false)
        setChatInitialQuestion("I've got the gist from your document. What would you like to explore?")
        setChatDeepDiveId(undefined)
        setChatGapExploration(undefined)
        setChatResumeConversationId(undefined)
        setChatViewOnly(false)
        setChatSheetOpen(true)
      }
    }
    window.addEventListener('documentProcessed', handleDocumentProcessed as EventListener)
    return () => window.removeEventListener('documentProcessed', handleDocumentProcessed as EventListener)
  }, [projectId, pendingFirstContentUpload])

  // Listen for extractionComplete event (fired when background extraction finishes)
  useEffect(() => {
    const handleExtractionComplete = (event: CustomEvent<{ projectId: string }>) => {
      if (event.detail.projectId !== projectId) return
      fetchProjectData()
    }
    window.addEventListener('extractionComplete', handleExtractionComplete as EventListener)
    return () => window.removeEventListener('extractionComplete', handleExtractionComplete as EventListener)
  }, [projectId, fetchProjectData])

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

  const handleDocumentUploadComplete = async () => {
    // Re-open the deep dive sheet to show the newly processed document
    if (uploadDeepDiveId) {
      setSelectedDeepDiveId(uploadDeepDiveId)
      setDeepDiveSheetOpen(true)
      setUploadDeepDiveId(undefined)
    }
    // Note: fetchProjectData and first-content chat opening are handled
    // by the documentProcessed event listener above
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

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const stats = projectData?.stats || {
    fragmentCount: 0,
    conversationCount: 0,
    documentCount: 0,
    dimensionalCoverage: {},
    strategyIsStale: false,
    fragmentsSinceStrategy: 0,
    fragmentsSinceSummary: 0,
  }

  // Handle opportunity generation
  const handleGenerateOpportunities = async (force = false) => {
    if (!force) {
      // Check coverage from existing syntheses
      const thinDimensions = (projectData?.syntheses || [])
        .filter(s => s.confidence === 'LOW' || s.fragmentCount < 3)
        .map(s => ({
          dimension: s.dimension,
          dimensionLabel: s.dimension.replace(/_/g, ' ').toLowerCase(),
          confidence: s.confidence,
          fragmentCount: s.fragmentCount,
        }))
      if (thinDimensions.length > 0) {
        setOpportunityCoverageWarnings(thinDimensions)
        setShowCoverageWarning(true)
        return
      }
    }

    setShowCoverageWarning(false)
    setIsGeneratingOpportunities(true)
    try {
      const res = await fetch(`/api/project/${projectId}/generate-opportunities`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        // Poll for completion using existing generation status infrastructure
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/generation-status/${data.generationId}`)
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            if (statusData.status === 'complete' || statusData.status === 'failed') {
              clearInterval(pollInterval)
              setIsGeneratingOpportunities(false)
              fetchProjectData()
              // Re-fetch strategy data to get updated opportunities
              const traceId = projectData?.strategyOutputs?.[0]?.id
              if (traceId) {
                const traceRes = await fetch(`/api/trace/${traceId}`)
                if (traceRes.ok) {
                  const traceData = await traceRes.json()
                  if (traceData?.output) {
                    setStrategyData(prev => prev ? { ...prev, strategy: traceData.output } : null)
                  }
                }
              }
            }
          }
        }, 3000)
      }
    } catch (err) {
      console.error('Failed to generate opportunities:', err)
      setIsGeneratingOpportunities(false)
    }
  }

  // Helpers for conversation rendering (used in Knowledge tab)
  const analysedConversations = projectData?.conversations?.filter(
    c => c.status === 'extracted' || c.fragmentCount > 0
  ) || []
  const inProgressConversations = projectData?.conversations?.filter(
    c => c.status === 'in_progress'
  ) || []
  const initialConversationId = projectData?.conversations
    ?.filter(c => !c.deepDiveId && c.status === 'extracted')
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
          className="cursor-pointer hover:bg-muted/50"
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
                  className="bg-muted border border-border rounded-full px-1.5 py-0.5 transition-colors group-hover/item:bg-primary group-hover/item:text-white group-hover/item:border-primary"
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

  const hasStrategy = (projectData?.strategyOutputs?.length ?? 0) > 0
  const opportunityCount = strategyData?.strategy?.opportunities?.length ?? 0

  const isDemo = projectData?.isDemo === true

  return (
    <AppLayout>
      {/* Demo header tint */}
      {isDemo && (
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Example
            </span>
            <span className="text-sm text-muted-foreground">
              {projectData?.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
          >
            &larr; Back to my project
          </Button>
        </div>
      )}
      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="decision-stack">Decision Stack</TabsTrigger>
              <TabsTrigger value="knowledgebase">
                Knowledgebase
                {stats.fragmentCount > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {stats.fragmentCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            {!isDemo && <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  getStatsigClient()?.logEvent('cta_new_chat', 'project-page-header', { projectId })
                  setChatInitialQuestion(undefined)
                  setChatDeepDiveId(undefined)
                  setChatGapExploration(undefined)
                  setChatResumeConversationId(undefined)
                  setChatViewOnly(false)
                  setChatSheetOpen(true)
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Chat
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  getStatsigClient()?.logEvent('cta_upload_doc', 'project-page-header', { projectId })
                  const isFirstContent =
                    (stats.fragmentCount ?? 0) === 0 &&
                    (stats.conversationCount ?? 0) === 0 &&
                    (projectData?.strategyOutputs?.length ?? 0) === 0
                  if (isFirstContent) {
                    setPendingFirstContentUpload(true)
                  }
                  setUploadDeepDiveId(undefined)
                  setUploadDialogOpen(true)
                }}
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </div>}
          </div>

          {/* Decision Stack Tab */}
          <TabsContent value="decision-stack" className="space-y-6">
            {strategyData ? (
              <>
                <StrategyDisplay
                  strategy={strategyData.strategy}
                  conversationId={strategyData.conversationId}
                  traceId={strategyData.traceId}
                  projectId={projectId}
                  onUpdate={isDemo ? undefined : (updated) => {
                    setStrategyData(prev => prev ? { ...prev, strategy: updated } : null)
                  }}
                  readOnly={isDemo}
                />
                <OpportunitySection
                  projectId={projectId}
                  objectives={strategyData.strategy.objectives || []}
                  readOnly={isDemo}
                />
                <Button variant="outline" size="sm" disabled>
                  Export Strategic Brief
                </Button>
              </>
            ) : (
              <Launchpad
                projectId={projectId}
                fragmentCount={stats.fragmentCount ?? 0}
                onStartChat={() => {
                  setChatInitialQuestion(undefined)
                  setChatDeepDiveId(undefined)
                  setChatGapExploration(undefined)
                  setChatResumeConversationId(undefined)
                  setChatViewOnly(false)
                  setChatSheetOpen(true)
                }}
                onImportBundle={() => setImportDialogOpen(true)}
                onGenerateNow={stats.fragmentCount > 0 ? () => setRefreshStrategyDialogOpen(true) : undefined}
              />
            )}
            {isRunning(projectId, 'generation') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {getProgressLabel(projectId) || 'Drafting strategy...'}
              </div>
            )}
            {isRunning(projectId, 'refresh') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {getProgressLabel(projectId) || 'Refreshing strategy...'}
              </div>
            )}
          </TabsContent>

          {/* Knowledgebase Tab */}
          <TabsContent value="knowledgebase" className="space-y-6">
            {/* Empty state when no content at all */}
            {(stats.fragmentCount ?? 0) === 0 && (stats.conversationCount ?? 0) === 0 && (projectData?.documents?.length ?? 0) === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Your knowledgebase is empty.</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Upload documents, have a conversation, or import a context bundle.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => {
                    setUploadDeepDiveId(undefined)
                    setUploadDialogOpen(true)
                  }}>Upload docs</Button>
                  <Button variant="outline" onClick={() => {
                    setChatInitialQuestion(undefined)
                    setChatDeepDiveId(undefined)
                    setChatGapExploration(undefined)
                    setChatResumeConversationId(undefined)
                    setChatViewOnly(false)
                    setChatSheetOpen(true)
                  }}>Start a conversation</Button>
                </div>
              </div>
            ) : (
            <>
            {/* Generate actions bar */}
            {hasStrategy && !isDemo && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRefreshStrategyDialogOpen(true)}
                >
                  Regenerate Direction
                </Button>
                {!isGeneratingOpportunities && !showCoverageWarning && (
                  <Button size="sm" variant="outline" onClick={() => handleGenerateOpportunities()}>
                    Generate Opportunities
                  </Button>
                )}
                {isGeneratingOpportunities && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating opportunities...
                  </span>
                )}
              </div>
            )}

            {/* Coverage warning (from opportunity generation) */}
            {showCoverageWarning && opportunityCoverageWarnings.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">
                    Your direction could use more depth in these areas:
                  </p>
                  {opportunityCoverageWarnings.map(d => (
                    <div key={d.dimension} className="flex items-center gap-2 text-sm mb-1">
                      <span className="capitalize">{d.dimensionLabel}</span>
                      <span className="text-muted-foreground">{d.fragmentCount} fragments</span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setShowCoverageWarning(false)}>
                      Dismiss
                    </Button>
                    <Button size="sm" onClick={() => handleGenerateOpportunities(true)}>
                      Generate anyway
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Dimensional Coverage */}
            <KnowledgebaseHeader
              fragmentCount={stats.fragmentCount}
              chatCount={stats.conversationCount}
              documentCount={stats.documentCount}
              strategyIsStale={stats.strategyIsStale}
              fragmentsSinceStrategy={stats.fragmentsSinceStrategy}
              fragmentsSinceSummary={stats.fragmentsSinceSummary}
              knowledgeUpdatedAt={projectData?.knowledgeUpdatedAt || null}
              knowledgeSummary={projectData?.knowledgeSummary || null}
              dimensionalCoverage={stats.dimensionalCoverage}
              syntheses={projectData?.syntheses || []}
              latestStrategyTraceId={projectData?.strategyOutputs?.[0]?.id || null}
              onRefreshClick={() => setRefreshStrategyDialogOpen(true)}
              onChatClick={() => triggerUpgrade('knowledge-chat')}
              onEditClick={() => triggerUpgrade('knowledge-edit')}
              onDimensionClick={(dimension?: string) => {
                setFragmentExplorerDimension(dimension)
                setFragmentExplorerOpen(true)
              }}
              knowledgeBusyMessage={
                isRunning(projectId, 'extraction') ? 'processing insights...'
                : recentlyGenerated && !hasActiveGeneration(projectId) ? 'updating...'
                : isProcessingDocuments(projectId) ? `processing ${processingCount(projectId) > 1 ? `${processingCount(projectId)} documents` : 'document'}...`
                : null
              }
              strategyBusyMessage={
                isRunning(projectId, 'generation') ? (getProgressLabel(projectId) || 'drafting strategy...')
                : isRunning(projectId, 'refresh') ? (getProgressLabel(projectId) || 'refreshing strategy...')
                : null
              }
            />

            {/* Fragment Explorer (inline, toggled by dimension click or "View all") */}
            {fragmentExplorerOpen && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Fragments</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFragmentExplorerOpen(false)
                      setFragmentExplorerDimension(undefined)
                    }}
                  >
                    Close
                  </Button>
                </div>
                <FragmentExplorer
                  projectId={projectId}
                  initialDimensionFilter={fragmentExplorerDimension}
                  onResumeConversation={(convId) => {
                    setChatResumeConversationId(convId)
                    setChatSheetOpen(true)
                  }}
                />
              </div>
            )}
            {!fragmentExplorerOpen && stats.fragmentCount > 0 && (
              <Button
                variant="link"
                size="sm"
                className="text-xs px-0"
                onClick={() => {
                  setFragmentExplorerDimension(undefined)
                  setFragmentExplorerOpen(true)
                }}
              >
                View all {stats.fragmentCount} fragments
              </Button>
            )}

            {/* Explore Next */}
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
                  // Prefer originText match (new conversations), fall back to firstMessageContent (legacy)
                  const existingConvo = projectData?.conversations.find(
                    c => c.status === 'in_progress' && (
                      c.originText === item.description || c.firstMessageContent === item.description
                    )
                  )
                  setChatDeepDiveId(undefined)
                  setChatGapExploration(undefined)
                  setChatOrigin({ type: 'provocation', text: item.description })
                  if (existingConvo) {
                    setChatInitialQuestion(undefined)
                    setChatResumeConversationId(existingConvo.id)
                  } else {
                    setChatInitialQuestion(item.description)
                    setChatResumeConversationId(undefined)
                  }
                  setChatViewOnly(false)
                  setChatSheetOpen(true)
                } else if (item.type === 'gap') {
                  setChatDeepDiveId(undefined)
                  setChatInitialQuestion(undefined)
                  setChatOrigin({ type: 'gap', text: item.description })
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

            {/* Conversations & Documents side by side */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Conversations */}
              <Card data-section="chats">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    Chats
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {projectData?.conversations && projectData.conversations.length > 0 ? (
                    <Tabs
                      value={chatsActiveTab ?? (inProgressConversations.length > 0 ? 'in-progress' : 'analysed')}
                      onValueChange={setChatsActiveTab}
                      className="h-full"
                    >
                      <div className="border-b px-4">
                        <TabsList className="h-10 bg-transparent p-0 gap-4">
                          <TabsTrigger
                            value="analysed"
                            className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                          >
                            Analysed
                            {analysedConversations.length > 0 && (
                              <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-primary/15 text-primary flex items-center justify-center">
                                {analysedConversations.length}
                              </span>
                            )}
                          </TabsTrigger>
                          <TabsTrigger
                            value="in-progress"
                            className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                          >
                            In Progress
                            {inProgressConversations.length > 0 && (
                              <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-primary/15 text-primary flex items-center justify-center">
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
                  ) : (
                    <div className="text-center py-4 px-6 text-muted-foreground">
                      <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">No conversations yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Documents & Memos
                  </CardTitle>
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
                </CardContent>
              </Card>
            </div>
            </>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        projectId={projectId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleDocumentUploadComplete}
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
            setChatOrigin(undefined)
            fetchProjectData()
          }
        }}
        initialQuestion={chatInitialQuestion}
        deepDiveId={chatDeepDiveId}
        gapExploration={chatGapExploration}
        resumeConversationId={chatResumeConversationId}
        hasExistingStrategy={(projectData?.strategyOutputs?.length ?? 0) > 0}
        hasKnowledgebaseContent={(stats.fragmentCount ?? 0) > 0}
        viewOnly={chatViewOnly}
        origin={chatOrigin}
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

      {/* Synthesis Dialog */}
      <SynthesisDialog
        projectId={projectId}
        open={synthesisDialogOpen}
        onOpenChange={setSynthesisDialogOpen}
        onComplete={fetchProjectData}
      />

      {/* Import Bundle Dialog */}
      <ImportBundleDialog
        projectId={projectId}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => fetchProjectData()}
      />

      {/* Refresh Strategy Dialog */}
      <RefreshStrategyDialog
        projectId={projectId}
        open={refreshStrategyDialogOpen}
        onOpenChange={setRefreshStrategyDialogOpen}
        onStarted={() => {
          setRefreshStrategyDialogOpen(false)
        }}
      />

      {/* Pro Upgrade Flow Dialogs */}
      <ProFeatureInterstitial
        feature={currentFeature}
        open={interstitialOpen}
        onOpenChange={setInterstitialOpen}
        onUpgrade={handleUpgrade}
      />
      <UpgradeSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        onContinue={handleContinue}
      />
      <ProComingSoonDialog
        feature={currentFeature}
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
      />
    </AppLayout>
  )
}
