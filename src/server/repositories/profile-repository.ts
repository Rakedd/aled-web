import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { isProfessionalStatus, type ProfessionalStatus } from '@/domain/sign-up'
import { isProfileLink, type ProfileLink, type ProfileSettings, type ProfileSettingsInput } from '@/domain/profile-settings'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Json, Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

type ProfileSettingsRow = Pick<
  Tables<'profiles'>,
  'first_name' | 'last_name' | 'email' | 'links' | 'follow_up_delay_days' | 'anthropic_api_key_last_four' | 'professional_status'
>

export type EncryptedAnthropicApiKey = { encryptedApiKey: string; apiKeyLastFour: string }

const PROFILE_SETTINGS_COLUMNS = 'first_name, last_name, email, links, follow_up_delay_days, anthropic_api_key_last_four, professional_status'

const toProfileRepositoryError = (operationName: string, postgrestError: PostgrestError): Error =>
  new Error(`Profile repository ${operationName} failed with code ${postgrestError.code}`)

const toProfileLinks = (linksJson: Json): ProfileLink[] => (Array.isArray(linksJson) ? linksJson.filter(isProfileLink) : [])

const toProfileSettings = (profileSettingsRow: ProfileSettingsRow): ProfileSettings => ({
  firstName: profileSettingsRow.first_name ?? '',
  lastName: profileSettingsRow.last_name ?? '',
  email: profileSettingsRow.email ?? '',
  links: toProfileLinks(profileSettingsRow.links),
  followUpDelayDays: profileSettingsRow.follow_up_delay_days,
  anthropicApiKeyLastFour: profileSettingsRow.anthropic_api_key_last_four,
  professionalStatus: isProfessionalStatus(profileSettingsRow.professional_status)
    ? profileSettingsRow.professional_status
    : null,
})

export const findProfileSettings = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<ProfileSettings> => {
  const { data, error } = await supabase.from('profiles').select(PROFILE_SETTINGS_COLUMNS).eq('id', userId).single()
  if (error) throw toProfileRepositoryError('findProfileSettings', error)
  return toProfileSettings(data)
}

export const updateProfileSettingsRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  profileSettingsInput: ProfileSettingsInput,
): Promise<ProfileSettings> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: profileSettingsInput.firstName,
      last_name: profileSettingsInput.lastName,
      links: profileSettingsInput.links,
      follow_up_delay_days: profileSettingsInput.followUpDelayDays,
      professional_status: profileSettingsInput.professionalStatus,
    })
    .eq('id', userId)
    .select(PROFILE_SETTINGS_COLUMNS)
    .single()
  if (error) throw toProfileRepositoryError('updateProfileSettingsRow', error)
  return toProfileSettings(data)
}

export const updateProfessionalStatus = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  professionalStatus: ProfessionalStatus,
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ professional_status: professionalStatus })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw toProfileRepositoryError('updateProfessionalStatus', error)
}

export const storeEncryptedAnthropicApiKey = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { encryptedApiKey, apiKeyLastFour }: EncryptedAnthropicApiKey,
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ encrypted_anthropic_api_key: encryptedApiKey, anthropic_api_key_last_four: apiKeyLastFour })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw toProfileRepositoryError('storeEncryptedAnthropicApiKey', error)
}

export const clearAnthropicApiKey = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ encrypted_anthropic_api_key: null, anthropic_api_key_last_four: null })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw toProfileRepositoryError('clearAnthropicApiKey', error)
}

export const findEncryptedAnthropicApiKey = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('encrypted_anthropic_api_key')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw toProfileRepositoryError('findEncryptedAnthropicApiKey', error)
  return data?.encrypted_anthropic_api_key ?? null
}

export const getDecryptedAnthropicApiKeyForUser = async (userId: string): Promise<string | null> => {
  const supabase = await createServerSupabaseClient()
  const encryptedApiKey = await findEncryptedAnthropicApiKey(supabase, userId)
  if (encryptedApiKey === null) return null
  return decryptApiKey(encryptedApiKey, readApiKeyEncryptionSecret())
}

export const findOpportunitiesLastViewedAt = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<Date | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('opportunities_last_viewed_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw toProfileRepositoryError('findOpportunitiesLastViewedAt', error)
  const lastViewedAt = data?.opportunities_last_viewed_at ?? null
  return lastViewedAt === null ? null : new Date(lastViewedAt)
}

export const recordOpportunitiesViewedAt = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  viewedAt: Date,
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ opportunities_last_viewed_at: viewedAt.toISOString() })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw toProfileRepositoryError('recordOpportunitiesViewedAt', error)
}
