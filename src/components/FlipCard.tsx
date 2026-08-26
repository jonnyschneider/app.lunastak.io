'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Pencil, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logAndFlush } from '@/components/StatsigProvider'

/** Which stack layer this card renders — used as the analytics `value`. */
export type FlipCardType =
  | 'vision'
  | 'strategy'
  | 'objective'
  | 'opportunity'
  | 'principle'

interface FlipCardProps {
  /** Front face content only — the shell (background, radius, padding) is owned by FlipCard. */
  front: React.ReactNode
  /** Back face content only. */
  back: React.ReactNode
  editForm?: React.ReactNode
  isEditing?: boolean
  onEditClick?: () => void
  className?: string
  /** Chrome for the card shell: background, radius, shadow, min-height. */
  cardClassName?: string
  /** Content density. `sm` is for the tighter principle tiles. */
  size?: 'default' | 'sm'
  /** Label on the disclosure strip while the front is showing. */
  disclosureLabel?: string
  /** Label on the disclosure strip while the back is showing. */
  returnLabel?: string
  /** Stack layer, for the disclosure analytics event. */
  cardType?: FlipCardType
  projectId?: string
  /** Hide the edit button FlipCard renders on the back. */
  hideEditButton?: boolean
}

const SIZES = {
  default: { content: 'p-6', strip: 'px-6 py-3' },
  sm: { content: 'p-4', strip: 'px-4 py-2.5' },
} as const

export function FlipCard({
  front,
  back,
  editForm,
  isEditing = false,
  onEditClick,
  className,
  cardClassName,
  size = 'default',
  disclosureLabel = 'The thinking',
  returnLabel = 'Back',
  cardType,
  projectId,
  hideEditButton = false,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const prevIsEditing = useRef(isEditing)

  // Return to front after exiting edit mode
  useEffect(() => {
    if (prevIsEditing.current && !isEditing) {
      setFlipped(false)
    }
    prevIsEditing.current = isEditing
  }, [isEditing])

  const handleFlip = useCallback(() => {
    if (isEditing) return // Don't flip while editing
    setFlipped(prev => {
      const next = !prev
      // Only the reveal is interesting — returning to the front is not a read.
      if (next && cardType) {
        logAndFlush('card_thinking_viewed', cardType, {
          ...(projectId ? { projectId } : {}),
        })
      }
      return next
    })
  }, [isEditing, cardType, projectId])

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEditClick?.()
  }, [onEditClick])

  // When entering edit mode, render the edit form expanded
  // When exiting edit mode, flip back to front
  if (isEditing && editForm) {
    return (
      <div className={cn('col-span-full', className)}>
        {editForm}
      </div>
    )
  }

  const { content: contentPadding, strip: stripPadding } = SIZES[size]

  const backFace = (
    <>
      {back}
      {!hideEditButton && onEditClick && (
        <div className="flex justify-end mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClick}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <Pencil className="h-3 w-3" />
            <span className="text-xs">Edit</span>
          </Button>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Print: show both sides, no animation, no strip */}
      <div className={cn('hidden print:block', className)}>
        <div className={cn(cardClassName, contentPadding)}>{front}</div>
        <div className={cn(cardClassName, contentPadding, 'mt-2 border-t pt-2')}>{back}</div>
      </div>

      {/* Interactive version */}
      <div className={cn('print:hidden', className)}>
        <div className={cn('flex flex-col overflow-hidden', cardClassName)}>
          {/*
           * The card sizes to whichever face is showing. A flip inside a grid
           * therefore reflows the row — accepted deliberately, because sizing
           * every card to its taller face costs more whitespace than the jump
           * costs in stability.
           */}
          <div className="relative flex-1">
            <div
              aria-hidden={flipped}
              className={cn(
                'transition-opacity duration-150 ease-in-out',
                contentPadding,
                flipped ? 'opacity-0 absolute inset-0 pointer-events-none' : 'opacity-100',
              )}
            >
              {front}
            </div>
            <div
              aria-hidden={!flipped}
              className={cn(
                'transition-opacity duration-150 ease-in-out',
                contentPadding,
                flipped ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
              )}
            >
              {backFace}
            </div>
          </div>

          {/*
           * The disclosure strip is the ONLY click target. The whole card used to
           * be the button, which is why nothing on it ever looked like one.
           */}
          <button
            type="button"
            onClick={handleFlip}
            aria-expanded={flipped}
            className={cn(
              'flex w-full shrink-0 items-center justify-center gap-2',
              'border-t border-white/20',
              // Deliberately NOT neon: the headings are neon, and a neon strip
              // competed with them. The border, the hover and the full-bleed
              // shape carry the affordance — the label only has to name it.
              // Stepped down by SIZE and WEIGHT, never by opacity: greying text
              // out to signal hierarchy is a house no.
              'text-white hover:bg-white/10 focus-visible:bg-white/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40',
              'transition-colors',
              stripPadding,
            )}
          >
            <span className="text-xs font-medium">
              {flipped ? returnLabel : disclosureLabel}
            </span>
            <RotateCw
              className={cn(
                'h-3 w-3 shrink-0 transition-transform duration-300',
                flipped && '-rotate-180',
              )}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>
    </>
  )
}
