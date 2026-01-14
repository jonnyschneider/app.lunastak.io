'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FlowStep = 'chat' | 'extracting' | 'extraction' | 'strategy'

interface ChatSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuestion?: string
  deepDiveId?: string
}

export function ChatSheet({
  projectId,
  open,
  onOpenChange,
  initialQuestion,
  deepDiveId,
}: ChatSheetProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('chat')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {flowStep === 'chat' && 'Strategy Conversation'}
            {flowStep === 'extracting' && 'Analyzing...'}
            {flowStep === 'extraction' && 'Review Insights'}
            {flowStep === 'strategy' && 'Your Strategy'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {/* Flow content will go here */}
          <p className="text-muted-foreground">Chat flow placeholder</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
