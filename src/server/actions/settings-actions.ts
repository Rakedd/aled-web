'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  type ProfileSettings,
  type ProfileSettingsInput,
  validateProfileSettingsInput,
} from '@/domain/profile-settings'
import { isProfessionalStatus, type ProfessionalStatus } from '@/domain/sign-up'
import { verifyAnthropicApiKey } from '@/server/ai/verify-anthropic-api-key'
import {
  clearAnthropicApiKey,
  findProfileSettings,
  updateProfessionalStatus,
  updateProfileSettingsRow,
} from '@/server/repositories/profile-repository'
import { saveAnthropicApiKeyWithVerifier } from '@/server/settings/save-anthropic-api-key-with-verifier'
import { NO_ARGUMENTS, runAuthenticatedOperation } from './run-authenticated-operation'

const PROFILE_SETTINGS_LOAD_FAILURE_MESSAGE =
  'Impossible de charger tes préférences pour le moment. Réessaie dans quelques minutes.'
const PROFILE_SETTINGS_SAVE_FAILURE_MESSAGE =
  "Impossible d'enregistrer tes préférences pour le moment. Réessaie dans quelques minutes."
const PROFESSIONAL_STATUS_INVALID_MESSAGE = 'Statut invalide'
const PROFESSIONAL_STATUS_SAVE_FAILURE_MESSAGE =
  "Impossible d'enregistrer ton statut pour le moment. Réessaie dans quelques minutes."
const ANTHROPIC_API_KEY_DELETION_FAILURE_MESSAGE =
  'Impossible de supprimer la clé pour le moment. Réessaie dans quelques minutes.'

export const getProfileSettings = async (): Promise<ActionResult<ProfileSettings>> =>
  runAuthenticatedOperation({
    operationName: 'getProfileSettings',
    failureMessage: PROFILE_SETTINGS_LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({ ok: true, data: await findProfileSettings(supabase, userId) }),
  })

export const hasAnthropicApiKeyConfigured = async (): Promise<boolean> => {
  const profileSettingsResult = await getProfileSettings()
  return !profileSettingsResult.ok || profileSettingsResult.data.anthropicApiKeyLastFour !== null
}

export const updateProfileSettings = async (
  profileSettingsInput: ProfileSettingsInput,
): Promise<ActionResult<ProfileSettings>> =>
  runAuthenticatedOperation({
    operationName: 'updateProfileSettings',
    failureMessage: PROFILE_SETTINGS_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateProfileSettingsInput(profileSettingsInput),
    operation: async (supabase, userId, validatedProfileSettingsInput) => ({
      ok: true,
      data: await updateProfileSettingsRow(supabase, userId, validatedProfileSettingsInput),
    }),
  })

export const saveProfessionalStatus = async (professionalStatus: ProfessionalStatus): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'saveProfessionalStatus',
    failureMessage: PROFESSIONAL_STATUS_SAVE_FAILURE_MESSAGE,
    validateArguments: () =>
      isProfessionalStatus(professionalStatus)
        ? { ok: true, data: professionalStatus }
        : { ok: false, errorMessage: PROFESSIONAL_STATUS_INVALID_MESSAGE },
    operation: async (supabase, userId, validatedProfessionalStatus) => {
      await updateProfessionalStatus(supabase, userId, validatedProfessionalStatus)
      return { ok: true, data: null }
    },
  })

export const saveAnthropicApiKey = async (plainApiKey: string): Promise<ActionResult<{ lastFour: string }>> =>
  saveAnthropicApiKeyWithVerifier(plainApiKey, verifyAnthropicApiKey)

export const deleteAnthropicApiKey = async (): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'deleteAnthropicApiKey',
    failureMessage: ANTHROPIC_API_KEY_DELETION_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => {
      await clearAnthropicApiKey(supabase, userId)
      return { ok: true, data: null }
    },
  })
