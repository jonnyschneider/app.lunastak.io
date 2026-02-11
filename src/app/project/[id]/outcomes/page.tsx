'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, FileText, Plug, TrendingUp } from 'lucide-react'
import {
  ProFeatureInterstitial,
  UpgradeSuccessDialog,
  useProUpgradeFlow,
  type ProFeatureKey,
} from '@/components/ProUpgradeFlow'

const OUTCOME_FEATURES = [
  {
    key: 'monthly-review' as ProFeatureKey,
    icon: Calendar,
    title: 'Monthly Review Draft',
    description: 'Luna drafts your MBR based on your endorsed strategy. Easy prep, distribute ahead, effective meetings.',
    cta: 'Generate Draft',
  },
  {
    key: 'quarterly-review' as ProFeatureKey,
    icon: Calendar,
    title: 'Quarterly Review Draft',
    description: 'Comprehensive QBR narrative with strategic context. Stop scrambling before board meetings.',
    cta: 'Generate Draft',
  },
  {
    key: 'strategic-narrative' as ProFeatureKey,
    icon: FileText,
    title: 'Strategic Narrative',
    description: 'The story of how you\'re tracking against objectives. Share context without the jargon.',
    cta: 'Create Narrative',
  },
  {
    key: 'connect-data' as ProFeatureKey,
    icon: Plug,
    title: 'Connect Your Data',
    description: 'Pull operational metrics back into Luna. Let reality inform your strategic updates.',
    cta: 'View Integrations',
  },
]

export default function OutcomesPage() {
  const { status } = useSession()
  const params = useParams()
  const projectId = params.id as string
  const [projectName, setProjectName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  const {
    interstitialOpen,
    setInterstitialOpen,
    successOpen,
    setSuccessOpen,
    currentFeature,
    triggerUpgrade,
    handleUpgrade,
    handleContinue,
  } = useProUpgradeFlow()

  useEffect(() => {
    if (status === 'loading') return

    fetch(`/api/project/${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProjectName(data.name)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [status, projectId])

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
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              Manage Outcomes
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Bridge the gap between strategy and execution. Luna helps you stay on track
            with auto-generated reviews and strategic narratives.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {OUTCOME_FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.key} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                  <Button
                    onClick={() => triggerUpgrade(feature.key)}
                    className="w-full"
                  >
                    {feature.cta}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Upgrade Flow Dialogs */}
      <ProFeatureInterstitial
        feature={currentFeature}
        open={interstitialOpen}
        onOpenChange={setInterstitialOpen}
        onUpgrade={handleUpgrade}
      />
      <UpgradeSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        onContinue={handleContinue}
      />
    </AppLayout>
  )
}
