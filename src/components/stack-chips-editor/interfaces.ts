import type { StackCategory, StackItem } from '@/domain/types'

export type StackChipsEditorProps = {
  stack: StackItem[]
  onChange: (stack: StackItem[]) => void
}

export type StackChipsEditorControllerParameters = StackChipsEditorProps

export type StackCategoryOption = { category: StackCategory; label: string }
