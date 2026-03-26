'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FlipCardProps {
  front: React.ReactNode
  back: React.ReactNode
  editForm?: React.ReactNode
  isEditing?: boolean
  onEditClick?: () => void
  className?: string
  /** Additional classes for the card container in both front and back states */
  cardClassName?: string
  /** Hide the edit button on the back (e.g. for read-only views) */
  hideEditButton?: boolean
}

export function FlipCard({
  front,
  back,
  editForm,
  isEditing = false,
  onEditClick,
  className,
  cardClassName,
  hideEditButton = false,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false)

  const handleCardClick = useCallback(() => {
    if (isEditing) return // Don't flip while editing
    setFlipped(prev => !prev)
  }, [isEditing])

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

  return (
    <div
      className={cn('cursor-pointer', className)}
      onClick={handleCardClick}
    >
      <div className="relative">
        {/* Front */}
        <div
          className={cn(
            'transition-opacity duration-150 ease-in-out',
            flipped ? 'opacity-0 absolute inset-0 pointer-events-none' : 'opacity-100',
            cardClassName,
          )}
        >
          {front}
        </div>

        {/* Back */}
        <div
          className={cn(
            'transition-opacity duration-150 ease-in-out',
            flipped ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
            cardClassName,
          )}
        >
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
        </div>
      </div>
    </div>
  )
}
