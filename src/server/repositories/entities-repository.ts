import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  type ContactDetails,
  type ContactDetailsInput,
  END_CLIENT_PARENT_CYCLE_MESSAGE,
  ENTITY_NOT_FOUND_MESSAGES,
  type EntitySearchArguments,
  type EndClientParentLink,
  type EntitySuggestion,
  wouldCreateEndClientParentCycle,
} from '@/domain/entities'
import { formatEndClientLabel, normalizeEntityName } from '@/domain/entity-names'
import type { JobApplicationInput } from '@/domain/job-application'
import type { IntermediaryKind } from '@/domain/types'
import type { TablesUpdate } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_UNIQUE_VIOLATION_CODE, toRepositoryError } from './repository-error'

type EntityTableName = 'intermediaries' | 'contacts' | 'end_clients'

export type JobApplicationEntityNames = Pick<
  JobApplicationInput,
  'intermediaryName' | 'contactName' | 'contactEmail' | 'contactPhone' | 'endClientName' | 'endClientParentName'
>

export type JobApplicationEntityColumns = Pick<
  TablesUpdate<'job_applications'>,
  'intermediary_id' | 'contact_id' | 'end_client_id'
>

const ENTITY_SUGGESTION_LIMIT = 10
const NAME_UNIQUENESS_CONFLICT_TARGET = 'user_id,normalized_name'
const LIKE_PATTERN_SPECIAL_CHARACTERS = /[\\%_*]/g
const CONTACT_NAME_ALREADY_TAKEN_MESSAGE = 'Un autre contact porte déjà ce nom'

const escapeLikePattern = (searchText: string): string => searchText.replace(LIKE_PATTERN_SPECIAL_CHARACTERS, '\\$&')

const findEntityIdByNormalizedName = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  entityTableName: EntityTableName,
  normalizedName: string,
): Promise<string> => {
  const { data, error } = await supabase
    .from(entityTableName)
    .select('id')
    .eq('user_id', userId)
    .eq('normalized_name', normalizedName)
    .single()
  if (error) throw toRepositoryError(`findEntityIdByNormalizedName on ${entityTableName}`, error)
  return data.id
}

const resolveIntermediaryId = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryName: string,
): Promise<string> => {
  const normalizedName = normalizeEntityName(intermediaryName)
  const { error } = await supabase
    .from('intermediaries')
    .upsert(
      { user_id: userId, name: intermediaryName, normalized_name: normalizedName },
      { onConflict: NAME_UNIQUENESS_CONFLICT_TARGET, ignoreDuplicates: true },
    )
  if (error) throw toRepositoryError('resolveIntermediaryId', error)
  return findEntityIdByNormalizedName(supabase, userId, 'intermediaries', normalizedName)
}

const fillEmptyContactField = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
  contactFieldName: 'email' | 'phone',
  contactFieldValue: string | null,
): Promise<void> => {
  if (contactFieldValue === null) return
  const { error } = await supabase
    .from('contacts')
    .update(contactFieldName === 'email' ? { email: contactFieldValue } : { phone: contactFieldValue })
    .eq('id', contactId)
    .eq('user_id', userId)
    .is(contactFieldName, null)
  if (error) throw toRepositoryError('fillEmptyContactField', error)
}

const resolveContactId = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactName: string,
  contactEmail: string | null,
  contactPhone: string | null,
): Promise<string> => {
  const normalizedName = normalizeEntityName(contactName)
  const { error } = await supabase
    .from('contacts')
    .upsert(
      { user_id: userId, full_name: contactName, normalized_name: normalizedName },
      { onConflict: NAME_UNIQUENESS_CONFLICT_TARGET, ignoreDuplicates: true },
    )
  if (error) throw toRepositoryError('resolveContactId', error)
  const contactId = await findEntityIdByNormalizedName(supabase, userId, 'contacts', normalizedName)
  await fillEmptyContactField(supabase, userId, contactId, 'email', contactEmail)
  await fillEmptyContactField(supabase, userId, contactId, 'phone', contactPhone)
  return contactId
}

const resolveEndClientIdWithoutParent = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientName: string,
): Promise<string> => {
  const normalizedName = normalizeEntityName(endClientName)
  const { error } = await supabase
    .from('end_clients')
    .upsert(
      { user_id: userId, name: endClientName, normalized_name: normalizedName },
      { onConflict: NAME_UNIQUENESS_CONFLICT_TARGET, ignoreDuplicates: true },
    )
  if (error) throw toRepositoryError('resolveEndClientIdWithoutParent', error)
  return findEntityIdByNormalizedName(supabase, userId, 'end_clients', normalizedName)
}

const resolveEndClientId = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientName: string,
  endClientParentName: string | null,
): Promise<ActionResult<string>> => {
  if (endClientParentName !== null && normalizeEntityName(endClientParentName) === normalizeEntityName(endClientName)) {
    return { ok: false, errorMessage: END_CLIENT_PARENT_CYCLE_MESSAGE }
  }
  const endClientId = await resolveEndClientIdWithoutParent(supabase, userId, endClientName)
  if (endClientParentName === null) return { ok: true, data: endClientId }
  const parentEndClientId = await resolveEndClientIdWithoutParent(supabase, userId, endClientParentName)
  const parentAssignmentResult = await assignEndClientParent(supabase, userId, endClientId, parentEndClientId)
  if (!parentAssignmentResult.ok) return parentAssignmentResult
  return { ok: true, data: endClientId }
}

export const resolveJobApplicationEntityColumns = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  entityNames: Partial<JobApplicationEntityNames>,
): Promise<ActionResult<JobApplicationEntityColumns>> => {
  const entityColumns: JobApplicationEntityColumns = {}
  if (entityNames.endClientName !== undefined) {
    if (entityNames.endClientName === null) {
      entityColumns.end_client_id = null
    } else {
      const endClientResolution = await resolveEndClientId(
        supabase,
        userId,
        entityNames.endClientName,
        entityNames.endClientParentName ?? null,
      )
      if (!endClientResolution.ok) return endClientResolution
      entityColumns.end_client_id = endClientResolution.data
    }
  }
  if (entityNames.intermediaryName !== undefined) {
    entityColumns.intermediary_id =
      entityNames.intermediaryName === null
        ? null
        : await resolveIntermediaryId(supabase, userId, entityNames.intermediaryName)
  }
  if (entityNames.contactName !== undefined) {
    entityColumns.contact_id =
      entityNames.contactName === null
        ? null
        : await resolveContactId(
            supabase,
            userId,
            entityNames.contactName,
            entityNames.contactEmail ?? null,
            entityNames.contactPhone ?? null,
          )
  }
  return { ok: true, data: entityColumns }
}

const listEndClientParentLinks = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<EndClientParentLink[]> => {
  const { data, error } = await supabase.from('end_clients').select('id, parent_end_client_id').eq('user_id', userId)
  if (error) throw toRepositoryError('listEndClientParentLinks', error)
  return data.map((endClientRow) => ({ id: endClientRow.id, parentEndClientId: endClientRow.parent_end_client_id }))
}

export const assignEndClientParent = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  parentEndClientId: string | null,
): Promise<ActionResult<null>> => {
  const endClientParentLinks = await listEndClientParentLinks(supabase, userId)
  const ownedEndClientIds = new Set(endClientParentLinks.map((endClientParentLink) => endClientParentLink.id))
  const isParentUnknown = parentEndClientId !== null && !ownedEndClientIds.has(parentEndClientId)
  if (!ownedEndClientIds.has(endClientId) || isParentUnknown) {
    return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.endClient }
  }
  if (parentEndClientId !== null && wouldCreateEndClientParentCycle(endClientParentLinks, endClientId, parentEndClientId)) {
    return { ok: false, errorMessage: END_CLIENT_PARENT_CYCLE_MESSAGE }
  }
  const { error } = await supabase
    .from('end_clients')
    .update({ parent_end_client_id: parentEndClientId })
    .eq('id', endClientId)
    .eq('user_id', userId)
  if (error) throw toRepositoryError('assignEndClientParent', error)
  return { ok: true, data: null }
}

const searchIntermediarySuggestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  likePattern: string,
): Promise<EntitySuggestion[]> => {
  const { data, error } = await supabase
    .from('intermediaries')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('normalized_name', likePattern)
    .order('name')
    .limit(ENTITY_SUGGESTION_LIMIT)
  if (error) throw toRepositoryError('searchIntermediarySuggestions', error)
  return data.map((intermediaryRow) => ({
    id: intermediaryRow.id,
    name: intermediaryRow.name,
    label: intermediaryRow.name,
    parentName: null,
  }))
}

const searchContactSuggestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  likePattern: string,
): Promise<EntitySuggestion[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name')
    .eq('user_id', userId)
    .ilike('normalized_name', likePattern)
    .order('full_name')
    .limit(ENTITY_SUGGESTION_LIMIT)
  if (error) throw toRepositoryError('searchContactSuggestions', error)
  return data.map((contactRow) => ({
    id: contactRow.id,
    name: contactRow.full_name,
    label: contactRow.full_name,
    parentName: null,
  }))
}

const findEndClientNamesByIds = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientIds: string[],
): Promise<Map<string, string>> => {
  if (endClientIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('end_clients')
    .select('id, name')
    .eq('user_id', userId)
    .in('id', endClientIds)
  if (error) throw toRepositoryError('findEndClientNamesByIds', error)
  return new Map(data.map((endClientRow) => [endClientRow.id, endClientRow.name]))
}

const searchEndClientSuggestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  likePattern: string,
): Promise<EntitySuggestion[]> => {
  const { data, error } = await supabase
    .from('end_clients')
    .select('id, name, parent_end_client_id')
    .eq('user_id', userId)
    .ilike('normalized_name', likePattern)
    .order('name')
    .limit(ENTITY_SUGGESTION_LIMIT)
  if (error) throw toRepositoryError('searchEndClientSuggestions', error)
  const parentEndClientIds = data
    .map((endClientRow) => endClientRow.parent_end_client_id)
    .filter((parentEndClientId) => parentEndClientId !== null)
  const parentNamesById = await findEndClientNamesByIds(supabase, userId, parentEndClientIds)
  return data.map((endClientRow) => {
    const parentName =
      endClientRow.parent_end_client_id === null ? null : (parentNamesById.get(endClientRow.parent_end_client_id) ?? null)
    return {
      id: endClientRow.id,
      name: endClientRow.name,
      label: formatEndClientLabel(endClientRow.name, parentName),
      parentName,
    }
  })
}

const ENTITY_SUGGESTION_SEARCHERS = {
  intermediary: searchIntermediarySuggestions,
  contact: searchContactSuggestions,
  end_client: searchEndClientSuggestions,
} as const

export const searchEntitySuggestions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { entityKind, query }: EntitySearchArguments,
): Promise<EntitySuggestion[]> => {
  const normalizedQuery = normalizeEntityName(query)
  if (normalizedQuery.length === 0) return []
  return ENTITY_SUGGESTION_SEARCHERS[entityKind](supabase, userId, `%${escapeLikePattern(normalizedQuery)}%`)
}

export const findContactDetails = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
): Promise<ActionResult<ContactDetails>> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name, phone, email, linkedin_url')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findContactDetails', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact }
  return {
    ok: true,
    data: {
      id: data.id,
      fullName: data.full_name,
      phone: data.phone,
      email: data.email,
      linkedinUrl: data.linkedin_url,
    },
  }
}

export const saveContactDetails = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
  { fullName, phone, email, linkedinUrl }: ContactDetailsInput,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('contacts')
    .update({
      full_name: fullName,
      normalized_name: normalizeEntityName(fullName),
      phone,
      email,
      linkedin_url: linkedinUrl,
    })
    .eq('id', contactId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error?.code === POSTGRES_UNIQUE_VIOLATION_CODE) {
    return { ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE }
  }
  if (error) throw toRepositoryError('saveContactDetails', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact }
  return { ok: true, data: null }
}

export const saveIntermediaryKind = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryId: string,
  intermediaryKind: IntermediaryKind,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('intermediaries')
    .update({ kind: intermediaryKind })
    .eq('id', intermediaryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('saveIntermediaryKind', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.intermediary }
  return { ok: true, data: null }
}
