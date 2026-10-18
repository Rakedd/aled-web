'use client'

import { Pencil } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { useController } from './controller'
import type { EditableBlockProps } from './interfaces'

export const EditableBlock = ({ title, view, renderEdit, isTitleHidden = false }: EditableBlockProps) => {
  const titleId = useId()
  const { isEditing, editContainerRef, editButtonRef, startEditing, stopEditing } = useController()

  return (
    <section
      aria-labelledby={isTitleHidden ? undefined : titleId}
      aria-label={isTitleHidden ? title : undefined}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        {isTitleHidden ? (
          <div className="min-w-0 flex-1">{isEditing ? null : view}</div>
        ) : (
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
        )}
        {!isEditing && (
          <Button
            ref={editButtonRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier ${title}`}
            onClick={startEditing}
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
      </div>
      {!isTitleHidden && !isEditing && view}
      {isEditing && <div ref={editContainerRef}>{renderEdit(stopEditing)}</div>}
    </section>
  )
}
