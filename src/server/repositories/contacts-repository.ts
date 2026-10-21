import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { ContactListItem, ContactProfile, ContactProfileInput } from '@/domain/contacts'
import { CONTACT_NAME_ALREADY_TAKEN_MESSAGE, ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { normalizeEntityName } from '@/domain/entity-names'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { resolveIntermediaryId } from './entities-repository'
import { POSTGRES_UNIQUE_VIOLATION_CODE, toRepositoryError } from './repository-error'

type ContactsOverviewRow = Tables<'contacts_overview'>

const requireOverviewValue = <OverviewValue>(overviewValue: OverviewValue | null, columnName: string): OverviewValue => {
  if (overviewValue === null) throw new Error(`Contacts overview row is missing ${columnName}`)
  return overviewValue
}

export const toContactListItem = (overviewRow: ContactsOverviewRow): ContactListItem => ({
  id: requireOverviewValue(overviewRow.id, 'id'),
  fullName: requireOverviewValue(overviewRow.full_name, 'full_name'),
  intermediaryId: overviewRow.intermediary_id,
  intermediaryName: overviewRow.intermediary_name,
  phone: overviewRow.phone,
  email: overviewRow.email,
  linkedinUrl: overviewRow.linkedin_url,
  lastExchangeAt: overviewRow.last_exchange_at === null ? null : new Date(overviewRow.last_exchange_at),
  proposedMissionCount: overviewRow.proposed_mission_count ?? 0,
})

const toContactProfile = (overviewRow: ContactsOverviewRow): ContactProfile => ({
  id: requireOverviewValue(overviewRow.id, 'id'),
  fullName: requireOverviewValue(overviewRow.full_name, 'full_name'),
  phone: overviewRow.phone,
  email: overviewRow.email,
  linkedinUrl: overviewRow.linkedin_url,
  intermediaryId: overviewRow.intermediary_id,
  intermediaryName: overviewRow.intermediary_name,
  referredBy: overviewRow.referred_by,
  notes: overviewRow.notes,
})

const resolveOptionalIntermediaryId = (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryName: string | null,
): Promise<string | null> =>
  intermediaryName === null ? Promise.resolve(null) : resolveIntermediaryId(supabase, userId, intermediaryName)

export const listContactListItems = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<ContactListItem[]> => {
  const { data, error } = await supabase.from('contacts_overview').select('*').eq('user_id', userId)
  if (error) throw toRepositoryError('listContactListItems', error)
  return data.map(toContactListItem)
}

export const listContactListItemsForIntermediary = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryId: string,
): Promise<ContactListItem[]> => {
  const { data, error } = await supabase
    .from('contacts_overview')
    .select('*')
    .eq('user_id', userId)
    .eq('intermediary_id', intermediaryId)
  if (error) throw toRepositoryError('listContactListItemsForIntermediary', error)
  return data.map(toContactListItem)
}

export const findContactProfile = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
): Promise<ActionResult<ContactProfile>> => {
  const { data, error } = await supabase
    .from('contacts_overview')
    .select('*')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findContactProfile', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact }
  return { ok: true, data: toContactProfile(data) }
}

export const insertContact = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: ContactProfileInput,
): Promise<ActionResult<{ id: string }>> => {
  const intermediaryId = await resolveOptionalIntermediaryId(supabase, userId, input.intermediaryName)
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      full_name: input.fullName,
      normalized_name: normalizeEntityName(input.fullName),
      phone: input.phone,
      email: input.email,
      linkedin_url: input.linkedinUrl,
      intermediary_id: intermediaryId,
      referred_by: input.referredBy,
      notes: input.notes,
    })
    .select('id')
    .single()
  if (error?.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return { ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE }
  }
  if (error) throw toRepositoryError('insertContact', error)
  return { ok: true, data: { id: data.id } }
}

export const saveContactProfile = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
  input: ContactProfileInput,
): Promise<ActionResult<null>> => {
  const intermediaryId = await resolveOptionalIntermediaryId(supabase, userId, input.intermediaryName)
  const { data, error } = await supabase
    .from('contacts')
    .update({
      full_name: input.fullName,
      normalized_name: normalizeEntityName(input.fullName),
      phone: input.phone,
      email: input.email,
      linkedin_url: input.linkedinUrl,
      intermediary_id: intermediaryId,
      referred_by: input.referredBy,
      notes: input.notes,
    })
    .eq('id', contactId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error?.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return { ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE }
  }
  if (error) throw toRepositoryError('saveContactProfile', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact }
  return { ok: true, data: null }
}

export const deleteContactRow = async (supabase: FreeclutchSupabaseClient, contactId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('delete_contact', { target_contact_id: contactId })
  if (error) throw toRepositoryError('deleteContactRow', error)
  return data
}
