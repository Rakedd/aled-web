import 'server-only'
import { buildCallDraft } from '@/domain/call-draft'
import {
  type CallApiError,
  type CallDraft,
  type CallDraftInput,
  type CallNoteExtraction,
  CALL_LOG_MESSAGES,
  toCallApiError,
  toCallDraftAiErrorMessage,
} from '@/domain/call-log'
import { toCvOptions, type CvOption } from '@/domain/cv-library'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { describeAiErrorForLogs, toAiErrorKind } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractCallNote } from '@/server/ai/extract-call-note'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { listContactListItems } from '@/server/repositories/contacts-repository'
import { listCvLibraryItems } from '@/server/repositories/cvs-repository'
import { findEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type PrepareCallDraftOutcome = { ok: true; data: CallDraft } | { ok: false; error: CallApiError }

const loadCvOptions = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<CvOption[]> => {
  try {
    return toCvOptions(await listCvLibraryItems(supabase, userId))
  } catch (error) {
    console.error('Call draft cv loading failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export const prepareCallDraft = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: CallDraftInput,
): Promise<PrepareCallDraftOutcome> => {
  const encryptedApiKey = await findEncryptedAnthropicApiKey(supabase, userId)
  if (encryptedApiKey === null) {
    return { ok: false, error: toCallApiError('missing_api_key', CALL_LOG_MESSAGES.missingApiKey) }
  }
  const [contacts, cvOptions] = await Promise.all([
    listContactListItems(supabase, userId),
    loadCvOptions(supabase, userId),
  ])
  if (input.contactId !== null && !contacts.some((contact) => contact.id === input.contactId)) {
    return { ok: false, error: toCallApiError('not_found', ENTITY_NOT_FOUND_MESSAGES.contact) }
  }
  let extraction: CallNoteExtraction
  try {
    const apiKey = decryptApiKey(encryptedApiKey, readApiKeyEncryptionSecret())
    extraction = await extractCallNote(createAnthropicClient(apiKey), input.text)
  } catch (error) {
    console.error('Call note extraction failed', describeAiErrorForLogs(error))
    const aiErrorKind = toAiErrorKind(error)
    return { ok: false, error: toCallApiError(aiErrorKind, toCallDraftAiErrorMessage(aiErrorKind)) }
  }
  return { ok: true, data: buildCallDraft({ input, extraction, contacts, cvOptions }) }
}
