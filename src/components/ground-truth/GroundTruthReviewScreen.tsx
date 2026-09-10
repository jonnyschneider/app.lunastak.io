'use client'

import { useCallback, useState } from 'react'
import { ArrowRight, ChevronDown, Loader2, MessageSquare, Package, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Steps } from '@/components/ui/steps'
import { GroundTruthReview } from '@/components/ground-truth/GroundTruthReview'
import { logAndFlush } from '@/components/StatsigProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * ═══ THE FIRST LOOK AT WHAT WE DREW FROM WHAT YOU GAVE US ═══
 *
 * Fragments exist, no strategy does. This is the whole screen — not a card, not a panel mode.
 *
 * ⚠ IT WAS A MODE ON `KnowledgeSummaryPanel` FOR ABOUT AN HOUR, 2026-09-10, AND THAT WAS WRONG.
 * The reasoning was implementation economy: that panel already renders `GroundTruthReview` inline,
 * so a second panel would have put the same list on screen twice. True — and it let the layout be
 * decided by what was cheap rather than by what the user meets. Expanded, that panel is a
 * deliberate two-column dashboard (summary left, ground truths right) with the strategy action in
 * its header. Worse, a project in this state usually has no summary yet, so the empty half got the
 * reading measure and the thing being asked for sat beside it. Everyone would have missed it.
 *
 * ⚠ IT IS NOT A PRUNING GATE. Discarding nothing is a perfectly good outcome — every one of these
 * stays reviewable and discardable later from the knowledge summary panel. The job here is to show
 * the user EXACTLY what was drawn from their material at the moment of highest context, because
 * that is when the mental model of how the app works is cheapest to build. So the copy shows
 * rather than presses, and leaving it for later costs nothing.
 */

/**
 * ⚠ THE LABELS ARE NOT THE APP'S WORDS FOR THINGS.
 *
 * "Your context" was first, and "context" is our word, not the user's — nobody uploads a context.
 * "What you shared" covers the actual range: a conversation, a document, a bundle from another AI.
 *
 * The third step was "Your strategy", which asserted that building is the inevitable next move.
 * It is not — the buttons below offer three ways out, and two of them are not building. So the
 * third step names a STATE the material reaches, not an action the user will take.
 */
const REVIEW_PHASES = ['What you shared', 'Ground truths', 'Ready for strategy'] as const

interface GroundTruthReviewScreenProps {
  projectId: string
  /** Total ground truths, for the heading. */
  fragmentCount: number
  onBuild: () => void
  onStartChat: () => void
  onUploadDocument: () => void
  onImportBundle: () => void
  /** "Later." Not building, not adding — moving on, with the ground truths still there to come back to. */
  onDefer: () => void
}

export function GroundTruthReviewScreen({
  projectId,
  fragmentCount,
  onBuild,
  onStartChat,
  onUploadDocument,
  onImportBundle,
  onDefer,
}: GroundTruthReviewScreenProps) {
  /**
   * Pressing Build must LOOK like it did something, immediately. Generation reports through the
   * background-task toast only once the POST resolves — and in the dev server that route awaits
   * the whole run, so the screen sat unchanged for ~37s. A user reasonably concludes nothing
   * happened and presses something else; on 2026-09-08 that produced two generations landing as
   * consecutive versions.
   */
  const [building, setBuilding] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const build = useCallback(() => {
    if (building) return
    setBuilding(true)
    logAndFlush('cta_build_strategy', 'ground-truth-review', { projectId })
    onBuild()
  }, [building, onBuild, projectId])

  // Stable identity: the review reports counts from an effect, and an inline arrow here would
  // change on every render and re-fire it.
  const handleCount = useCallback((r: number, t: number) => { setRemaining(r); setTotal(t) }, [])

  const shown = total ?? fragmentCount
  const pruned = remaining !== null && total !== null && remaining < total

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 pb-8">
      {/*
        ⚠ NO `overflow-hidden` ON THIS CONTAINER. It would clip the sticky action bar below into
        uselessness — `overflow: hidden` on an ancestor kills `position: sticky` in a descendant.
        `KnowledgeSummaryPanel` learned the same thing about its sticky head and says so in its
        own comment; this is the second time it has cost someone an hour.

        So the top rounding moves onto a wrapper around the bar instead, which is NOT an ancestor
        of the sticky element, and the bar gets its own bottom rounding.
      */}
      <div className="rounded-lg border border-border bg-background">
        <div className="overflow-hidden rounded-t-lg">
          <Steps steps={REVIEW_PHASES} current={1} flush labelsClassName="px-6 md:px-8" />
        </div>

        <div className="space-y-4 p-6 md:p-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {shown > 0 ? `Here are the ${shown} ground truths we found` : 'Here are your ground truths'}
            </h1>
            {/*
              ⚠ SHOWS, DOES NOT PRESS. The earlier copy — "Discard any items that are wrong" —
              made this a chore with a right answer, when the honest position is that reading it
              is the whole point and changing nothing is fine. The second sentence exists to make
              Skip genuinely free rather than nominally free: a user who believes this is their
              only chance to fix something will not skip it, whatever the button says.
            */}
            <p className="mt-1 text-sm text-foreground/60">
              This is everything your Decision Stack will be built from. Have a read — discard
              anything that isn&apos;t right, or leave it all as it is. You can review and change
              these at any time from your knowledgebase.
            </p>
          </div>

          <GroundTruthReview projectId={projectId} onCountChange={handleCount} />
        </div>

        {/*
          ⚠ STICKY, WITH THE LIST SCROLLING UNDER IT.
          The exits decide where the user goes next, and a long extraction pushes them below the
          fold — where a user who has finished reading has to scroll back down past everything they
          just read to act. `bottom-0` rather than a fixed bar so it belongs to this card and stops
          at its edge.
        */}
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 rounded-b-lg border-t border-border bg-background/95 px-6 py-4 backdrop-blur md:px-8">
          <Button onClick={build} disabled={building}>
            {building ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Building your strategy…</>
            ) : (
              <>
                Build my strategy{pruned ? ` from ${remaining}` : ''}
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>

          {!building && (
            <>
              {/*
                Adding opens the ingest paths RIGHT HERE rather than navigating somewhere to find
                them. This screen is the whole knowledgebase while it is up, so sending the user
                off to look for an Upload button would be sending them to a screen they cannot see.
              */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add more
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={onStartChat}>
                    <MessageSquare className="mr-2 h-3.5 w-3.5" />Talk to Luna
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onUploadDocument}>
                    <Upload className="mr-2 h-3.5 w-3.5" />Upload a document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onImportBundle}>
                    <Package className="mr-2 h-3.5 w-3.5" />Import from AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/*
                ⚠ "LATER", NOT "SKIP" — and the difference is not decoration.
                Skip says you are forfeiting something. Nothing is forfeited: every one of these
                stays in the knowledgebase, reviewable and discardable, for as long as the project
                exists. Naming it skip would invent a cost that does not exist and make the least
                harmful exit feel like the reckless one.

                ⚠ AND IT IS NOT THE "SKIP THE REVIEW" BUTTON DELETED ON 2026-09-09. That one called
                the same function as Build, logged nothing and recorded nothing — a second button
                claiming to do something different when it did not. This one leaves WITHOUT
                generating, and it is remembered, so the screen does not reappear on the next load.
                Without the record, "you can do this later" is a promise the next page load breaks.
              */}
              <Button variant="ghost" className="text-muted-foreground" onClick={onDefer}>
                Review these later
              </Button>
            </>
          )}

          {building && (
            <span className="text-xs text-foreground/45">
              This takes about half a minute. You can leave this page.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
