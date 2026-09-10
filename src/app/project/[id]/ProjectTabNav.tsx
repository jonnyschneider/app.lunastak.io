'use client'

import { Clock, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logAndFlush } from '@/components/StatsigProvider'
import { cn } from '@/lib/utils'

export type ProjectTab = 'decision-stack' | 'knowledgebase'

interface ProjectTabNavProps {
  projectId: string
  activeTab: ProjectTab
  onSelectTab: (tab: ProjectTab) => void
  /** Ground truths. Zero renders no count — a "0" would read as a result rather than an absence. */
  fragmentCount: number
  isDemo: boolean
  hasStrategy: boolean
  isSignedUp: boolean
  strategyReady: boolean
  onShare: () => void
  onExport: () => void
  onHistory: () => void
}

/**
 * The project header's navigation: the mode toggle, plus the trio that acts on a finished stack.
 *
 * ⚠ THIS COMPONENT DOES NOT DECIDE WHETHER IT APPEARS. An empty project has NO nav at all, and that
 * is enforced by the caller not injecting it (`setTabNav(null)` on `!hasContext`). Returning `null`
 * from here would not be the same thing: `setTabNav` would still hold a non-null node, and the
 * header's mobile row would keep its border and the desktop row its gap. See the test file.
 *
 * ⚠ EXTRACTED FROM A `useEffect`, 2026-09-10. It was ~180 lines of JSX inline in the effect that
 * pushes it through `HeaderContext`, which made it untestable and made every piece of state it reads
 * a dependency-array entry. `strategyReady` was missing from that array, so the ready chip rendered
 * only when another dependency happened to change at the same moment — true of a first generation
 * (`hasStrategy` flips alongside it), false of a refresh. Props do not have that failure mode.
 */
export function ProjectTabNav({
  projectId,
  activeTab,
  onSelectTab,
  fragmentCount,
  isDemo,
  hasStrategy,
  isSignedUp,
  strategyReady,
  onShare,
  onExport,
  onHistory,
}: ProjectTabNavProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-input">
        <button
          onClick={() => {
            onSelectTab('decision-stack')
            // `chip` says whether the strategy-ready dot was on the button they just pressed —
            // the only way to tell a chip-driven visit from an ordinary one without a second event.
            logAndFlush('tab_switch', 'decision-stack', { projectId, chip: String(strategyReady) })
          }}
          className={cn(
            'rounded-l-lg px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'decision-stack' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          Decision Stack
          {/*
            ⚠ ARRIVAL, NOT PROGRESS. Build is pressed from the knowledgebase and the user stays
            there — so the finished strategy lands on the tab they are not looking at. A toast is
            the wrong instrument: it announces something HAPPENING, and this is something READY
            FOR REVIEW, which outlives five seconds and the session both.

            No counter. There is exactly one strategy; a count would imply a queue.

            ⚠ IN THE LABEL, NOT ON THE CORNER. This was an absolutely-positioned corner badge and
            it landed in the MIDDLE OF THE GROUP: Decision Stack is the left button, so its
            top-right corner is the seam against Knowledgebase. Corner badges only work on a
            group's outer edges.

            It sits in the same slot as the Knowledgebase button's fragment count instead — one
            pattern for "state of this tab", mirrored. A styled span rather than a • glyph, which
            would inherit font metrics and shift its size and baseline with the font stack.

            Only ever renders on the INACTIVE button (see the guard), so it only has to read
            against the unselected background — never against `bg-primary`.
          */}
          {strategyReady && activeTab !== 'decision-stack' && (
            <span
              role="img"
              aria-label="New strategy to review"
              className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[hsl(var(--luna))] align-middle"
            />
          )}
        </button>
        <button
          onClick={() => {
            onSelectTab('knowledgebase')
            logAndFlush('tab_switch', 'knowledgebase', { projectId })
          }}
          className={cn(
            // ⚠ `rounded-r-lg` UNCONDITIONALLY, 2026-09-10. It used to be `isDemo ? … : ''`, because
            // on a real project the ⋯ was the group's right-hand end and owned the rounding. The ⋯
            // is gone, so Knowledgebase is the right end on every project.
            'rounded-r-lg border-l border-input px-4 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'knowledgebase' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          Knowledgebase
          {fragmentCount > 0 && <span className="ml-1.5 text-xs opacity-70">{fragmentCount}</span>}
        </button>
      </div>

      {/*
        ═══ THE FINISHED-ARTEFACT TRIO ═══
        Share · Export · History. All three act on the built stack, so all three are Decision Stack
        only — they have nothing to act on from the Knowledgebase.

        Export and History arrived here from the overflow menu, where they were the two items with
        no other permanent home and were filed under a GLOBAL control while being scoped to one
        mode. Three outline buttons rather than a menu behind a ⋯: a menu is the thing being
        removed, and three items do not need one.

        The version stamp's "view past revisions →" link stays. It is a second door to the same
        sheet, sitting on the stamp it describes — a contextual control, not a duplicate.
      */}
      {!isDemo && hasStrategy && activeTab === 'decision-stack' && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logAndFlush('cta_share', isSignedUp ? 'signed_up' : 'guest', { projectId })
              onShare()
            }}
            className="gap-1.5 rounded-lg px-3 text-sm shadow-none [&_svg]:size-3.5"
          >
            <Share2 />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logAndFlush('cta_export_brief', 'stack-header', { projectId })
              onExport()
            }}
            className="gap-1.5 rounded-lg px-3 text-sm shadow-none [&_svg]:size-3.5"
          >
            <Download />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logAndFlush('cta_version_history', 'stack-header', { projectId })
              onHistory()
            }}
            className="gap-1.5 rounded-lg px-3 text-sm shadow-none [&_svg]:size-3.5"
          >
            <Clock />
            History
          </Button>
        </div>
      )}
    </div>
  )
}
