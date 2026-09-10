'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, ExternalLink, ChevronDown, FileText } from 'lucide-react'
import { logAndFlush } from '@/components/StatsigProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DEMO_PROJECTS } from '@/lib/demos'

/**
 * --- The three cold-start doors ---
 *
 * ⚠ ONE HOME, 2026-09-10. These used to render in two places: here, and again on the
 * knowledgebase's own empty state, which showed the same three cards under different framing
 * copy. The toggle above them therefore offered a choice between one screen and a subset of
 * itself. The knowledgebase copy is gone and this is the only place they appear.
 */

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
 * decided to remove.
 *
 * The card still logs its surface so "is anyone starting from a document?" has an answer without
 * reading the code — but there is now only ONE cold-start surface to log (`launchpad`), because
 * the duplicate knowledgebase copy of these cards is gone. See the design doc's note on
 * `kb-empty-state` going to zero deliberately on 2026-09-10.
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
      {/*
        ⚠ "A CONTEXT BUNDLE" WAS THE HEADING UNTIL 2026-09-09.
        It is a real concept with its own docs page — and unrecognisable at first contact, which is
        the only place this card appears. A first-run user cannot know the term yet, so the heading
        named the artefact they would have if they had already done the thing.

        The heading now names the source. The body keeps the honesty the heading drops: this is not
        "paste any chat", it needs the skill, GPT or Gem to produce the bundle first — which is why
        the install route sits in the dropdown rather than being something to discover after
        clicking. The precise term still lives in the import dialog, where it is finally useful.
      */}
      <h3 className="text-sm font-bold uppercase tracking-wide">
        <span className="bg-[hsl(var(--luna))] text-white px-2 py-0.5">Import</span>{' '}
        <span className="italic font-medium font-[family-name:var(--font-ibm-plex-mono)] normal-case">from AI</span>
      </h3>
      <p className="text-[14px] text-foreground/70 leading-relaxed">
        Already thinking in Claude, ChatGPT or Gemini? Bring that work across with the Lunastak
        skill instead of starting from a blank page.
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


/**
 * THE COLD START. The one screen a project with no context shows.
 *
 * ⚠ IT IS NOT A TAB, 2026-09-10. This used to render inside the Decision Stack half of the
 * `Decision Stack | Knowledgebase` toggle, whenever no strategy existed — which meant it also
 * carried the ground-truth review. Both of those are gone:
 *
 *  - The review moved to the knowledgebase, where the ground truths already live (the summary
 *    panel renders them inline), so it now sits beside the summary they feed and the documents
 *    they came from instead of on the other side of a toggle.
 *  - The toggle itself does not render while a project is empty. Before context exists there is
 *    no view to choose between, so this screen belongs to the PROJECT, not to either tab.
 *
 * What is left is exactly the cold start: three doors, then four worked examples.
 */
interface LaunchpadProps {
  onStartChat: () => void
  onUploadDocument: () => void
  onImportBundle: () => void
}

export function Launchpad({
  onStartChat,
  onUploadDocument,
  onImportBundle,
}: LaunchpadProps) {
  const router = useRouter()

  return (
    <div className="space-y-8">
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
                router.push(`/project/${demo.id}?mode=stack`)
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
