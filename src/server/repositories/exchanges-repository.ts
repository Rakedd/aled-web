import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { findAlertKindsClearedByActivity } from '@/domain/alert-snoozes'
import { CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE, type ContactExchangeInput, type Exchange } from '@/domain/contacts'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { deleteAlertSnoozesForJobApplication } from './alert-snoozes-repository'
import { toRepositoryError } from './repository-error'

type ExchangesOverviewRow = Tables<'exchanges_overview'>

const requireOverviewValue = <OverviewValue>(overviewValue: OverviewValue | null, columnName: string): OverviewValue => {
  if (overviewValue === null) throw new Error(`Exchanges overview row is missing ${columnName}`)
  return overviewValue
}

export const toExchange = (overviewRow: ExchangesOverviewRow): Exchange => ({
  id: requireOverviewValue(overviewRow.id, 'id'),
  occurredAt: new Date(requireOverviewValue(overviewRow.occurred_at, 'occurred_at')),
  kind: requireOverviewValue(overviewRow.kind, 'kind'),
  summary: requireOverviewValue(overviewRow.summary, 'summary'),
  jobApplicationId: overviewRow.job_application_id,
  jobApplicationTitle: overviewRow.job_application_title,
  contactId: overviewRow.effective_contact_id,
  contactName: overviewRow.contact_name,
})

export const listExchangesForContact = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
): Promise<Exchange[]> => {
  const { data, error } = await supabase
    .from('exchanges_overview')
    .select('*')
    .eq('user_id', userId)
    .eq('effective_contact_id', contactId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw toRepositoryError('listExchangesForContact', error)
  return data.map(toExchange)
}

export const listExchangesForIntermediary = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryId: string,
): Promise<Exchange[]> => {
  const { data, error } = await supabase
    .from('exchanges_overview')
    .select('*')
    .eq('user_id', userId)
    .or(`contact_intermediary_id.eq.${intermediaryId},job_application_intermediary_id.eq.${intermediaryId}`)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw toRepositoryError('listExchangesForIntermediary', error)
  return data.map(toExchange)
}

const isContactOwnedByUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('isContactOwnedByUser', error)
  return data !== null
}

const isJobApplicationOfContact = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  contactId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id')
    .eq('id', jobApplicationId)
    .eq('contact_id', contactId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('isJobApplicationOfContact', error)
  return data !== null
}

export const recordContactExchange = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string,
  { kind, summary, occurredAt, jobApplicationId }: ContactExchangeInput,
): Promise<ActionResult<null>> => {
  if (!(await isContactOwnedByUser(supabase, userId, contactId))) {
    return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact }
  }
  if (jobApplicationId !== null && !(await isJobApplicationOfContact(supabase, userId, jobApplicationId, contactId))) {
    return { ok: false, errorMessage: CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE }
  }
  const { error } = await supabase.from('activity_log_entries').insert({
    user_id: userId,
    contact_id: contactId,
    job_application_id: jobApplicationId,
    kind,
    summary,
    occurred_at: occurredAt?.toISOString(),
  })
  if (error) throw toRepositoryError('recordContactExchange', error)
  if (jobApplicationId !== null) {
    await deleteAlertSnoozesForJobApplication(supabase, userId, jobApplicationId, findAlertKindsClearedByActivity(kind))
  }
  return { ok: true, data: null }
}
