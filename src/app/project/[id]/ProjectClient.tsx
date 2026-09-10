'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  MessageSquare,
  Upload,
  Loader2,
  Star,
  CornerDownRight,
  Package,
  Plus,
  X,
  ArrowRight,
  Share2,
  Download,
  Clock,
  MoreHorizontal,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useHeaderTabNav } from '@/components/HeaderContext'
import { cn } from '@/lib/utils'
import type { SupportLevel } from '@/lib/support/dimension-support'
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
import { ExploreNextSection, ExploreItem } from '@/components/ExploreNextSection'
import StrategyDisplay from '@/components/StrategyDisplay'
import { OpportunitySection } from '@/components/OpportunitySection'
import { Launchpad } from '@/components/Launchpad'
import { useStrategyReady } from '@/components/providers/useStrategyReady'
import { useDismissed } from '@/components/providers/useDismissed'
import { GroundTruthReviewScreen } from '@/components/ground-truth/GroundTruthReviewScreen'
import { StatusBanner } from '@/components/StatusBanner'
import { ImportBundleDialog } from '@/components/ImportBundleDialog'
import { VersionHistorySheet } from '@/components/VersionHistorySheet'
import { ShareDialog } from '@/components/ShareDialog'
import { SignInGateDialog } from '@/components/SignInGateDialog'
import { StructuredProvocation, StrategyStatements } from '@/lib/types'
import { DEMO_META, DEMO_EPISODE_URLS } from '@/lib/demos'
import { ProjectTabNav } from './ProjectTabNav'
import type { ProjectMode } from '@/lib/navigation/resolve-mode'
import { writeModeCookie } from '@/lib/navigation/mode-cookie'
import { writeLastProjectCookie } from '@/lib/navigation/last-project-cookie'

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
  /** Context bundles imported — derived from distinct capture timestamps, see the API route. */
  importCount: number
  dimensionalCoverage: Record<string, { fragmentCount: number; support: SupportLevel }>
  strategyIsStale: boolean
  fragmentsSinceStrategy: number
  fragmentsSinceSummary: number
  strategySync?: {
    version: number | null
    added: number
    removed: number
    comparable: boolean
    builtAt: string | null
    addedIds: string[]
    removedIds: string[]
  }
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

/** One first look per project. Lives here because the page owns when it is over. */
const GROUND_TRUTH_REVIEW_ITEM_TYPE = 'ground_truth_review'

interface ProjectClientProps {
  projectId: string
  /**
   * Resolved by the server before render (`page.tsx` → `resolveProjectMode`). Never absent: a bare
   * `/project/[id]` is redirected to one of these rather than rendered.
   */
  mode: ProjectMode
}

export default function ProjectClient({ projectId, mode }: ProjectClientProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { hasActiveTasks, isRunning, getProgressLabel, startTask, runningCount } = useGenerationStatusContext()
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareSignInGateOpen, setShareSignInGateOpen] = useState(false)
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())
  const searchParams = useSearchParams()
  /**
   * `?evidence=1` outlived the sheet it used to open.
   *
   * The ground truths live in the Knowledge Summary now, so there is nothing to open — but the
   * param is load-bearing for links we do not control: `/project/[id]/fragments` redirects into
   * it for the book, the marketing site and old bookmarks. So it keeps its MEANING — "take me to
   * what was extracted" — and lands on the Knowledgebase, then clears itself.
   */

  // Expand/collapse state for sections
  const [showAllInputs, setShowAllInputs] = useState(false)
  const [addDeepDiveOpen, setAddDeepDiveOpen] = useState(false)
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState<string | null>(null)
  const [deepDiveSheetOpen, setDeepDiveSheetOpen] = useState(false)
  const [synthesisDialogOpen, setSynthesisDialogOpen] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [generationDialogAction, setGenerationDialogAction] = useState<GenerationAction>('refresh')
  const [chatsActiveTab, setChatsActiveTab] = useState<string | undefined>(undefined)
  // Derived state needed by header injection
  const hasStrategy = projectData?.hasStrategy === true || (projectData?.strategyOutputs?.length ?? 0) > 0

  /**
   * ═══ HAS THIS PROJECT BEEN GIVEN ANYTHING? ═══
   *
   * The single question the whole cold start turns on. Any of the three ingest paths counts, and
   * a conversation or a document counts BEFORE extraction has produced a fragment — so a user who
   * has just uploaded something is never left with the place that shows it hidden behind a
   * control that has not appeared yet.
   *
   * ⚠ THIS IS A ONE-WAY DOOR, AND NOT BY OUR DOING. There is no DELETE handler for conversations
   * or documents anywhere in `src/app/api` (the four that exist are deep-dive, project, dismissal
   * and decision-stack content), and fragment discard is soft — `status: active | archived |
   * soft_deleted`. So once any input lands, these counts never return to zero, and "has context"
   * cannot flip back. That is what lets the cold start be a genuine first-run state with no
   * sticky flag to persist. If a delete path is ever added, this comment is the thing that stops
   * being true, and the cold start will start reappearing under people.
   *
   * `undefined` while loading is deliberately treated as "has context": the toggle rendering a
   * beat late is invisible, whereas flashing the cold start at a user who has a full project is
   * not (`projectData` is null on first paint).
   */
  const hasContext = projectData === null
    ? true
    : (projectData.stats?.fragmentCount ?? 0) > 0 ||
      (projectData.stats?.conversationCount ?? 0) > 0 ||
      (projectData.documents?.length ?? 0) > 0

  /**
   * The strategy-ready chip. Owned next to `BackgroundTaskProvider` — the single orchestrator for
   * background-task feedback — and persisted through `UserDismissal`, so it survives a reload and
   * a refresh raises a fresh one.
   */
  const { ready: strategyReady, markSeen: markStrategySeen } = useStrategyReady(
    projectId,
    projectData?.strategyOutputs?.[0]?.id ?? null
  )

  /**
   * Has the user already had their first look at the ground truths on this project?
   *
   * Persisted, not component state — the review screen promises "you can come back to these any
   * time", and a screen that reappears on every load makes that promise false. Keyed on the
   * project, since there is exactly one first look per project.
   */
  const { dismissed: reviewSeen, loaded: reviewSeenLoaded, dismiss: markReviewSeen } =
    useDismissed(projectId, GROUND_TRUTH_REVIEW_ITEM_TYPE, projectId)

  /**
   * ═══ THE MODE COMES FROM THE URL ═══
   *
   * It used to be `useState` with FOUR writers and a hand-written precedence comment, because the
   * ordering had already shipped a bug to preview: `router.replace` remounts the page, the initial
   * state re-read localStorage before the persist effect had flushed, and the `evidence=1` handler
   * had to write localStorage directly to be believed.
   *
   * All four rules now live in `resolveProjectMode`, run on the SERVER before render (`page.tsx`),
   * and arrive here as a prop. There is nothing left to race.
   *
   * ⚠ ONE RULE STAYS ON THE CLIENT, and it is rule 1: an empty project renders the cold start no
   * matter what the URL asks for. The server only consults the table when `?mode` is ABSENT — it
   * deliberately does no database work when a mode is given, because that read would fire on every
   * toggle — so `?mode=knowledge` on an empty project arrives here unchallenged. Deriving it costs
   * nothing and keeps "the knowledgebase is never rendered empty" true by construction rather than
   * by trusting the URL.
   *
   * `review` renders the knowledgebase; the review screen's own render branch decides whether it
   * takes the whole surface (see the first-look branch below).
   */
  const activeTab: 'decision-stack' | 'knowledgebase' =
    !hasContext || mode === 'stack' ? 'decision-stack' : 'knowledgebase'

  /**
   * Change mode by navigating. The cookie is the per-device preference the server reads back when a
   * later visit arrives with no `?mode` at all (`resolveProjectMode` row 4) — it is a hint, never
   * the authority. `review` is never written: it is a moment, not a place to return to.
   */
  const setMode = useCallback((next: ProjectMode) => {
    if (next !== 'review') writeModeCookie(projectId, next)
    const url = new URL(window.location.href)
    url.searchParams.set('mode', next)
    /*
     * ⚠ `push`, NOT `replace`, and that is a decision rather than a default.
     *
     * Every toggle adds a history entry, so back undoes a mode change. That is what a user who just
     * pressed Knowledgebase expects back to do — the alternative silently teleports them out of the
     * project, which is worse for the far more common gesture.
     *
     * It does mean the "back leaves the project" behaviour verified on arrival describes ENTRY only:
     * after N toggles it takes N+1 presses. Correct, and worth stating because the entry evidence
     * reads like a claim about the steady state.
     */
    router.push(url.pathname + url.search, { scroll: false })
  }, [projectId, router])

  /**
   * ═══ DOES THE FIRST LOOK TAKE THE WHOLE SURFACE? ═══
   *
   * Two ways in, and they are deliberately NOT the same rule.
   *
   * `?mode=review` is an ADDRESS. It renders the review whatever the dismissal says — otherwise the
   * address is a lie the first time guidance links a user back to it after they deferred, and an
   * address that silently shows something else is worse than no address at all.
   *
   * `?mode=knowledge` is the DASHBOARD, which yields to a first look that has not happened yet. That
   * branch is gated on `reviewSeenLoaded` and must stay so: `reviewSeen` arrives from a client fetch,
   * so without the gate the dashboard paints and is then yanked away a round-trip later for users who
   * had already dismissed it.
   *
   * ⚠ AND THIS IS WHY THE GATE IS NOT A REDIRECT. A redirect cannot be gated on "the answer has
   * arrived" — it either fires before the dismissals land or fires late and the user watches the
   * jump. The entry decides; the route always renders.
   *
   * The demo fork keeps its exclusion: a demo's ground truths are not the user's to review.
   *
   * ⚠ ONE CONSEQUENCE, ACCEPTED. The review therefore renders at TWO addresses: its own, and
   * `?mode=knowledge` while a first look is still pending. So a user who reaches it by pressing
   * Knowledgebase and bookmarks there gets a URL that shows the dashboard once they have reviewed.
   * Left alone deliberately — the alternative is redirecting `?mode=knowledge` to `?mode=review`,
   * which is the flash-prone redirect this whole gate exists to avoid. The canonical address exists
   * and is what guidance links to; the bookmark degrades to the dashboard, which is where that user
   * was heading anyway.
   */
  /**
   * `?filter=changed` — the address for guidance register row 4, "my stack is behind my knowledge".
   *
   * ⚠ A FILTER, NOT A SCREEN. Row 4 fires on projects that already HAVE a strategy, and
   * `GroundTruthReviewScreen` is first-contact framed — "here are the N ground truths we found",
   * steps ending "Ready for strategy", Build as the primary exit. Sending a v3 user there would be
   * wrong in every one of those particulars. Only row 2, which carries `!hasStrategy` in its trigger,
   * gets the screen. This was already the shipped judgement for the diff itself: "the diff is a
   * filter you can see, not a place you land in" (2026-09-08).
   */
  const initialFilter = searchParams.get('filter') === 'changed' ? 'changed' : null

  const canReview =
    projectData?.isDemo !== true && !hasStrategy && (projectData?.stats?.fragmentCount ?? 0) > 0
  const showReview = canReview && (mode === 'review' || (reviewSeenLoaded && !reviewSeen))

  /**
   * `tab_switch` / `first-context-landed` — the one measure of whether the first-context landing
   * works. It used to fire from the client effect that did the landing; the landing is a server
   * redirect now, and that redirect must NOT log it.
   *
   * ⚠ A SERVER EVENT HERE WOULD MEASURE HOVER, NOT ARRIVAL. `<Link>` prefetches RSC payloads, which
   * executes the server component, which would fire the event for users who never navigated. The
   * number would look excellent and mean nothing.
   *
   * So the redirect appends `?landed=1` and the client logs it once and strips it — the same shape
   * `evidence=1` used, and it inherits that mechanism rather than outliving it.
   */
  const landedParam = searchParams.get('landed') === '1'
  useEffect(() => {
    if (!landedParam) return
    logAndFlush('tab_switch', 'first-context-landed', { projectId })
    const url = new URL(window.location.href)
    url.searchParams.delete('landed')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [landedParam, projectId, router])

  /**
   * Dismissed on LOOKING, not on being near. The chip clears when the Decision Stack tab is the
   * one on screen — which is also why a user who was already sitting on that tab when the
   * strategy lands never sees a chip at all, and should not.
   */
  useEffect(() => {
    if (!strategyReady || activeTab !== 'decision-stack') return
    markStrategySeen()
  }, [strategyReady, activeTab, markStrategySeen])


  // Inject tab nav + demo right slot into header
  const { setTabNav, setRightSlot } = useHeaderTabNav()
  const isDemo = projectData?.isDemo === true

  const isSignedUp = !!session?.user?.id

  /**
   * Remember this project so `/` comes back here rather than to the oldest one.
   *
   * ⚠ NOT FOR DEMOS, and not before `projectData` has loaded — `isDemo` is false while it is
   * undefined, so writing eagerly would record every demo for the one render before the fetch
   * lands, and the demo banner's X pushes `/`. That would send the user straight back into the
   * demo they just closed.
   */
  useEffect(() => {
    if (!projectData || isDemo) return
    writeLastProjectCookie(projectId)
  }, [projectData, isDemo, projectId])

  useEffect(() => {
    /**
     * ⚠ NO TOGGLE ON AN EMPTY PROJECT, 2026-09-10.
     *
     * Both halves used to show the same three onboarding cards, so the control offered a choice
     * between one screen and a subset of itself. Before any context exists there is no view to
     * choose between — the cold start belongs to the PROJECT, not to either tab — so the control
     * does not render at all. The overflow "Add Context" menu goes with it: the three cards on
     * screen already are that menu, spelled out.
     */
    if (!hasContext) {
      setTabNav(null)
      return
    }
    setTabNav(
      <ProjectTabNav
        projectId={projectId}
        activeTab={activeTab}
        onSelectTab={(tab) => setMode(tab === 'decision-stack' ? 'stack' : 'knowledge')}
        fragmentCount={projectData?.stats?.fragmentCount ?? 0}
        strategyReady={strategyReady}
      />
    )
    return () => setTabNav(null)
    /**
     * ⚠ EVERY VALUE THIS EFFECT READS BELONGS HERE, INCLUDING THE TWO THAT ONLY GATE IT.
     *
     * `strategyReady` and `hasContext` were both missing, and both are read above — the first by
     * the ready chip, the second by the early return that gives an empty project no nav at all.
     * A value read inside an effect but absent from its array does not fail loudly; it works
     * whenever some OTHER dependency happens to change at the same moment, which is why both
     * survived review.
     *
     * `strategyReady` was actively broken: a FIRST generation flips `hasStrategy` alongside it, so
     * the chip appeared; a REFRESH changes nothing else in this array, so it never did — the exact
     * case `useStrategyReady` is keyed on `traceId` to support.
     *
     * `hasContext` was latent, masked by two coincidences: `fragmentCount` going `undefined → 0`
     * when the fetch lands, and the first-context effect calling `setActiveTab`. Both are luck.
     *
     * ⚠ AND `projectData?.stats?.fragmentCount` HAS NO `?? 0` ON PURPOSE. The prop below it does.
     * Here, `undefined → 0` is the change that re-runs this effect when the project loads and
     * removes the nav from an empty project. "Tidying" the two to match would leave an empty
     * project holding a toggle forever.
     *
     * Superseded on `feat/navigation-guidance-map`, where this JSX becomes `<ProjectTabNav />` and
     * props remove the whole failure mode. Fixed here because `development` is the release base.
     */
  }, [activeTab, projectId, projectData?.stats?.fragmentCount, isDemo, hasStrategy, isSignedUp, strategyReady, hasContext, setTabNav])


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
    importCount: 0,
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
      <div className="w-full">
        {/* Content — switched by activeTab (tabs + overflow are in header via HeaderContext) */}
        <div className="w-full">
          {/*
            ═══ THE COLD START ═══
            Outside the tab branches, because it is not a tab. A project with no context has no
            toggle in the header and nothing to switch between; this is the whole screen.
          */}
          {!hasContext && !isDemo && (
            <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
              <Launchpad
                onStartChat={() => {
                  logAndFlush('cta_new_chat', 'launchpad', { projectId })
                  setChatInitialQuestion(undefined)
                  setChatDeepDiveId(undefined)
                  setChatGapExploration(undefined)
                  setChatResumeConversationId(undefined)
                  setChatViewOnly(false)
                  setChatSheetOpen(true)
                }}
                onUploadDocument={() => {
                  logAndFlush('cta_upload_doc', 'launchpad', { projectId })
                  setUploadDeepDiveId(undefined)
                  setUploadDialogOpen(true)
                }}
                onImportBundle={() => {
                  logAndFlush('cta_import_bundle', 'launchpad', { projectId })
                  setImportDialogOpen(true)
                }}
              />
            </div>
          )}

          {/* Decision Stack */}
          {hasContext && activeTab === 'decision-stack' && <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-6">
            {strategyData ? (
              <>
                {/*
                  ═══ MASTHEAD: FRAMEWORK LEFT, SUBJECT CENTRE, VERSION RIGHT ═══

                  Three cells, each answering a different question. Left: what framework is this.
                  Centre: whose stack is it — the demo company's mark, and deliberately nothing on
                  your own project, because you know whose it is. Right: which version, and what
                  you can do with it.

                  The company logo used to sit in its own centred block ABOVE this row, which read
                  as a banner with a toolbar beneath it. In the row it reads as a masthead — and
                  the Decision Stack mark moving left is what makes room, because a centred
                  framework mark and a centred company mark cannot both be the middle of one row.

                  `1fr auto 1fr` keeps the centre cell optically centred whatever the side cells
                  weigh, so a long version label never shunts the company logo off true. The empty
                  centre element holds that column open on a project with no logo.

                  Below `md` it stacks to one centred column: mark, company, actions. The actions
                  carry `order-last` at every breakpoint — they sit second in the DOM so the mark
                  can lead, and without it they would take the centre cell.
                */}
                <div className="grid grid-cols-1 items-center justify-items-center gap-3 text-xs text-muted-foreground md:grid-cols-[1fr_auto_1fr]">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="md:justify-self-start">
                      <img src="/Decision Stack Logo.svg" alt="The Decision Stack" className="h-10" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-64 text-xs space-y-2">
                    <p className="text-muted-foreground">
                      <a href="https://thedecisionstack.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">The Decision Stack</a> by <a href="https://martineriksson.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Martin Eriksson</a>. Used with permission.
                    </p>
                  </PopoverContent>
                </Popover>
                {isDemo && DEMO_META[projectId] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={DEMO_META[projectId].logo} alt={DEMO_META[projectId].name} className="h-14" />
                ) : (
                  <div aria-hidden />
                )}
                <div className="order-last flex flex-wrap items-center justify-center gap-2 md:justify-end md:justify-self-end">
                  {isDemo ? (
                    (() => {
                      const episodeUrl = DEMO_EPISODE_URLS[projectId]
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
                      {/*
                        ═══ THE VERSION CONTROL: A SPLIT PILL, THEN SHARE ═══

                        `Version 3 | ⋯` reads as one object — which version you are looking at, and
                        what you can do about it — with Export and Past versions inside the menu.
                        Share sits apart because it acts on the stack rather than on this version
                        of it: publishing a link is not a thing you do to v3.

                        ⚠ YES, AN OVERFLOW MENU, THE DAY ONE WAS DELETED. The ⋯ removed earlier
                        today was a GLOBAL header menu of ten items, nine of them duplicates of
                        controls that already sat on the objects they acted on. The objection was
                        never "menus"; it was a contextual control with its object taken away. This
                        one is attached to the object, holds only things that act on it, and holds
                        no item that has another door. That is the same principle arriving at a
                        different answer, not a reversal of it.

                        The version label is not a button. It names what the menu acts on, and
                        making it a second way to open Past versions would rebuild the duplicate
                        door removed a commit ago.
                      */}
                      <div className="flex items-center rounded-lg border border-input bg-background">
                        <span className="px-3 py-1.5 text-sm font-medium tabular-nums text-foreground">
                          Version {(projectData as any)?.latestSnapshotVersion || projectData?.strategyOutputs?.[0]?.version || 1}
                        </span>
                        {hasStrategy && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label="Version actions"
                                className="border-l border-input px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={async () => {
                                  logAndFlush('cta_export_brief', 'version-menu', { projectId })
                                  const res = await fetch(`/api/project/${projectId}/export-brief`)
                                  if (res.ok) {
                                    const blob = await res.blob(); const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a'); a.href = url; a.download = 'strategic-brief.md'; a.click(); URL.revokeObjectURL(url)
                                  }
                                }}
                              >
                                <Download className="h-4 w-4" />
                                Export
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  logAndFlush('cta_version_history', 'version-menu', { projectId })
                                  setVersionHistoryOpen(true)
                                }}
                              >
                                <Clock className="h-4 w-4" />
                                Past versions
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {hasStrategy && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            logAndFlush('cta_share', isSignedUp ? 'signed_up' : 'guest', { projectId })
                            if (isSignedUp) { setShareDialogOpen(true) } else { setShareSignInGateOpen(true) }
                          }}
                          className="gap-1.5 rounded-lg px-3 text-sm shadow-none [&_svg]:size-3.5"
                        >
                          <Share2 />
                          Share
                        </Button>
                      )}
                    </>
                  )}
                </div>
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
                  opportunityRefreshKey={opportunityRefreshKey}
                />
              </>
            ) : (
              /*
                ═══ CONTEXT, BUT NO STRATEGY YET ═══
                NOT the launchpad. Every way of adding context now lives in the knowledgebase, so
                re-offering the three doors here would be a third copy of the thing this design
                removed — and the ground-truth review, which used to sit above them, has moved to
                the knowledgebase where the ground truths already are.

                ⚠ NO `Steps` CHROME HERE, deliberately. A phase locator on both halves of a toggle
                has to claim which step each half is, and pre-strategy there is no honest answer:
                this tab is the doorway to step 3, reached by someone who has not finished step 2.
                An indicator that advances when you switch tabs, without you doing any work, lies.

                What is left is a signpost: name the absent thing so the tab reads as EMPTY rather
                than BROKEN, and give the two exits.
              */
              <div className="mx-auto max-w-xl py-12 text-center space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Your Decision Stack goes here</h2>
                <p className="text-muted-foreground">
                  Vision, strategy and objectives, built from the {stats.fragmentCount > 0 ? `${stats.fragmentCount} ` : ''}
                  ground truths in your knowledgebase. Nothing is built yet.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {stats.fragmentCount > 0 && (
                    <Button onClick={handleGenerateStrategy}>
                      Build my strategy
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      logAndFlush('tab_switch', 'pre-strategy-add-context', { projectId })
                      setMode('knowledge')
                    }}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add more context
                  </Button>
                </div>
              </div>
            )}
          </div>}

          {/* Knowledgebase */}
          {/*
            ⚠ `hasContext` GATES THIS TOO, not just the toggle. Rule 1 forces the tab in an effect,
            so the very first render of a project with a stale stored `'knowledgebase'` would
            otherwise paint this branch once before the effect runs — and its empty state is gone.
            Belt and braces on purpose: the invariant is "the knowledgebase is never rendered
            empty", and an invariant that depends on effect ordering is not one.
          */}
          {hasContext && activeTab === 'knowledgebase' && <div>
            {/*
              ═══ FIRST LOOK REPLACES THE DASHBOARD ═══
              Fragments exist, no strategy does, and the user has not yet said they have looked.
              The knowledgebase renders ONLY this — the summary, chats, documents and integrations
              all wait. A first-time user meeting a four-card dashboard has no way to tell that the
              thing that matters is the list in one quadrant of it.

              `reviewSeenLoaded` gates the whole branch so the dashboard never flashes up and get
              replaced a beat later by a screen the user had already dismissed.
            */}
            {showReview ? (
              <GroundTruthReviewScreen
                projectId={projectId}
                fragmentCount={stats.fragmentCount ?? 0}
                onBuild={handleGenerateStrategy}
                onStartChat={() => {
                  logAndFlush('cta_new_chat', 'ground-truth-review', { projectId })
                  setChatInitialQuestion(undefined)
                  setChatDeepDiveId(undefined)
                  setChatGapExploration(undefined)
                  setChatResumeConversationId(undefined)
                  setChatViewOnly(false)
                  setChatSheetOpen(true)
                }}
                onUploadDocument={() => {
                  logAndFlush('cta_upload_doc', 'ground-truth-review', { projectId })
                  setUploadDeepDiveId(undefined)
                  setUploadDialogOpen(true)
                }}
                onImportBundle={() => {
                  logAndFlush('cta_import_bundle', 'ground-truth-review', { projectId })
                  setImportDialogOpen(true)
                }}
                onDefer={() => {
                  // Recorded, unlike its deleted predecessor. "Did anyone actually read this?" is
                  // the question this screen exists to be judged on, and deferring is the answer
                  // "not now" — which is data, not an absence of it.
                  logAndFlush('review_deferred', 'ground-truth-review', {
                    projectId,
                    fragmentCount: String(stats.fragmentCount ?? 0),
                  })
                  markReviewSeen()
                  /*
                   * ⚠ AND LEAVE THE ADDRESS. `?mode=review` renders the review regardless of the
                   * dismissal — that is what makes it a real address rather than a redirect that
                   * sometimes works. Which means dismissing while standing ON it changes nothing
                   * the user can see: the screen would sit there having just been told to go away.
                   * The mode has to move too.
                   */
                  if (mode === 'review') setMode('knowledge')
                }}
              />
            ) : isDemo ? (
            <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-6">
            {/*
              ⚠ `FragmentExplorer` WAS HERE, AND IT WAS A SECOND INTERFACE ONTO THE SAME LIST
              (removed 2026-09-10). The panel below suppressed its own ground truths whenever
              `readOnly` was set, so the demos had nothing to show and an older browser — search
              box, dimension dropdown, its own archive controls — was rendered beside it to fill
              the gap. Visitors met the legacy surface; everyone else met this one.

              `readOnly` now means "no controls that change it" rather than "no list", so the panel
              shows the same ground truths here as anywhere else. Passing `projectId` is what turns
              the coverage balls into filters over that list instead of dead links.

              This is the shop window. It should show the real thing.
            */}
            <KnowledgeSummaryPanel
              projectId={projectId}
              fragmentCount={stats.fragmentCount}
              /*
               * ⚠ THE IMPORT IS REAL; THE OTHER TWO ARE PINNED, AND THE ASYMMETRY IS DELIBERATE.
               *
               * Every ground truth in a demo came from one context bundle, and `importCount`
               * renders only when non-zero — so the single true fact about where this material came
               * from was the one the header suppressed while dutifully reporting two zeros.
               *
               * Chats and documents stay at 0 rather than reading `stats`, because the counts there
               * are RESIDUE and they DISAGREE ACROSS ENVIRONMENTS: conversations predate these
               * fixtures, the bundle format does not carry conversations, so a restore never
               * touches them. Ferrari currently has 3 in dev and 0 in preview and prod. Wiring the
               * real value would make a demo's header say something different depending on which
               * environment you opened it in, for rows this page does not render a section for and
               * offers no way to reach.
               *
               * If conversations ever become part of what a demo demonstrates, they belong in the
               * bundle first — and then this can read `stats` like everywhere else.
               */
              chatCount={0}
              importCount={stats.importCount}
              documentCount={0}
              strategyIsStale={false}
              fragmentsSinceStrategy={0}
              fragmentsSinceSummary={0}
              knowledgeUpdatedAt={null}
              knowledgeSummary={projectData?.knowledgeSummary || null}
              dimensionalCoverage={stats.dimensionalCoverage}
              latestStrategyTraceId={null}
              onRefreshClick={() => {}}
              onDimensionClick={() => {}}
              knowledgeBusyMessage={null}
              strategyBusyMessage={null}
              readOnly
              /* The only thing on a demo's knowledgebase — collapsed, it is a blank page. */
              defaultExpanded
            />
            </div>
            ) : (
            /*
              ⚠ THE "YOUR KNOWLEDGEBASE IS EMPTY" BRANCH WAS DELETED HERE, 2026-09-10.
              It showed the same three onboarding cards as the launchpad, so the toggle above it
              offered a choice between one screen and a subset of itself. It is also unreachable
              now: with no context the toggle does not render and the tab is forced to
              decision-stack, and "has context" cannot flip back (see `hasContext`).

              It was redundant twice over regardless — the sections below already handle zero of
              everything, each with its own empty state and its own add button: Conversations
              ("No conversations yet" + New), Documents ("No documents yet" + Upload), and
              Integrations (+ Import context).

              ⚠ AND A MEASURED SURFACE GOES TO ZERO ON PURPOSE. `cta_new_chat`, `cta_upload_doc`
              and `cta_import_bundle` will stop emitting `surface: 'kb-empty-state'` from today.
              That instrumentation was added on 2026-09-09, one day before this. Recorded loudly
              because 2.7.1 exists on account of exactly this shape: upload was dropped from the
              launchpad by defocus in March 2026, its event kept firing from other surfaces and
              simply flatlined, no commit said "removed", and nobody noticed for six months. The
              cards are not gone — they consolidate onto the single `launchpad` surface.
            */
            <>
            {/* The summary and the ground truths it is drawn from — full-viewport-width band */}
            <div className="bg-primary py-8">
            <div className="mx-auto max-w-7xl px-4 md:px-6">
            {/* One child since the evidence card went — a two-column grid would strand it in half the width. */}
            <div>
            <KnowledgeSummaryPanel
              fragmentCount={stats.fragmentCount}
              chatCount={stats.conversationCount}
              importCount={stats.importCount}
              documentCount={stats.documentCount}
              strategyIsStale={stats.strategyIsStale}
              fragmentsSinceStrategy={stats.fragmentsSinceStrategy}
              fragmentsSinceSummary={stats.fragmentsSinceSummary}
              knowledgeUpdatedAt={projectData?.knowledgeUpdatedAt || null}
              knowledgeSummary={projectData?.knowledgeSummary || null}
              dimensionalCoverage={stats.dimensionalCoverage}
              latestStrategyTraceId={projectData?.strategyOutputs?.[0]?.id || null}
              strategySync={stats.strategySync}
              onOpenStrategy={() => {
                logAndFlush('tab_switch', 'sync-version', { projectId })
                setMode('stack')
              }}
              onRefreshClick={() => {
                if (hasStrategy) {
                  { setGenerationDialogAction('refresh'); setGenerationDialogOpen(true) }
                } else {
                  handleGenerateStrategy()
                }
              }}
              // Unreachable while `projectId` is set — the panel filters in place and only falls
              // back to this when it cannot. Kept honest rather than thrown away.
              onDimensionClick={() => setMode('knowledge')}
              knowledgeBusyMessage={
                isRunning(projectId, 'extraction') ? 'processing insights...'
                : recentlyGenerated && !hasActiveTasks(projectId) ? 'updating...'
                : isRunning(projectId, 'document') ? `reading ${runningCount(projectId, 'document') > 1 ? `${runningCount(projectId, 'document')} documents` : 'document'}...`
                : null
              }
              strategyBusyMessage={
                isRunning(projectId, 'generation') ? (getProgressLabel(projectId) || 'drafting strategy...')
                : null
              }
              // With these set the panel shows the ground truths in place, and `onDimensionClick`
              // above becomes the fallback it now only takes in demo mode.
              projectId={projectId}
              initialFilter={initialFilter}
              onResumeConversation={(convId: string) => {
                setChatResumeConversationId(convId)
                setChatViewOnly(false)
                setChatSheetOpen(true)
              }}
            />
            </div>
            </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-6">
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
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                        // ⚠ THIS SURFACE WAS UNMEASURED UNTIL 2026-09-10. The card headers are the
                        // PERMANENT doors — launchpad and ground-truth-review are both first-run —
                        // so without this the event only ever fired for new projects, and deleting
                        // the overflow menu would have read as users abandoning chat.
                        logAndFlush('cta_new_chat', 'chats-card', { projectId })
                        setChatInitialQuestion(undefined)
                        setChatDeepDiveId(undefined)
                        setChatGapExploration(undefined)
                        setChatResumeConversationId(undefined)
                        setChatViewOnly(false)
                        setChatSheetOpen(true)
                      }}>
                        <Plus className="h-3 w-3" />
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
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                        // The permanent upload door — see the note on the Chats card above.
                        logAndFlush('cta_upload_doc', 'documents-card', { projectId })
                        setUploadDeepDiveId(undefined)
                        setUploadDialogOpen(true)
                      }}>
                        <Plus className="h-3 w-3" />
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
                                      ? `${doc.fragmentCount} ground truth${doc.fragmentCount === 1 ? '' : 's'}`
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
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => {
                        // The permanent import door — see the note on the Chats card above.
                        logAndFlush('cta_import_bundle', 'integrations-card', { projectId })
                        setImportDialogOpen(true)
                      }}>
                        <Plus className="h-3 w-3" />
                        Import context
                      </Button>
                    </div>
                  </CardHeader>
                  {/*
                    ⚠ NO EXPLAINER. This card read as an advert in the shape of chrome: a
                    paragraph selling the capability, above three logos greyed out as though
                    disabled, above a link. The card already has its action — Import context, in
                    the header, where every other card on this tab keeps its action.

                    So the logos do the explaining. At full colour they say "these work" without a
                    sentence claiming it, and they carry the link out for anyone who wants the
                    detail. Greyscale was saying the opposite of what the card meant.
                  */}
                  <CardContent className="space-y-4 pt-0">
                    <a
                      href="https://lunastak.io/docs/install"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-10 rounded-md py-6 transition-opacity hover:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-claude.svg" alt="Claude" className="h-16" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-gemini.svg" alt="Gemini" className="h-16" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-openai.svg" alt="OpenAI" className="h-16" />
                    </a>
                    <a
                      href="https://lunastak.io/docs/install"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      Installation guide &rarr;
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>
            </div>
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

      {/* Share Dialog (signed-up users) + sign-in gate (guests) */}
      <ShareDialog
        projectId={projectId}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
      <SignInGateDialog
        open={shareSignInGateOpen}
        onOpenChange={setShareSignInGateOpen}
        title="Create an Account to Share"
        description="To share a read-only link to your Decision Stack, you'll need a free account. This keeps your share link tied to you so you can turn it off anytime."
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
