'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, ExternalLink, ChevronDown, ShieldCheck, ArrowRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import { Steps } from '@/components/ui/steps'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { logAndFlush } from '@/components/StatsigProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/** The user has given context; they are checking it; then it becomes a strategy. */
const GROUND_TRUTH_PHASES = ['Your context', 'Ground truths', 'Your strategy'] as const

/**
 * Fragments exist and no strategy does: the user sees what their strategy will be built from
 * before it is built. Skipping stays available (§4's affirmative skip) — it just is not silent.
 */
function GroundTruthReviewPanel({ projectId, onGenerate }: { projectId: string; onGenerate: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [skipOpen, setSkipOpen] = useState(false)
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
              This is everything I took from what you gave me — and everything your vision, strategy
              and objectives get built from. Discard anything I got wrong, then I&rsquo;ll build it.
            </p>
          </div>
        </div>

        <GroundTruthReview
          projectId={projectId}
          onCountChange={handleCount}
        />

        <div className="flex flex-wrap items-center gap-4 border-t pt-4">
          <Button onClick={onGenerate}>
            Build my strategy{remaining !== null && total !== null && remaining < total ? ` from ${remaining}` : ''}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <button
            onClick={() => setSkipOpen(true)}
            className="text-sm text-foreground/45 underline underline-offset-4 hover:text-foreground"
          >
            Skip the review
          </button>
        </div>
      </CardContent>

      {/*
        ⚠ NO STATISTIC HERE, DELIBERATELY. §20 measured what EVIDENCE in generation does (not-clean
        25.0% → 0.0%). Nothing has ever measured what a USER REVIEWING does — that experiment does
        not exist, and "users who check their ground truths get n% fewer inventions" would be the
        exact invention this whole thread removed. The mechanism is true; the number is not ours.
      */}
      <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the review?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                These are the context your strategy is generated from. Anything wrong here can carry
                through into your vision, strategy, objectives and metrics.
              </span>
              <span className="block">
                You can fix them any time — but it&rsquo;s about thirty seconds now, and it&rsquo;s
                the single biggest influence on what you get back.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Take a look</AlertDialogCancel>
            <AlertDialogAction onClick={onGenerate}>Skip anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <p className="text-[14px] text-foreground/70 leading-relaxed">
        Tell Luna about your business. In ~10 minutes, get your first draft strategy.
      </p>
      <Button size="sm" variant="ghost" className="gap-1.5 text-primary" onClick={onStartChat}>
        <MessageSquare className="h-3.5 w-3.5" />
        Start
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
        Prepared context in Claude, ChatGPT, or Gemini? Import it and generate a Decision Stack instantly.
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1.5 text-primary">
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
  { id: 'cmn8anetr5kwlmbmq', name: 'Nike', logo: '/logo-nike.svg', logoHeight: 'h-14', description: 'Scale economies and brand power', episodeUrl: 'https://www.acquired.fm/episodes/nike' },
  { id: 'cmn8an6ivpa0xoehj', name: 'Costco', logo: '/logo-costco.svg', logoHeight: 'h-14', description: 'Scale economies shared', episodeUrl: 'https://www.acquired.fm/episodes/costco' },
  { id: 'cmn8anbaapaww1709', name: 'TSMC', logo: '/logo-tsmc.svg', logoHeight: 'h-14', description: 'Process power and counter-positioning', episodeUrl: 'https://www.acquired.fm/episodes/tsmc' },
  { id: 'cmnxrkvuv0094ow1betk3sjzr', name: 'Ferrari', logo: '/logo-ferrari.svg', logoHeight: 'h-14', description: 'Cornered resource and brand power', episodeUrl: 'https://www.acquired.fm/episodes/ferrari' },
]

interface LaunchpadProps {
  projectId: string
  fragmentCount: number
  onStartChat: () => void
  onImportBundle: () => void
  onGenerateNow?: () => void
}

export function Launchpad({
  projectId,
  fragmentCount,
  onStartChat,
  onImportBundle,
  onGenerateNow,
}: LaunchpadProps) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      {/* The ground truth review. This slot is the one moment it belongs in — fragments exist, no
          strategy yet — and it is reached identically from all three ingest paths, which is why it
          needs no new route and no new state column. */}
      {fragmentCount > 0 && onGenerateNow && <GroundTruthReviewPanel onGenerate={onGenerateNow} projectId={projectId} />}

      {/* Two onboarding paths */}
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        <TalkToLunaCard onStartChat={onStartChat} />
        <ImportBundleCard onImportBundle={onImportBundle} />
      </div>

      {/* Data security hook */}
      <div className="flex justify-center -mt-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Curious about data security?
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="center">
            <div className="space-y-3">
              <p className="font-semibold text-foreground">Your data, your control</p>
              <ul className="space-y-2 text-foreground/80 text-[13px] leading-relaxed">
                <li className="flex gap-2">
                  <span aria-hidden>🔒</span>
                  <span><strong>Encrypted, isolated database</strong> — your projects live in Neon Postgres, encrypted in transit and at rest.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>🚫</span>
                  <span><strong>Never used to train AI models</strong> — Anthropic doesn&apos;t train Claude on your conversations.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>🗑️</span>
                  <span><strong>Delete projects anytime</strong> — wipes everything in them, instantly.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>📄</span>
                  <span><strong>Uploaded documents aren&apos;t kept</strong> — we extract the text and discard the file.</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>🛠️</span>
                  <span><strong>Our skills run on your machine</strong> — they never send data to us until you upload a prepared bundle.</span>
                </li>
              </ul>
              <a
                href="https://lunastak.io/docs/data-security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Read the full data &amp; privacy docs
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Acquired × Lunastak */}
      <div className="text-center">
        {/* Banner */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/acquired-promo.svg" alt="Acquired × Lunastak" className="w-full max-w-[260px] mx-auto rounded-lg mb-5" />

        <div className="space-y-1 mb-8">
          <p className="text-base text-muted-foreground">
            Because every company has a <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block -rotate-2">story</span>.
          </p>
          <p className="text-base text-muted-foreground">
            And every <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block rotate-1">strategy</span> is a <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] bg-[#c74188] text-white/90 px-1.5 py-0.5 rounded-sm inline-block -rotate-[0.5deg]">Decision Stack</span>.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 max-w-2xl mx-auto mb-5">
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

        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          See how Luna extracts insight and creates a Decision Stack from <a href="https://www.acquired.fm" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">Acquired podcast</a> transcripts by Ben Gilbert and David Rosenthal
        </p>
      </div>
    </div>
  )
}
