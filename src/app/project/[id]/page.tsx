'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  MessageSquare,
  Upload,
  Loader2,
  Star,
  CornerDownRight,
  MoreHorizontal,
  RefreshCw,
  Target,
  Download,
  Clock,
  Package,
  Plus,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useHeaderTabNav } from '@/components/HeaderContext'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  useProUpgradeFlow,
  ProFeatureInterstitial,
  UpgradeSuccessDialog,
  ProComingSoonDialog,
} from '@/components/ProUpgradeFlow'
import { SynthesisDialog } from '@/components/SynthesisDialog'
import { GenerationConfirmDialog, type GenerationAction } from '@/components/GenerationConfirmDialog'
import { KnowledgeSummaryPanel } from '@/components/KnowledgeSummaryPanel'
import { useGenerationStatusContext } from '@/components/providers/BackgroundTaskProvider'
import { useDocumentProcessingContext } from '@/components/providers/DocumentProcessingProvider'
import { ExploreNextSection, ExploreItem } from '@/components/ExploreNextSection'
import StrategyDisplay from '@/components/StrategyDisplay'
import { OpportunitySection } from '@/components/OpportunitySection'
import { Launchpad, TalkToLunaCard, ImportBundleCard } from '@/components/Launchpad'
import { StatusBanner } from '@/components/StatusBanner'
import { ImportBundleDialog } from '@/components/ImportBundleDialog'
import { VersionHistorySheet } from '@/components/VersionHistorySheet'
import { FragmentExplorer } from '@/components/FragmentExplorer'
import { StructuredProvocation, StrategyStatements } from '@/lib/types'

// Demo project metadata
const DEMO_META: Record<string, { name: string; logo: string }> = {
  'cmn8anetr5kwlmbmq': { name: 'Nike', logo: '/logo-nike.svg' },
  'cmn8an6ivpa0xoehj': { name: 'Costco', logo: '/logo-costco.svg' },
  'cmn8anbaapaww1709': { name: 'TSMC', logo: '/logo-tsmc.svg' },
}

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
  version?: number
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
  hasStrategy?: boolean
  strategyStatements?: StrategyStatements
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
  const { hasActiveTasks, isRunning, getProgressLabel, startTask } = useGenerationStatusContext()
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
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  // Expand/collapse state for sections
  const [showAllInputs, setShowAllInputs] = useState(false)
  const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
  const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)
  const [synthesisDialogOpen, setSynthesisDialogOpen] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [generationDialogAction, setGenerationDialogAction] = useState<GenerationAction>('refresh')
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

  // Derived state needed by header injection
  const hasStrategy = projectData?.hasStrategy === true || (projectData?.strategyOutputs?.length ?? 0) > 0

  // Inject tab nav + demo right slot into header
  const { setTabNav, setRightSlot } = useHeaderTabNav()
  const isDemo = projectData?.isDemo === true

  useEffect(() => {
    setTabNav(
      <div className="inline-flex rounded-lg border border-input">
        <button
          onClick={() => { setActiveTab('decision-stack'); logAndFlush('tab_switch', 'decision-stack', { projectId }) }}
          className={cn(
            'rounded-l-lg px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'decision-stack' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          Decision Stack
        </button>
        <button
          onClick={() => { setActiveTab('knowledgebase'); logAndFlush('tab_switch', 'knowledgebase', { projectId }) }}
          className={cn(
            'border-l border-input px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'knowledgebase' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            isDemo ? 'rounded-r-lg' : ''
          )}
        >
          Knowledgebase
          {(projectData?.stats?.fragmentCount ?? 0) > 0 && (
            <span className="ml-1.5 text-xs opacity-70">{projectData?.stats?.fragmentCount}</span>
          )}
        </button>
        {!isDemo && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="border-l border-input px-3 py-1.5 text-sm hover:bg-muted transition-colors rounded-r-lg"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Add Context</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_new_chat', 'overflow-menu', { projectId })
                setChatInitialQuestion(undefined); setChatDeepDiveId(undefined); setChatGapExploration(undefined)
                setChatResumeConversationId(undefined); setChatViewOnly(false); setChatSheetOpen(true)
              }}>
                <MessageSquare className="h-4 w-4 mr-2" />New Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_upload_doc', 'overflow-menu', { projectId })
                setUploadDeepDiveId(undefined); setUploadDialogOpen(true)
              }}>
                <Upload className="h-4 w-4 mr-2" />Upload Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_import_bundle', 'overflow-menu', { projectId })
                setImportDialogOpen(true)
              }}>
                <Package className="h-4 w-4 mr-2" />Import Context Bundle
              </DropdownMenuItem>
              {(projectData?.stats?.fragmentCount ?? 0) > 0 && (
                <DropdownMenuItem onClick={() => {
                  logAndFlush('cta_view_fragments', 'overflow-menu', { projectId })
                  router.push(`/project/${projectId}/fragments`)
                }}>
                  <FileText className="h-4 w-4 mr-2" />View all {projectData?.stats?.fragmentCount} fragments
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Update Strategy</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!hasStrategy && (projectData?.stats?.fragmentCount ?? 0) === 0}
                onClick={() => {
                  logAndFlush('cta_update_direction', 'overflow-menu', { projectId })
                  if (hasStrategy) { { setGenerationDialogAction('refresh'); setGenerationDialogOpen(true) } } else { handleGenerateStrategy() }
                }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                <div><div>{hasStrategy ? 'Refresh Decision Stack' : 'Generate Decision Stack'}</div>
                  <div className="text-[10px] text-muted-foreground">{hasStrategy ? 'Update V/S/O from latest context' : 'Create your first Decision Stack'}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasStrategy} onClick={() => {
                logAndFlush('cta_draft_opportunities', 'overflow-menu', { projectId })
                { setGenerationDialogAction('opportunities'); setGenerationDialogOpen(true) }
              }}>
                <Target className="h-4 w-4 mr-2" />
                <div><div>Generate Opportunities</div>
                  <div className="text-[10px] text-muted-foreground">{hasStrategy ? 'Create initiatives for your objectives' : 'Generate strategy first'}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Export</DropdownMenuLabel>
              <DropdownMenuItem disabled={!hasStrategy} onClick={async () => {
                logAndFlush('cta_export_brief', 'overflow-menu', { projectId })
                const res = await fetch(`/api/project/${projectId}/export-brief`)
                if (res.ok) {
                  const blob = await res.blob(); const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'strategic-brief.md'; a.click(); URL.revokeObjectURL(url)
                }
              }}>
                <Download className="h-4 w-4 mr-2" />Export Strategic Brief
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_version_history', 'overflow-menu', { projectId })
                setVersionHistoryOpen(true)
              }}>
                <Clock className="h-4 w-4 mr-2" />Version History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Examples</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_view_demo', 'overflow-menu', { projectId: 'cmn8anetr5kwlmbmq', demo: 'Nike' })
                router.push('/project/cmn8anetr5kwlmbmq')
              }}>Nike</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_view_demo', 'overflow-menu', { projectId: 'cmn8an6ivpa0xoehj', demo: 'Costco' })
                router.push('/project/cmn8an6ivpa0xoehj')
              }}>Costco</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                logAndFlush('cta_view_demo', 'overflow-menu', { projectId: 'cmn8anbaapaww1709', demo: 'TSMC' })
                router.push('/project/cmn8anbaapaww1709')
              }}>TSMC</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
    return () => setTabNav(null)
  }, [activeTab, projectId, projectData?.stats?.fragmentCount, isDemo, hasStrategy, setTabNav])


  // Strategy data for Direction tab
  const [strategyData, setStrategyData] = useState<{
    strategy: StrategyStatements
    conversationId: string
    traceId: string
  } | null>(null)
  // Opportunity generation state
  const [opportunityRefreshKey, setOpportunityRefreshKey] = useState(0)
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
    if (!itemContent) return false
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

  // Load strategy data from API response (DecisionStack) or trace fallback
  useEffect(() => {
    // Primary: use strategyStatements from DecisionStack (returned by project API)
    // Only use if it has actual content (vision non-empty), not just a placeholder from setGenerationStatus
    if (projectData?.strategyStatements && projectData.strategyStatements.vision) {
      setStrategyData({
        strategy: projectData.strategyStatements,
        conversationId: projectData.conversations?.[0]?.id || '',
        traceId: projectData.strategyOutputs?.[0]?.id || '',
      })
      return
    }

    // Fallback: fetch from trace (legacy path)
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
  }, [projectData?.strategyStatements, projectData?.strategyOutputs])

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

  const stats = projectData?.stats || {
    fragmentCount: 0,
    conversationCount: 0,
    documentCount: 0,
    dimensionalCoverage: {},
    strategyIsStale: false,
    fragmentsSinceStrategy: 0,
    fragmentsSinceSummary: 0,
  }

  // Handle strategy generation from knowledge (no conversation required)
  const handleGenerateStrategy = async () => {
    try {
      const res = await fetch(`/api/project/${projectId}/generate-strategy`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        startTask('generation', data.generationId, projectId, {
          running: 'Generating your strategy...',
          complete: 'Your strategy is ready',
          failed: 'Strategy generation failed',
          completeDescription: 'Click to view your new strategy.',
          completeAction: (data) => data.traceId
            ? { label: 'View', href: `/strategy/${data.traceId}` }
            : undefined,
        })
      } else {
        const err = await res.json()
        console.error('[GenerateStrategy] Failed:', err.error)
      }
    } catch (error) {
      console.error('[GenerateStrategy] Error:', error)
    }
  }

  // Handle opportunity generation
  const handleGenerateOpportunities = async () => {
    try {
      const res = await fetch(`/api/project/${projectId}/generate-opportunities`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        startTask('generation', data.generationId, projectId, {
          running: 'Drafting opportunities...',
          complete: 'Opportunities ready',
          failed: 'Opportunity generation failed',
          onComplete: () => setOpportunityRefreshKey(k => k + 1),
        })
      } else {
        const err = await res.json()
        console.error('[GenerateOpportunities] Failed:', err.error)
      }
    } catch (err) {
      console.error('[GenerateOpportunities] Error:', err)
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
            <ItemTitle className="text-sm truncate">
              {conv.title || 'Untitled conversation'}
            </ItemTitle>
            <ItemDescription className="text-sm">
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

  const opportunityCount = strategyData?.strategy?.opportunities?.length ?? 0

  return (
    <AppLayout>
      {/* Demo banner */}
      {isDemo && (
        <div className="sticky top-[6.25rem] md:top-14 z-40 bg-[#c74188]/85 backdrop-blur-sm px-6 py-2 flex items-center">
          <button
            onClick={() => {
              logAndFlush('demo_exit', 'banner', { projectId })
              router.push('/')
            }}
            className="text-white/70 hover:text-white transition-colors shrink-0 p-1 -ml-1 rounded-md hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 text-sm">
            <span className="font-bold uppercase tracking-wider text-white/90">Demo</span>
            <span className="text-white/70">{projectData?.name}</span>
          </div>
          <div className="w-6 shrink-0" />
        </div>
      )}
      {/* Status banner for background tasks (non-demo) */}
      {!isDemo && <StatusBanner projectId={projectId} />}
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-8 space-y-6">
        {/* Content — switched by activeTab (tabs + overflow are in header via HeaderContext) */}
        <div className="w-full">
          {/* Decision Stack */}
          {activeTab === 'decision-stack' && <div className="space-y-6">
            {strategyData ? (
              <>
                {/* Demo company logo */}
                {isDemo && DEMO_META[projectId] && (
                  <div className="flex justify-center pt-2 pb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={DEMO_META[projectId].logo} alt={DEMO_META[projectId].name} className="h-20" />
                  </div>
                )}
                {/* Version stamp + Decision Stack branding */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {isDemo ? (
                    (() => {
                      const episodeUrls: Record<string, string> = {
                        'cmn8anetr5kwlmbmq': 'https://www.acquired.fm/episodes/nike',
                        'cmn8an6ivpa0xoehj': 'https://www.acquired.fm/episodes/costco',
                        'cmn8anbaapaww1709': 'https://www.acquired.fm/episodes/tsmc',
                      }
                      const episodeUrl = episodeUrls[projectId]
                      return (
                        <span>
                          Generated from{' '}
                          {episodeUrl ? (
                            <a href={episodeUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                              Acquired podcast
                            </a>
                          ) : 'Acquired podcast'}
                          {' '}transcript
                        </span>
                      )
                    })()
                  ) : (
                    <>
                      <span>
                        v{(projectData as any)?.latestSnapshotVersion || projectData?.strategyOutputs?.[0]?.version || 1}
                      </span>
                      <button
                        onClick={() => setVersionHistoryOpen(true)}
                        className="font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        view past revisions &rarr;
                      </button>
                    </>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button>
                      <img src="/Decision Stack Logo.svg" alt="The Decision Stack" className="h-7" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-64 text-xs space-y-2">
                    <p className="text-muted-foreground">
                      <a href="https://thedecisionstack.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">The Decision Stack</a> by <a href="https://martineriksson.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Martin Eriksson</a>. Used with permission.
                    </p>
                  </PopoverContent>
                </Popover>
                </div>
                <StrategyDisplay
                  strategy={strategyData.strategy}
                  conversationId={strategyData.conversationId}
                  traceId={strategyData.traceId}
                  projectId={projectId}
                  onUpdate={isDemo ? undefined : (updated) => {
                    setStrategyData(prev => prev ? { ...prev, strategy: updated } : null)
                  }}
                  readOnly={isDemo}
                  onDraftOpportunities={!isDemo ? () => { setGenerationDialogAction('opportunities'); setGenerationDialogOpen(true) } : undefined}
                  onImproveWithAI={!isDemo ? () => triggerUpgrade('ai-improve') : undefined}
                  opportunityRefreshKey={opportunityRefreshKey}
                />
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
                onImportBundle={() => { logAndFlush('cta_import_bundle', 'launchpad', { projectId }); setImportDialogOpen(true) }}
                onGenerateNow={stats.fragmentCount > 0 ? handleGenerateStrategy : undefined}
              />
            )}
          </div>}

          {/* Knowledgebase */}
          {activeTab === 'knowledgebase' && <div className="space-y-6">
            {isDemo ? (
            <>
            {/* Demo: simplified KB — coverage grid + inline fragments */}
            <KnowledgeSummaryPanel
              fragmentCount={stats.fragmentCount}
              chatCount={0}
              documentCount={0}
              strategyIsStale={false}
              fragmentsSinceStrategy={0}
              fragmentsSinceSummary={0}
              knowledgeUpdatedAt={null}
              knowledgeSummary={projectData?.knowledgeSummary || null}
              dimensionalCoverage={stats.dimensionalCoverage}
              syntheses={projectData?.syntheses || []}
              latestStrategyTraceId={null}
              onRefreshClick={() => {}}
              onChatClick={() => {}}
              onEditClick={() => {}}
              onDimensionClick={() => {}}
              knowledgeBusyMessage={null}
              strategyBusyMessage={null}
              readOnly
            />
            <FragmentExplorer
              projectId={projectId}
            />
            </>
            ) : (
            <>
            {/* Empty state when no content at all */}
            {(stats.fragmentCount ?? 0) === 0 && (stats.conversationCount ?? 0) === 0 && (projectData?.documents?.length ?? 0) === 0 ? (
              <div className="py-8">
                <p className="text-muted-foreground text-center mb-1">Your knowledgebase is empty.</p>
                <p className="text-sm text-muted-foreground text-center mb-6">Start a conversation with Luna, or import a context bundle to get started.</p>
                <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
                  <TalkToLunaCard onStartChat={() => {
                    setChatInitialQuestion(undefined)
                    setChatDeepDiveId(undefined)
                    setChatGapExploration(undefined)
                    setChatResumeConversationId(undefined)
                    setChatViewOnly(false)
                    setChatSheetOpen(true)
                  }} />
                  <ImportBundleCard onImportBundle={() => { logAndFlush('cta_import_bundle', 'kb-empty-state', { projectId }); setImportDialogOpen(true) }} />
                </div>
              </div>
            ) : (
            <>
            {/* Coverage hero */}
            <KnowledgeSummaryPanel
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
              onRefreshClick={() => {
                if (hasStrategy) {
                  { setGenerationDialogAction('refresh'); setGenerationDialogOpen(true) }
                } else {
                  handleGenerateStrategy()
                }
              }}
              onChatClick={() => triggerUpgrade('knowledge-chat')}
              onEditClick={() => triggerUpgrade('knowledge-edit')}
              onDimensionClick={(dimension?: string) => {
                router.push(`/project/${projectId}/fragments${dimension ? `?dimension=${dimension}` : ''}`)
              }}
              knowledgeBusyMessage={
                isRunning(projectId, 'extraction') ? 'processing insights...'
                : recentlyGenerated && !hasActiveTasks(projectId) ? 'updating...'
                : isProcessingDocuments(projectId) ? `processing ${processingCount(projectId) > 1 ? `${processingCount(projectId)} documents` : 'document'}...`
                : null
              }
              strategyBusyMessage={
                isRunning(projectId, 'generation') ? (getProgressLabel(projectId) || 'drafting strategy...')
                : null
              }
            />

            {/* Explore Next + Conversations side by side */}
            <div className="grid gap-6 md:grid-cols-2">
              <ExploreNextSection
              deepDives={projectData?.deepDives || []}
              provocations={projectData?.suggestedQuestions || []}
              syntheses={projectData?.syntheses || []}
              isItemDismissed={isItemDismissed}
              onDismissItem={dismissItem}
              onItemClick={(item: ExploreItem) => {
                if (item.type === 'deep-dive') {
                  const ddId = item.id.replace('dd-', '')
                  logAndFlush('cta_open_deep_dive', 'explore-next', { projectId })
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

              {/* Conversations */}
              <Card data-section="chats">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" />
                      Chats
                    </CardTitle>
                    {!isDemo && (
                      <Button variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary/80 hover:bg-muted/50" onClick={() => {
                        setChatInitialQuestion(undefined)
                        setChatDeepDiveId(undefined)
                        setChatGapExploration(undefined)
                        setChatResumeConversationId(undefined)
                        setChatViewOnly(false)
                        setChatSheetOpen(true)
                      }}>
                        <Plus className="h-3 w-3 mr-1" />
                        New
                      </Button>
                    )}
                  </div>
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
                            <p className="text-sm">No analysed conversations yet</p>
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
                            <p className="text-sm">No conversations in progress</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="text-center py-4 px-6 text-muted-foreground">
                      <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p className="text-sm">No conversations yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Documents + Import CTA side by side */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Documents */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      Documents
                    </CardTitle>
                    {!isDemo && (
                      <Button variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary/80 hover:bg-muted/50" onClick={() => {
                        setUploadDeepDiveId(undefined)
                        setUploadDialogOpen(true)
                      }}>
                        <Plus className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                    )}
                  </div>
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
                                  <ItemTitle className="text-sm truncate">{doc.fileName}</ItemTitle>
                                  <ItemDescription className="text-sm">
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
                      <p className="text-sm">No documents yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Import CTA */}
              {!isDemo && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-4 w-4" />
                        Integrations
                      </CardTitle>
                      <Button variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary/80 hover:bg-muted/50" onClick={() => setImportDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Import context
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Prepare context in your favourite AI tool, then import it into Luna. Skills and connectors available for all major platforms.
                    </p>
                    <div className="flex items-center justify-center gap-8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-claude.svg" alt="Claude" className="h-10 grayscale opacity-60" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-gemini.svg" alt="Gemini" className="h-10 grayscale opacity-60" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-openai.svg" alt="OpenAI" className="h-10 grayscale opacity-60" />
                    </div>
                    <a href="https://lunastak.io/docs/install" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
                      Installation guide &rarr;
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>
            </>
            )}
            </>
            )}
          </div>}

        </div>
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

      {/* Version History Sheet */}
      <VersionHistorySheet
        projectId={projectId}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        onExportBrief={async (outputId, version) => {
          const res = await fetch(`/api/project/${projectId}/export-brief?outputId=${outputId}`)
          if (res.ok) {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `strategic-brief-v${version}.md`
            a.click()
            URL.revokeObjectURL(url)
          }
        }}
      />

      {/* Import Bundle Dialog */}
      <ImportBundleDialog
        projectId={projectId}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => fetchProjectData()}
      />

      {/* Generation Confirm Dialog (refresh + opportunities) */}
      <GenerationConfirmDialog
        action={generationDialogAction}
        open={generationDialogOpen}
        onOpenChange={setGenerationDialogOpen}
        fragmentsSinceStrategy={stats.fragmentsSinceStrategy}
        isFirstTime={generationDialogAction === 'opportunities' && opportunityCount === 0}
        onConfirm={async () => {
          logAndFlush(`confirm_${generationDialogAction}`, 'generation-dialog', {
            projectId,
            fragmentsSinceStrategy: String(stats.fragmentsSinceStrategy),
          })
          if (generationDialogAction === 'refresh') {
            const res = await fetch(`/api/project/${projectId}/refresh-strategy`, { method: 'POST' })
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Refresh failed') }
            const data = await res.json()
            if (data.status === 'started' && data.generationId) {
              startTask('generation', data.generationId, projectId, {
                running: 'Refreshing strategy...',
                complete: 'Strategy updated',
                failed: 'Strategy refresh failed',
                completeDescription: 'Click to view your updated strategy.',
              })
            }
          } else {
            await handleGenerateOpportunities()
          }
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
