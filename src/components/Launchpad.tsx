'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Upload, Eye } from 'lucide-react'

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

      {/* Three onboarding paths */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Start a conversation */}
        <Card className="group cursor-pointer hover:border-primary/40 transition-colors" onClick={onStartChat}>
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Start a conversation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Talk through your strategy with Luna. She&apos;ll ask the right questions to draw out your thinking.
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
              Already prepared your strategic context? Import a bundle to jumpstart your decision stack.
            </p>
            <Button size="sm" variant="ghost" className="px-0 text-primary group-hover:underline">
              Import &rarr;
            </Button>
          </CardContent>
        </Card>

        {/* See what's possible */}
        <Card className="group cursor-pointer hover:border-primary/40 transition-colors" onClick={() => {
          // Navigate to first demo project — will be wired up in Task 5
          window.location.href = '/examples'
        }}>
          <CardContent className="p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">See what&apos;s possible</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore example decision stacks to see how Luna helps founders build strategic clarity.
            </p>
            <Button size="sm" variant="ghost" className="px-0 text-primary group-hover:underline">
              Explore &rarr;
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
