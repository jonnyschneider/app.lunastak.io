'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, ArrowRight } from 'lucide-react'

interface GoToStrategyCardProps {
  onGoToStrategy: () => void
}

const DISMISSED_KEY = 'go-to-strategy-card-dismissed'

export function GoToStrategyCard({ onGoToStrategy }: GoToStrategyCardProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden to avoid flash

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    setIsDismissed(dismissed === 'true')
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setIsDismissed(true)
  }

  if (isDismissed) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">More features coming soon</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded hover:bg-muted text-muted-foreground"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center space-y-4">
          <div>
            <h3 className="font-medium text-sm">View Your Strategy</h3>
            <p className="text-xs text-muted-foreground mt-1">
              See your current decision stack and track progress
            </p>
          </div>
          <Button onClick={onGoToStrategy} size="sm">
            Go to Strategy
            <ArrowRight className="h-3 w-3 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
