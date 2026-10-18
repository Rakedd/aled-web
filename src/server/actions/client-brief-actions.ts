'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  CLIENT_BRIEF_AI_ERROR_MESSAGES,
  CLIENT_BRIEF_MESSAGES,
  type ClientBrief,
  type EndClientBrief,
  type GeneratedClientBrief,
  isBriefableEndClientName,
  validateEndClientNotes,
} from '@/domain/client-brief'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { rejectWith, validateUuid } from '@/domain/input-validation'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { generateClientBrief } from '@/server/ai/generate-client-brief'
import {
  type EndClientBriefSubject,
  findEndClientBrief,
  findEndClientBriefSubject,
  saveEndClientNotes,
  saveGeneratedEndClientBrief,
} from '@/server/repositories/client-brief-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const BRIEF_LOAD_FAILURE_MESSAGE = 'Impossible de charger le brief client pour le moment. Réessaie dans quelques minutes.'
const BRIEF_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer le brief pour le moment. Réessaie dans quelques minutes."
const NOTES_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer tes notes pour le moment. Réessaie dans quelques minutes."

const validateEndClientId = (endClientId: unknown): ActionResult<string> =>
  validateUuid(endClientId, ENTITY_NOT_FOUND_MESSAGES.endClient)

const requestClientBrief = async (
  userId: string,
  briefSubject: EndClientBriefSubject,
): Promise<ActionResult<ClientBrief>> => {
  try {
    const decryptedApiKey = await getDecryptedAnthropicApiKeyForUser(userId)
    if (decryptedApiKey === null) return rejectWith(CLIENT_BRIEF_AI_ERROR_MESSAGES.missing_api_key)
    const anthropicClient = createAnthropicClient(decryptedApiKey)
    return { ok: true, data: await generateClientBrief(anthropicClient, { ...briefSubject, language: 'fr' }) }
  } catch (generationError) {
    const aiErrorLogContext = describeAiErrorForLogs(generationError)
    console.error('Client brief generation failed', aiErrorLogContext)
    return rejectWith(CLIENT_BRIEF_AI_ERROR_MESSAGES[aiErrorLogContext.aiErrorKind])
  }
}

export const getEndClientBrief = async (endClientId: string): Promise<ActionResult<EndClientBrief>> =>
  runAuthenticatedOperation({
    operationName: 'getEndClientBrief',
    failureMessage: BRIEF_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateEndClientId(endClientId),
    operation: (supabase, userId, validatedEndClientId) => findEndClientBrief(supabase, userId, validatedEndClientId),
  })

export const generateBriefForEndClient = async (endClientId: string): Promise<ActionResult<GeneratedClientBrief>> =>
  runAuthenticatedOperation({
    operationName: 'generateBriefForEndClient',
    failureMessage: BRIEF_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateEndClientId(endClientId),
    operation: async (supabase, userId, validatedEndClientId) => {
      const briefSubjectResult = await findEndClientBriefSubject(supabase, userId, validatedEndClientId)
      if (!briefSubjectResult.ok) return briefSubjectResult
      if (!isBriefableEndClientName(briefSubjectResult.data.endClientName)) {
        return rejectWith(CLIENT_BRIEF_MESSAGES.unusableEndClientName)
      }
      const clientBriefResult = await requestClientBrief(userId, briefSubjectResult.data)
      if (!clientBriefResult.ok) return clientBriefResult
      const generatedAt = new Date()
      const saveResult = await saveGeneratedEndClientBrief(
        supabase,
        userId,
        validatedEndClientId,
        clientBriefResult.data,
        generatedAt,
      )
      if (!saveResult.ok) return saveResult
      return { ok: true, data: { ...clientBriefResult.data, generatedAt } }
    },
  })

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
