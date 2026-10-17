'use client'

import { useId, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STACK_CATEGORIES, STACK_CATEGORY_LABELS, type StackCategory } from '@/domain/types'
import { useController } from './controller'
import type { StackChipsEditorProps } from './interfaces'

const SELECT_CLASS_NAME =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const isStackCategory = (candidate: string): candidate is StackCategory =>
  STACK_CATEGORIES.some((stackCategory) => stackCategory === candidate)

export const StackChipsEditor = ({ stack, origin, onChange }: StackChipsEditorProps) => {
  const { draftName, setDraftName, draftCategory, setDraftCategory, addDraftItem, removeItem, changeItemCategory } =
    useController({ stack, origin, onChange })
  const draftNameInputId = useId()
  const draftCategorySelectId = useId()

  const handleDraftKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key !== 'Enter') return
    keyboardEvent.preventDefault()
    addDraftItem()
  }

  return (
    <div className="flex flex-col gap-3">
      {stack.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune technologie pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {stack.map((stackItem, itemIndex) => (
            <li
              key={`${stackItem.name}-${itemIndex}`}
              className="flex items-center gap-1 rounded-full border border-input py-1 pr-1 pl-3 text-sm"
            >
              <span>{stackItem.name}</span>
              <select
                aria-label={`Catégorie de ${stackItem.name}`}
                className="rounded bg-transparent text-xs text-muted-foreground"
                value={stackItem.category}
                onChange={(changeEvent) => {
                  if (isStackCategory(changeEvent.target.value)) changeItemCategory(itemIndex, changeEvent.target.value)
                }}
              >
                {STACK_CATEGORIES.map((stackCategory) => (
                  <option key={stackCategory} value={stackCategory}>
                    {STACK_CATEGORY_LABELS[stackCategory]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Retirer ${stackItem.name}`}
                onClick={() => removeItem(itemIndex)}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <Label htmlFor={draftNameInputId}>Ajouter une technologie</Label>
          <Input
            id={draftNameInputId}
            value={draftName}
            onChange={(changeEvent) => setDraftName(changeEvent.target.value)}
            onKeyDown={handleDraftKeyDown}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={draftCategorySelectId}>Catégorie</Label>
          <select
            id={draftCategorySelectId}
            className={SELECT_CLASS_NAME}
            value={draftCategory}
            onChange={(changeEvent) => {
              if (isStackCategory(changeEvent.target.value)) setDraftCategory(changeEvent.target.value)
            }}
          >
            {STACK_CATEGORIES.map((stackCategory) => (
              <option key={stackCategory} value={stackCategory}>
                {STACK_CATEGORY_LABELS[stackCategory]}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={addDraftItem}>
          Ajouter
        </Button>
      </div>
    </div>
  )
}
