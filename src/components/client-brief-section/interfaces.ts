import type { ActionResult } from '@/domain/action-result'
import type { EndClientBrief, GeneratedClientBrief } from '@/domain/client-brief'

export type GenerateBriefForEndClient = (endClientId: string) => Promise<ActionResult<GeneratedClientBrief>>

export type UpdateEndClientNotes = (endClientId: string, notes: string) => Promise<ActionResult<null>>

export type ClientBriefSectionState = 'unknown_client' | 'no_brief' | 'generating' | 'brief_available'

export type NotesSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed'

export type ClientBriefSectionControllerParameters = {
  endClientBrief: EndClientBrief | null
  generateBriefForEndClient: GenerateBriefForEndClient
  updateEndClientNotes: UpdateEndClientNotes
  onDataChanged: () => void
}

export type ClientBriefSectionProps = Omit<ClientBriefSectionControllerParameters, 'onDataChanged'> & {
  endClientLabel: string | null
}
