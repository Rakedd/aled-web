import { useState } from 'react'
import { normalizeForKeywordMatch } from '@/domain/opportunity-filters'
import type { KeywordDraftKeyboardEvent, KeywordTagsInputControllerParameters } from './interfaces'

const KEYWORD_SEPARATOR_KEYS = ['Enter', ',']

export const useController = ({
  values,
  onChange,
  normalizeKey = normalizeForKeywordMatch,
}: KeywordTagsInputControllerParameters) => {
  const [draft, setDraft] = useState('')

  const addTerms = (rawTerms: string[]) => {
    const knownNormalizedTerms = new Set(values.map(normalizeKey))
    const addedTerms: string[] = []
    for (const rawTerm of rawTerms) {
      const trimmedTerm = rawTerm.trim()
      const normalizedTerm = normalizeKey(trimmedTerm)
      if (normalizedTerm === '' || knownNormalizedTerms.has(normalizedTerm)) continue
      knownNormalizedTerms.add(normalizedTerm)
      addedTerms.push(trimmedTerm)
    }
    if (addedTerms.length > 0) onChange([...values, ...addedTerms])
  }

  const addDraft = () => {
    addTerms(draft.split(','))
    setDraft('')
  }

  const changeDraft = (changedDraft: string) => {
    if (!changedDraft.includes(',')) {
      setDraft(changedDraft)
      return
    }
    addTerms(changedDraft.split(','))
    setDraft('')
  }

  const removeValue = (valueIndex: number) =>
    onChange(values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex))

  const handleDraftKeyDown = (keyboardEvent: KeywordDraftKeyboardEvent) => {
    if (KEYWORD_SEPARATOR_KEYS.includes(keyboardEvent.key)) {
      keyboardEvent.preventDefault()
      addDraft()
      return
    }
    if (keyboardEvent.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      removeValue(values.length - 1)
    }
  }

  return { draft, changeDraft, addDraft, removeValue, handleDraftKeyDown }
}
