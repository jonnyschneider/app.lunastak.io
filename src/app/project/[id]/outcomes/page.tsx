'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Loader2,
  Bell,
  BarChart3,
  CalendarCheck,
  FileText,
} from 'lucide-react'

export default function OutcomesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [projectName, setProjectName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [notifyRequested, setNotifyRequested] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    // Don't redirect to signin - guests can access projects via cookie
    // The API will return 401 if unauthorized
    fetch(`/api/project/${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProjectName(data.name)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [status, projectId])

  const handleNotify = () => {
    // In future, this would call an API to register interest
    setNotifyRequested(true)
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

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {projectName || 'Outcomes'}
          </h1>
          <p className="text-muted-foreground">
            Track performance and make decisions based on results
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground text-center max-w-lg mb-8">
              Outcomes connects your strategy to results. Generate MBRs, track OKRs,
              and make better operational decisions—all informed by your strategic direction.
            </p>

            {/* Feature Preview */}
            <div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl mb-8">
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <FileText className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">Monthly Reviews</span>
                <span className="text-xs text-muted-foreground">Auto-generated MBRs</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">OKR Tracking</span>
                <span className="text-xs text-muted-foreground">Metrics tied to strategy</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <CalendarCheck className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">Quarterly Planning</span>
                <span className="text-xs text-muted-foreground">Strategy refresh cycles</span>
              </div>
            </div>

            {/* Notify Button */}
            {notifyRequested ? (
              <div className="flex items-center gap-2 text-green-600">
                <Bell className="h-4 w-4" />
                <span className="text-sm">We&apos;ll notify you when it&apos;s ready!</span>
              </div>
            ) : (
              <Button onClick={handleNotify} variant="outline">
                <Bell className="h-4 w-4 mr-2" />
                Notify me when available
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
