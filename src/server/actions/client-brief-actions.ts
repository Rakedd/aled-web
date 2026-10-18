'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { validateEndClientNotes } from '@/domain/client-brief'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { validateUuid } from '@/domain/input-validation'
import { saveEndClientNotes } from '@/server/repositories/client-brief-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const NOTES_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer tes notes pour le moment. Réessaie dans quelques minutes."

const validateEndClientId = (endClientId: unknown): ActionResult<string> =>
  validateUuid(endClientId, ENTITY_NOT_FOUND_MESSAGES.endClient)

export const updateEndClientNotes = async (endClientId: string, notes: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateEndClientNotes',
    failureMessage: NOTES_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ endClientId: string; notes: string | null }> => {
      const endClientIdValidation = validateEndClientId(endClientId)
      if (!endClientIdValidation.ok) return endClientIdValidation
      const notesValidation = validateEndClientNotes(notes)
      if (!notesValidation.ok) return notesValidation
      return { ok: true, data: { endClientId: endClientIdValidation.data, notes: notesValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      saveEndClientNotes(supabase, userId, validatedArguments.endClientId, validatedArguments.notes),
  })
