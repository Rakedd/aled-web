import type { ReactNode } from 'react'

export type BlockFormProps = {
  isSaving: boolean
  errorMessage: string | null
  onSave: () => Promise<void>
  onCancel: () => void
  children: ReactNode
}
