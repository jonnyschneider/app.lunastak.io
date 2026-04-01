'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, ExternalLink, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
      {/* Contextual nudge when fragments exist */}
      {fragmentCount > 0 && onGenerateNow && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm">
              You have <span className="font-semibold">{fragmentCount} fragments</span> ready to synthesise.
            </p>
            <Button size="sm" onClick={onGenerateNow}>
              Generate now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Two onboarding paths */}
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        <TalkToLunaCard onStartChat={onStartChat} />
        <ImportBundleCard onImportBundle={onImportBundle} />
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

        <div className="grid gap-4 grid-cols-3 max-w-lg mx-auto mb-5">
          {DEMO_PROJECTS.map((demo) => (
            <div
              key={demo.id}
              className="group cursor-pointer rounded-lg px-5 py-4 space-y-2 bg-white shadow-sm hover:shadow-md transition-all"
              onClick={() => router.push(`/project/${demo.id}`)}
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
