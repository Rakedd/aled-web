'use client'

import { Pencil } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { useController } from './controller'
import type { EditableBlockProps } from './interfaces'

export const EditableBlock = ({ title, view, renderEdit, heading }: EditableBlockProps) => {
  const titleId = useId()
  const { isEditing, editContainerRef, editButtonRef, startEditing, stopEditing } = useController()
  const hasCustomHeading = heading !== undefined

  return (
    <section
      aria-labelledby={hasCustomHeading ? undefined : titleId}
      aria-label={hasCustomHeading ? title : undefined}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className={hasCustomHeading ? 'flex items-start justify-between gap-2' : 'flex items-center justify-between gap-2'}>
        {hasCustomHeading ? (
          <div className="min-w-0 flex-1">{heading}</div>
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
            className={hasCustomHeading ? '-mt-0.5 -mr-3.5' : '-my-2 -mr-3.5'}
          >
            <Pencil aria-hidden="true" />
          </Button>
        )}
      </div>
      {!isEditing && view}
      {isEditing && <div ref={editContainerRef}>{renderEdit(stopEditing)}</div>}
    </section>
  )
}
