'use client'

import { Sheet, SheetContent, SheetTitle, SheetHeader, SheetDescription } from '@/components/ui/sheet'
import { FragmentExplorer } from '@/components/FragmentExplorer'

interface EvidenceSheetProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDimensionFilter?: string
  onResumeConversation?: (conversationId: string) => void
}

export function EvidenceSheet({
  projectId,
  open,
  onOpenChange,
  initialDimensionFilter,
  onResumeConversation,
}: EvidenceSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetTitle>Evidence</SheetTitle>
          <SheetDescription className="sr-only">
            Browse fragments extracted from your conversations and documents.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4">
          <FragmentExplorer
            projectId={projectId}
            initialDimensionFilter={initialDimensionFilter}
            onResumeConversation={onResumeConversation}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
