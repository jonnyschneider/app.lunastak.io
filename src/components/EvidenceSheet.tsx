'use client'

import { Sheet, SheetContent, SheetTitle, SheetHeader, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { FragmentExplorer } from '@/components/FragmentExplorer'
import { X } from 'lucide-react'

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
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0 flex flex-col bg-background">
        <SheetHeader className="sticky top-0 z-20 bg-card border-b px-6 py-4 flex-row items-center justify-between space-y-0">
          <SheetTitle>Evidence</SheetTitle>
          <SheetDescription className="sr-only">
            Browse fragments extracted from your conversations and documents.
          </SheetDescription>
          <SheetClose className="rounded-sm p-1 opacity-70 hover:opacity-100 hover:bg-muted transition-opacity focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </SheetHeader>
        <div className="px-6 py-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <FragmentExplorer
              projectId={projectId}
              initialDimensionFilter={initialDimensionFilter}
              onResumeConversation={onResumeConversation}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
