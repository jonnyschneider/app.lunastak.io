// src/components/add-deep-dive-dialog.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface AddDeepDiveDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  initialTopic?: string
  origin?: 'manual' | 'message'
  sourceMessageId?: string
}

export function AddDeepDiveDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
  initialTopic = '',
  origin = 'manual',
  sourceMessageId,
}: AddDeepDiveDialogProps) {
  const [topic, setTopic] = useState(initialTopic)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          topic: topic.trim(),
          notes: notes.trim() || undefined,
          origin,
          sourceMessageId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create deep dive')
      }

      setTopic('')
      setNotes('')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setError('Failed to create deep dive. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Deep Dive</DialogTitle>
            <DialogDescription>
              Create a topic to explore in depth with focused conversations and documents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                placeholder="e.g., Pricing strategy for enterprise"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any context or notes about this topic..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!topic.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
