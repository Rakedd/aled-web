import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  hasAnthropicApiKeyFormat,
  INVALID_ANTHROPIC_API_KEY_FORMAT_MESSAGE,
  REJECTED_ANTHROPIC_API_KEY_MESSAGE,
} from '@/domain/anthropic-api-key'
import { encryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { storeEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

export type VerifyApiKey = (apiKey: string) => Promise<boolean>

type ApiKeyVerificationOutcome = 'accepted' | 'rejected' | 'unavailable'

const API_KEY_VERIFICATION_UNAVAILABLE_MESSAGE =
  'Impossible de vérifier la clé pour le moment. Réessaie dans quelques minutes.'
const API_KEY_STORAGE_FAILURE_MESSAGE = "Impossible d'enregistrer la clé pour le moment. Réessaie dans quelques minutes."
const API_KEY_VISIBLE_SUFFIX_LENGTH = 4

const readErrorName = (error: unknown): string => (error instanceof Error ? error.name : typeof error)

const readErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : typeof error)

const runApiKeyVerification = async (
  verifyApiKey: VerifyApiKey,
  apiKey: string,
): Promise<ApiKeyVerificationOutcome> => {
  try {
    return (await verifyApiKey(apiKey)) ? 'accepted' : 'rejected'
  } catch (verificationError) {
    console.error('Anthropic api key verification failed', { errorName: readErrorName(verificationError) })
    return 'unavailable'
  }
}

const storeApiKeyEncrypted = async (userId: string, apiKey: string, apiKeyLastFour: string): Promise<boolean> => {
  try {
    const encryptedApiKey = encryptApiKey(apiKey, readApiKeyEncryptionSecret())
    const supabase = await createServerSupabaseClient()
    await storeEncryptedAnthropicApiKey(supabase, userId, { encryptedApiKey, apiKeyLastFour })
    return true
  } catch (storageError) {
    console.error('Anthropic api key storage failed', { errorMessage: readErrorMessage(storageError) })
    return false
  }
}

export const saveAnthropicApiKeyWithVerifier = async (
  plainApiKey: string,
  verifyApiKey: VerifyApiKey,
): Promise<ActionResult<{ lastFour: string }>> => {
  const trimmedApiKey = typeof plainApiKey === 'string' ? plainApiKey.trim() : ''
  if (!hasAnthropicApiKeyFormat(trimmedApiKey)) return { ok: false, errorMessage: INVALID_ANTHROPIC_API_KEY_FORMAT_MESSAGE }
  const authenticatedUser = await getAuthenticatedUser()
  const verificationOutcome = await runApiKeyVerification(verifyApiKey, trimmedApiKey)
  if (verificationOutcome === 'rejected') return { ok: false, errorMessage: REJECTED_ANTHROPIC_API_KEY_MESSAGE }
  if (verificationOutcome === 'unavailable') return { ok: false, errorMessage: API_KEY_VERIFICATION_UNAVAILABLE_MESSAGE }
  const apiKeyLastFour = trimmedApiKey.slice(-API_KEY_VISIBLE_SUFFIX_LENGTH)
  const isApiKeyStored = await storeApiKeyEncrypted(authenticatedUser.id, trimmedApiKey, apiKeyLastFour)
  if (!isApiKeyStored) return { ok: false, errorMessage: API_KEY_STORAGE_FAILURE_MESSAGE }
  return { ok: true, data: { lastFour: apiKeyLastFour } }
}
