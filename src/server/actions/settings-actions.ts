'use server'

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionResult } from '@/domain/action-result'
import {
  type ProfileSettings,
  type ProfileSettingsInput,
  validateProfileSettingsInput,
} from '@/domain/profile-settings'
import { verifyAnthropicApiKey } from '@/server/ai/verify-anthropic-api-key'
import { clearAnthropicApiKey, findProfileSettings, updateProfileSettingsRow } from '@/server/repositories/profile-repository'
import { saveAnthropicApiKeyWithVerifier } from '@/server/settings/save-anthropic-api-key-with-verifier'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

type ProfileOperation<OperationData> = (supabase: SupabaseClient<Database>, userId: string) => Promise<OperationData>

const PROFILE_SETTINGS_LOAD_FAILURE_MESSAGE =
  'Impossible de charger tes réglages pour le moment. Réessaie dans quelques minutes.'
const PROFILE_SETTINGS_SAVE_FAILURE_MESSAGE =
  "Impossible d'enregistrer tes réglages pour le moment. Réessaie dans quelques minutes."
const ANTHROPIC_API_KEY_DELETION_FAILURE_MESSAGE =
  'Impossible de supprimer la clé pour le moment. Réessaie dans quelques minutes.'

const runProfileOperationForAuthenticatedUser = async <OperationData>(
  operationName: string,
  failureMessage: string,
  profileOperation: ProfileOperation<OperationData>,
): Promise<ActionResult<OperationData>> => {
  const authenticatedUser = await getAuthenticatedUser()
  try {
    const supabase = await createServerSupabaseClient()
    return { ok: true, data: await profileOperation(supabase, authenticatedUser.id) }
  } catch (operationError) {
    console.error(`Settings action ${operationName} failed`, {
      errorMessage: operationError instanceof Error ? operationError.message : typeof operationError,
    })
    return { ok: false, errorMessage: failureMessage }
  }
}

export const getProfileSettings = async (): Promise<ActionResult<ProfileSettings>> =>
  runProfileOperationForAuthenticatedUser('getProfileSettings', PROFILE_SETTINGS_LOAD_FAILURE_MESSAGE, findProfileSettings)

export const updateProfileSettings = async (
  profileSettingsInput: ProfileSettingsInput,
): Promise<ActionResult<ProfileSettings>> => {
  const validationResult = validateProfileSettingsInput(profileSettingsInput)
  if (!validationResult.ok) return validationResult
  return runProfileOperationForAuthenticatedUser(
    'updateProfileSettings',
    PROFILE_SETTINGS_SAVE_FAILURE_MESSAGE,
    (supabase, userId) => updateProfileSettingsRow(supabase, userId, validationResult.data),
  )
}

export const saveAnthropicApiKey = async (plainApiKey: string): Promise<ActionResult<{ lastFour: string }>> =>
  saveAnthropicApiKeyWithVerifier(plainApiKey, verifyAnthropicApiKey)

export const deleteAnthropicApiKey = async (): Promise<ActionResult<null>> =>
  runProfileOperationForAuthenticatedUser(
    'deleteAnthropicApiKey',
    ANTHROPIC_API_KEY_DELETION_FAILURE_MESSAGE,
    async (supabase, userId) => {
      await clearAnthropicApiKey(supabase, userId)
      return null
    },
  )
