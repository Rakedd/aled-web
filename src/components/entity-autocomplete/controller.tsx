import { useEffect, useRef, useState } from 'react'
import type { EntityKind, EntitySuggestion } from '@/domain/entities'
import type { EntityAutocompleteControllerParameters } from './interfaces'

export const ENTITY_SEARCH_DEBOUNCE_MILLISECONDS = 250

const NO_HIGHLIGHT_INDEX = -1
const TRAILING_PARENTHESIZED_PARENT_PATTERN = /\s+\([^()]*\)$/

const toEntityName = (entityKind: EntityKind, suggestionLabel: string): string =>
  entityKind === 'end_client' ? suggestionLabel.replace(TRAILING_PARENTHESIZED_PARENT_PATTERN, '') : suggestionLabel

export const useController = ({ entityKind, onChange, searchEntities }: EntityAutocompleteControllerParameters) => {
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(NO_HIGHLIGHT_INDEX)
  const [isOpen, setIsOpen] = useState(false)
  const pendingSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSearchNumberRef = useRef(0)

  const cancelPendingSearch = () => {
    latestSearchNumberRef.current += 1
    if (pendingSearchTimeoutRef.current !== null) clearTimeout(pendingSearchTimeoutRef.current)
    pendingSearchTimeoutRef.current = null
  }

  useEffect(() => cancelPendingSearch, [])

  const closeSuggestions = () => {
    setSuggestions([])
    setHighlightedIndex(NO_HIGHLIGHT_INDEX)
    setIsOpen(false)
  }

  const runSearch = async (query: string, searchNumber: number) => {
    const searchSuggestions = await searchEntities(entityKind, query).then(
      (searchResult) => (searchResult.ok ? searchResult.data : []),
      () => [],
    )
    if (searchNumber !== latestSearchNumberRef.current) return
    setSuggestions(searchSuggestions)
    setHighlightedIndex(NO_HIGHLIGHT_INDEX)
    setIsOpen(searchSuggestions.length > 0)
  }

  const changeValue = (newValue: string) => {
    onChange(newValue)
    cancelPendingSearch()
    const query = newValue.trim()
    if (query.length === 0) {
      closeSuggestions()
      return
    }
    const searchNumber = latestSearchNumberRef.current
    pendingSearchTimeoutRef.current = setTimeout(() => void runSearch(query, searchNumber), ENTITY_SEARCH_DEBOUNCE_MILLISECONDS)
  }

  const selectSuggestion = (suggestion: EntitySuggestion) => {
    cancelPendingSearch()
    onChange(toEntityName(entityKind, suggestion.label))
    closeSuggestions()
  }

  const handleKeyDown = (key: string): boolean => {
    if (key === 'Escape' && isOpen) {
      closeSuggestions()
      return true
    }
    if (!isOpen) return false
    if (key === 'ArrowDown') {
      setHighlightedIndex((currentIndex) => (currentIndex + 1) % suggestions.length)
      return true
    }
    if (key === 'ArrowUp') {
      setHighlightedIndex((currentIndex) => (currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1))
      return true
    }
    if (key === 'Enter' && highlightedIndex !== NO_HIGHLIGHT_INDEX) {
      selectSuggestion(suggestions[highlightedIndex])
      return true
    }
    return false
  }

  return { suggestions, highlightedIndex, isOpen, changeValue, selectSuggestion, closeSuggestions, handleKeyDown }
}
