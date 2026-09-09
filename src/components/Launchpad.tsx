'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, ExternalLink, ChevronDown, ArrowRight, Loader2, Plus, FileText } from 'lucide-react'
import { useCallback, useState } from 'react'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import { Steps } from '@/components/ui/steps'
import { logAndFlush } from '@/components/StatsigProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** The user has given context; they are checking it; then it becomes a strategy. */
const GROUND_TRUTH_PHASES = ['Your context', 'Ground truths', 'Your strategy'] as const

/**
 * Fragments exist and no strategy does: the user sees what their strategy will be built from
 * before it is built. Skipping stays available (§4's affirmative skip) — it just is not silent.
 */
function GroundTruthReviewPanel({ projectId, onGenerate, onAddContext }: {
  projectId: string
  onGenerate: () => void
  /** Take the user where every ingest path lives, so "not finished adding" is a real option. */
  onAddContext?: () => void
}) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  /**
   * Pressing Build must LOOK like it did something, immediately.
   *
   * `handleGenerateStrategy` only reports through the background-task toast once the POST
   * resolves — and in the dev server that route awaits the whole run, so the screen sat unchanged
   * for ~37s. A user reasonably concludes nothing happened and presses something else; on
   * 2026-09-08 that produced two generations landing as consecutive versions.
   */
  const [building, setBuilding] = useState(false)
  const build = useCallback(() => {
    if (building) return
    setBuilding(true)
    onGenerate()
  }, [building, onGenerate])
  // Stable identity: the review reports counts from an effect, and an inline arrow here would
  // change on every render and re-fire it. It settles today only because React bails on identical
  // state — which is luck, not design.
  const handleCount = useCallback((r: number, t: number) => { setRemaining(r); setTotal(t) }, [])

  // The whole panel takes the reading measure, not just its contents — a narrow column inside a
  // full-width card read as a mistake rather than a choice.
  return (
    <Card className="mx-auto max-w-3xl overflow-hidden">
      {/* Chrome, not content: the bar sits on the card's top edge and the block is ruled off, so
          the frame says where you are and the content below is only the ground truths. */}
      <Steps steps={GROUND_TRUTH_PHASES} current={1} flush labelsClassName="px-6 md:px-8" />
      <CardContent className="space-y-4 p-6 md:p-8">
        <div>
          {/*
            WHERE AM I, WHAT HAPPENS NEXT, AND WHY BOTHER. Without this the review is a list of
            sentences with no frame: the user has just asked for a strategy and been handed
            something else, with no signal that it is a step rather than the destination, or that
            it is waiting on them.
          */}
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {total === null ? 'Check your ground truths' : `Check your ${total} ground truths`}
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Everything your Decision Stack is built from. Discard any items that are wrong, you
              can restore anytime.
            </p>
          </div>
        </div>

        <GroundTruthReview
          projectId={projectId}
          onCountChange={handleCount}
        />

        <div className="flex flex-wrap items-center gap-4 border-t pt-4">
          <Button onClick={build} disabled={building}>
            {building ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Building your strategy…</>
            ) : (
              <>
                Build my strategy{remaining !== null && total !== null && remaining < total ? ` from ${remaining}` : ''}
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
          {/*
            ⚠ "SKIP THE REVIEW" IS GONE, 2026-09-09, and it lost nothing.
            It called `build()` — the same function as the primary button — logged no event, and
            recorded nothing. `Fragment.reviewedAt` is stamped when rows are PRESENTED, not on the
            choice, so skipping never changed a measurement either. What it actually was: a
            confirm dialog nagging the user out of the thing they had just chosen, whose confirm
            did what the button beside it did. A user engages or they don't; a second button
            claiming to do something different when it doesn't is a lie about the interface.

            Replaced by the move a user genuinely wants here — the review is a standing state, not
            a gate, so "I'm not done adding things yet" is the real third option.
          */}
          {!building && onAddContext && (
            <Button variant="outline" onClick={onAddContext} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add more context
            </Button>
          )}
          {building && (
            <span className="text-xs text-foreground/45">
              This takes about half a minute. You can leave this page.
            </span>
          )}
        </div>
      </CardContent>

    </Card>
  )
}

// --- Shared onboarding cards (used in Launchpad + KB empty state) ---

export function TalkToLunaCard({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div className="cursor-pointer rounded-lg p-6 space-y-3 bg-white shadow-sm hover:shadow-md transition-all" onClick={onStartChat}>
      <h3 className="text-sm font-bold uppercase tracking-wide">
        <span className="bg-[hsl(var(--luna))] text-white px-2 py-0.5">Talk to</span>{' '}
        <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] normal-case">Luna</span>
      </h3>
      {/*
        ⚠ THE JOB FIRST, THEN THE METHOD.
        Both cards used to lead with how they work, so a new user had to infer which one was for
        them from the mechanism. The heading still names the method; the body now names what the
        user is trying to get done.
      */}
      <p className="text-[14px] text-foreground/70 leading-relaxed">
        Start from nothing. One conversation gets you a strategy draft you can build on.
      </p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onStartChat}>
        <MessageSquare className="h-3.5 w-3.5" />
        Start
      </Button>
    </div>
  )
}

/**
 * ⚠ RESTORED 2026-09-09 AFTER SIX MONTHS OFF THE LAUNCHPAD.
 *
 * Upload was quietly dropped from this empty state while narrowing it to two doors, and no
 * document has been uploaded on production since March 2026 as a result. The backend never went
 * anywhere — the route, the extraction path, the context box and the char limit all stayed live —
 * so the whole outage was a missing card.
 *
 * Nothing surfaced it, because a removal-by-defocus leaves no marker: `cta_upload_doc` kept firing
 * from `overflow-menu` and `first-time` and simply flatlined, and nobody looks at a feature no one
 * decided to remove. That is why this card logs its own surface — `kb-empty-state` — so the
 * question "is anyone starting from a document?" has an answer next time without reading the code.
 */
export function UploadDocumentCard({ onUploadDocument }: { onUploadDocument: () => void }) {
  return (
    <div className="cursor-pointer rounded-lg p-6 space-y-3 bg-white shadow-sm hover:shadow-md transition-all" onClick={onUploadDocument}>
      <h3 className="text-sm font-bold uppercase tracking-wide">
        <span className="bg-[hsl(var(--luna))] text-white px-2 py-0.5">Upload</span>{' '}
        <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] normal-case">a document</span>
      </h3>
      {/* The job, not the mechanism — same rule as the two cards either side. */}
      <p className="text-[14px] text-foreground/70 leading-relaxed">
        Already written it down? A strategy deck, board paper or research notes is a head start.
      </p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onUploadDocument}>
        <FileText className="h-3.5 w-3.5" />
        Upload
      </Button>
    </div>
  )
}

export function ImportBundleCard({ onImportBundle }: { onImportBundle: () => void }) {
  return (
    <div className="rounded-lg p-6 space-y-3 bg-white shadow-sm hover:shadow-md transition-all">
      <h3 className="text-sm font-bold uppercase tracking-wide">
        <span className="bg-[hsl(var(--luna))] text-white px-2 py-0.5">Import</span>{' '}
        <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] normal-case">a context bundle</span>
      </h3>
      <p className="text-[14px] text-foreground/70 leading-relaxed">
        Already thinking in Claude, ChatGPT or Gemini? Plug in and start from depth instead of a
        blank page.
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Import
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onImportBundle}>
            <Upload className="h-3.5 w-3.5 mr-2" />
            Import a bundle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open('https://lunastak.io/docs/install', '_blank')}>
            <ExternalLink className="h-3.5 w-3.5 mr-2" />
            Installation guide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Demo project IDs — persistent read-only instances
const DEMO_PROJECTS = [
  { id: 'cmnxrkvuv0094ow1betk3sjzr', name: 'Ferrari', logo: '/logo-ferrari.svg', logoHeight: 'h-14', description: 'Cornered resource and brand power', episodeUrl: 'https://www.acquired.fm/episodes/ferrari' },
  { id: 'cmn8anetr5kwlmbmq', name: 'Nike', logo: '/logo-nike.svg', logoHeight: 'h-14', description: 'Scale economies and brand power', episodeUrl: 'https://www.acquired.fm/episodes/nike' },
  { id: 'cmn8an6ivpa0xoehj', name: 'Costco', logo: '/logo-costco.svg', logoHeight: 'h-14', description: 'Scale economies shared', episodeUrl: 'https://www.acquired.fm/episodes/costco' },
  { id: 'cmn8anbaapaww1709', name: 'TSMC', logo: '/logo-tsmc.svg', logoHeight: 'h-14', description: 'Process power and counter-positioning', episodeUrl: 'https://www.acquired.fm/episodes/tsmc' },
]

interface LaunchpadProps {
  projectId: string
  fragmentCount: number
  /** Switches to the knowledgebase, where chat, upload and import all live. */
  onAddContext?: () => void
  onStartChat: () => void
  onUploadDocument: () => void
  onImportBundle: () => void
  onGenerateNow?: () => void
}

export function Launchpad({
  projectId,
  fragmentCount,
  onAddContext,
  onStartChat,
  onUploadDocument,
  onImportBundle,
  onGenerateNow,
}: LaunchpadProps) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      {/* The ground truth review. This slot is the one moment it belongs in — fragments exist, no
          strategy yet — and it is reached identically from all three ingest paths, which is why it
          needs no new route and no new state column. */}
      {fragmentCount > 0 && onGenerateNow && <GroundTruthReviewPanel onGenerate={onGenerateNow} onAddContext={onAddContext} projectId={projectId} />}

      {/*
        Three onboarding paths. Upload was dropped from here while narrowing the choice to two,
        and no document was uploaded on production between March and September 2026 as a result —
        the route, the extraction path and the context box were live the whole time. Restored in
        the middle, 2026-09-09.
      */}
      <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
        <TalkToLunaCard onStartChat={onStartChat} />
        <UploadDocumentCard onUploadDocument={onUploadDocument} />
        <ImportBundleCard onImportBundle={onImportBundle} />
      </div>


      {/*
        ⚠ ORDER: heading, subheading, explanation, cards, THEN the mark.
        The Acquired × Lunastak banner used to open this block, which made a co-brand the first
        thing a new user met — before anything had told them what they were looking at. It is
        attribution, so it belongs at the end, smaller, where a credit goes.
      */}
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">See it on four real companies</h2>

        <div className="mb-3 mt-3 space-y-1">
          <p className="text-base text-muted-foreground">
            Because every company has a <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block -rotate-2">story</span>.
          </p>
          <p className="text-base text-muted-foreground">
            And every <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block rotate-1">strategy</span> is a <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block -rotate-[0.5deg]">Decision Stack</span>.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 max-w-2xl mx-auto mt-8 mb-6">
          {DEMO_PROJECTS.map((demo) => (
            <div
              key={demo.id}
              className="group cursor-pointer rounded-lg px-5 py-4 space-y-2 bg-white shadow-sm hover:shadow-md transition-all"
              onClick={() => {
                logAndFlush('cta_view_demo', 'launchpad', { source: 'app', projectId: demo.id, demo: demo.name })
                router.push(`/project/${demo.id}`)
              }}
            >
              <div className="flex justify-center py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={demo.logo} alt={demo.name} className={demo.logoHeight} />
              </div>
              <p className="text-[14px] text-foreground/70 leading-relaxed text-center">
                {demo.description}
              </p>
            </div>
          ))}
        </div>

        {/* The mark and its credit, together at the end. This line is attribution, not
            explanation — it belongs with the logo it attributes, at the size a credit takes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/acquired-promo.svg" alt="Acquired × Lunastak" className="mx-auto w-full max-w-[170px] rounded-lg opacity-90" />
        <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground/70">
          Each one is a Decision Stack built from an <a href="https://www.acquired.fm" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">Acquired podcast</a> transcript, by Ben Gilbert and David Rosenthal.
        </p>
      </div>
    </div>
  )
}
