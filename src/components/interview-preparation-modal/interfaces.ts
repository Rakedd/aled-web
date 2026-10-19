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
  generationProgressLabel: string | null
  errorMessage: string | null
  hasAnthropicApiKey: boolean
  onRegenerate: (language: BriefLanguage) => void
  onGenerateMissingPart: () => void
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
