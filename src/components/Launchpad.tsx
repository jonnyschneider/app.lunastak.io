'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, BarChart3 } from 'lucide-react'

// Demo project IDs — persistent read-only instances
const DEMO_PROJECTS = [
  { id: 'cmn8on3qq3i15by9k', name: 'Lunastak', description: 'Our own strategy — see how we use the Decision Stack' },
  { id: 'cmn8anetr5kwlmbmq', name: 'Nike', description: 'From Acquired podcast — scale economies and brand power' },
  { id: 'cmn8an6ivpa0xoehj', name: 'Costco', description: 'From Acquired podcast — scale economies shared' },
  { id: 'cmn8anbaapaww1709', name: 'TSMC', description: 'From Acquired podcast — process power and counter-positioning' },
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
      <div className="grid gap-4 md:grid-cols-2">
        {/* Start a conversation */}
        <Card className="group cursor-pointer hover:border-primary/40 transition-colors" onClick={onStartChat}>
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Start a conversation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tell Luna about your business. In ~10 minutes, get your first draft strategy.
            </p>
            <Button size="sm" variant="ghost" className="px-0 text-primary group-hover:underline">
              Start &rarr;
            </Button>
          </CardContent>
        </Card>

        {/* Import a context bundle */}
        <Card className="group cursor-pointer hover:border-primary/40 transition-colors" onClick={onImportBundle}>
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Import a context bundle</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Already prepared your strategic context in Claude, ChatGPT, or another tool? Import it.
            </p>
            <Button size="sm" variant="ghost" className="px-0 text-primary group-hover:underline">
              Import &rarr;
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Examples */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          See what&apos;s possible
        </h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {DEMO_PROJECTS.map((demo) => (
            <Card
              key={demo.id}
              className="group cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => router.push(`/project/${demo.id}`)}
            >
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <h4 className="font-semibold text-sm">{demo.name}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {demo.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
