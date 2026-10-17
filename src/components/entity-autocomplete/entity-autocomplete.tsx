'use client'

import { useId, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { useController } from './controller'
import type { EntityAutocompleteProps } from './interfaces'

export const EntityAutocomplete = ({ entityKind, value, onChange, searchEntities, id }: EntityAutocompleteProps) => {
  const { suggestions, highlightedIndex, isOpen, changeValue, selectSuggestion, closeSuggestions, handleKeyDown } =
    useController({ entityKind, onChange, searchEntities })
  const listboxId = useId()

  const handleInputKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (handleKeyDown(keyboardEvent.key)) keyboardEvent.preventDefault()
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(changeEvent) => changeValue(changeEvent.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={closeSuggestions}
      />
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-input bg-popover p-1 text-sm shadow-md"
        >
          {suggestions.map((suggestion, suggestionIndex) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={suggestionIndex === highlightedIndex}
              className="cursor-pointer rounded px-2 py-1.5 aria-selected:bg-muted hover:bg-muted"
              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
