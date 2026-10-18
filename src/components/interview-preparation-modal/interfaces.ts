import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'

export type UpdateEndClientNotes = (endClientId: string, notes: string) => Promise<ActionResult<null>>

export type NotesSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed'

export type InterviewPreparationModalControllerParameters = {
  endClientId: string | null
  initialNotes: string | null
  language: BriefLanguage
  updateEndClientNotes: UpdateEndClientNotes
  onNotesSaved: (savedNotes: string) => void
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
  updateEndClientNotes: UpdateEndClientNotes
  onNotesSaved: (savedNotes: string) => void
}

export type InterviewPreparationModalContentProps = Omit<InterviewPreparationModalProps, 'isOpen' | 'onClose'>
