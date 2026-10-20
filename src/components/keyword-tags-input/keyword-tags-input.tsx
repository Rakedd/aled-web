'use client'

import { useId } from 'react'
import { X } from 'lucide-react'
import { Pill } from '@/components/pill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useController } from './controller'
import type { KeywordTagsInputProps } from './interfaces'

export const KeywordTagsInput = ({ label, helpText, values, onChange, tone }: KeywordTagsInputProps) => {
  const { draft, changeDraft, addDraft, removeValue, handleDraftKeyDown } = useController({ values, onChange })
  const inputId = useId()
  const helpTextId = useId()

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <p id={helpTextId} className="text-xs text-muted-foreground">
        {helpText}
      </p>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, valueIndex) => (
            <li key={`${value}-${valueIndex}`}>
              <Pill tone={tone} className="gap-1 py-1 pr-1 pl-3 text-sm">
                <span>{value}</span>
                <button
                  type="button"
                  aria-label={`Retirer ${value}`}
                  onClick={() => removeValue(valueIndex)}
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 motion-reduce:transition-none"
                >
                  <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Pill>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          className="flex-1"
          value={draft}
          aria-describedby={helpTextId}
          onChange={(changeEvent) => changeDraft(changeEvent.target.value)}
          onBlur={addDraft}
          onKeyDown={handleDraftKeyDown}
        />
        <Button type="button" variant="outline" onClick={addDraft}>
          Ajouter
        </Button>
      </div>
    </div>
  )
}
