import Link from 'next/link'
import { Atom, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface GoToStrategyCardProps {
  latestTraceId: string | null
  projectId: string
}

export function GoToStrategyCard({ latestTraceId, projectId }: GoToStrategyCardProps) {
  if (!latestTraceId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Atom className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Your strategy will appear here once generated.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-primary/[0.03] border-primary/20">
      <CardContent className="flex items-center gap-4 py-6">
        <div className="rounded-lg bg-primary/10 p-3 shrink-0">
          <Atom className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Your Decision Stack</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            View your vision, strategy, and objectives
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={`/strategy/${latestTraceId}`}>
            View
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
