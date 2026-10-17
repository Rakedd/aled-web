import { useState } from 'react'
import type { StackCategory } from '@/domain/types'
import type { StackChipsEditorControllerParameters } from './interfaces'

const INITIAL_DRAFT_CATEGORY: StackCategory = 'tool'

export const useController = ({ stack, origin, onChange }: StackChipsEditorControllerParameters) => {
  const [draftName, setDraftName] = useState('')
  const [draftCategory, setDraftCategory] = useState<StackCategory>(INITIAL_DRAFT_CATEGORY)

  const addDraftItem = () => {
    const trimmedDraftName = draftName.trim()
    if (trimmedDraftName.length === 0) return
    const normalizedDraftName = trimmedDraftName.toLowerCase()
    const isAlreadyPresent = stack.some((stackItem) => stackItem.name.trim().toLowerCase() === normalizedDraftName)
    if (!isAlreadyPresent) {
      onChange([...stack, { name: trimmedDraftName, category: draftCategory, origin }])
    }
    setDraftName('')
  }

  const removeItem = (itemIndex: number) =>
    onChange(stack.filter((_, currentItemIndex) => currentItemIndex !== itemIndex))

  const changeItemCategory = (itemIndex: number, category: StackCategory) =>
    onChange(
      stack.map((stackItem, currentItemIndex) =>
        currentItemIndex === itemIndex ? { ...stackItem, category } : stackItem,
      ),
    )

  return { draftName, setDraftName, draftCategory, setDraftCategory, addDraftItem, removeItem, changeItemCategory }
}
