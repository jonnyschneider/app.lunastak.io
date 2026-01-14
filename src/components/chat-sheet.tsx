'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Message, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types'
import { ExtractionStep } from '@/components/ExtractionProgress'

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
  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('chat')

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL')
  const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1')

  // Extraction state
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null)
  const [dimensionalCoverage, setDimensionalCoverage] = useState<any>(null)
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting')
  const [extractionError, setExtractionError] = useState<string | undefined>()

  // Strategy state
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null)
  const [thoughts, setThoughts] = useState<string>('')
  const [traceId, setTraceId] = useState<string>('')

  // Early exit state
  const [earlyExitOffered, setEarlyExitOffered] = useState(false)
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)

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
