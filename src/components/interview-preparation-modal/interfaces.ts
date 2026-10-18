import type { RefObject } from 'react'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'

export type NotesSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed'

export type InterviewPreparationModalControllerParameters = {
  language: BriefLanguage
  onRegenerate: (language: BriefLanguage) => void
}

export type InterviewPreparationModalProps = {
  isOpen: boolean
  onClose: () => void
  preparation: InterviewPreparation
  isGenerating: boolean
  errorMessage: string | null
  hasAnthropicApiKey: boolean
  onRegenerate: (language: BriefLanguage) => void
  notes: string
  changeNotes: (notes: string) => void
  notesSaveStatus: NotesSaveStatus
  notesErrorMessage: string | null
  retryNotesSave: () => void
  finalFocusRef: RefObject<HTMLElement | null>
}

export type InterviewPreparationModalContentProps = Omit<
  InterviewPreparationModalProps,
  'isOpen' | 'onClose' | 'finalFocusRef'
>
