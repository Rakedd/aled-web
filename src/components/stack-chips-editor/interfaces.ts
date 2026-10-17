import type { StackItem, StackItemOrigin } from '@/domain/types'

export type StackChipsEditorProps = {
  stack: StackItem[]
  origin: StackItemOrigin
  onChange: (stack: StackItem[]) => void
}

export type StackChipsEditorControllerParameters = StackChipsEditorProps
