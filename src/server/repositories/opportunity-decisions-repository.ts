import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import {
  isRemoteMode,
  OPPORTUNITY_VALIDATION_MESSAGES,
  type OpportunityDecision,
  type RemoteMode,
} from '@/domain/opportunities'
import { fetchEveryRow } from '@/server/data-snapshot/fetch-every-row'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

export type OpportunityDecisionInput = {
  opportunityId: string
  decision: OpportunityDecision
  jobApplicationId: string | null
}

export type StoredOpportunityDecision = OpportunityDecisionInput & {
  opportunityPublishedAt: Date
  opportunityTitle: string
  opportunityCompany: string | null
  opportunityLocationLabel: string | null
  opportunityRateMin: number | null
  opportunityRateMax: number | null
  opportunityRemoteMode: RemoteMode | null
}

const DECISION_UNIQUE_KEY_COLUMNS = 'user_id,opportunity_id'

const isOpportunityDecision = (candidate: string): candidate is OpportunityDecision =>
  candidate === 'applied' || candidate === 'dismissed'

export const listOpportunityDecisions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<StoredOpportunityDecision[]> => {
  const decisionRows = await fetchEveryRow('listOpportunityDecisions', (firstRowIndex, lastRowIndex) =>
    supabase
      .from('opportunity_decisions')
      .select(
        'id, opportunity_id, decision, job_application_id, opportunities(published_at, title, company, location_label, rate_min, rate_max, remote_mode)',
      )
      .eq('user_id', userId)
      .order('id')
      .range(firstRowIndex, lastRowIndex),
  )
  return decisionRows.flatMap((decisionRow) => {
    const { decision, opportunities: decidedOpportunity } = decisionRow
    if (!isOpportunityDecision(decision) || decidedOpportunity === null) return []
    return [
      {
        opportunityId: decisionRow.opportunity_id,
        decision,
        jobApplicationId: decisionRow.job_application_id,
        opportunityPublishedAt: new Date(decidedOpportunity.published_at),
        opportunityTitle: decidedOpportunity.title,
        opportunityCompany: decidedOpportunity.company,
        opportunityLocationLabel: decidedOpportunity.location_label,
        opportunityRateMin: decidedOpportunity.rate_min,
        opportunityRateMax: decidedOpportunity.rate_max,
        opportunityRemoteMode: isRemoteMode(decidedOpportunity.remote_mode) ? decidedOpportunity.remote_mode : null,
      },
    ]
  })
}

export const findOpportunityDecision = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  opportunityId: string,
): Promise<OpportunityDecisionInput | null> => {
  const { data, error } = await supabase
    .from('opportunity_decisions')
    .select('decision, job_application_id')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .maybeSingle()
  if (error) throw toRepositoryError('findOpportunityDecision', error)
  if (data === null || !isOpportunityDecision(data.decision)) return null
  return { opportunityId, decision: data.decision, jobApplicationId: data.job_application_id }
}

export const upsertOpportunityDecision = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { opportunityId, decision, jobApplicationId }: OpportunityDecisionInput,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('opportunity_decisions').upsert(
    {
      user_id: userId,
      opportunity_id: opportunityId,
      decision,
      job_application_id: jobApplicationId,
      decided_at: new Date().toISOString(),
    },
    { onConflict: DECISION_UNIQUE_KEY_COLUMNS },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.notFound)
  if (error) throw toRepositoryError('upsertOpportunityDecision', error)
  return { ok: true, data: null }
}

export const recordDismissedOpportunityDecision = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  opportunityId: string,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('opportunity_decisions').upsert(
    {
      user_id: userId,
      opportunity_id: opportunityId,
      decision: 'dismissed',
      job_application_id: null,
      decided_at: new Date().toISOString(),
    },
    { onConflict: DECISION_UNIQUE_KEY_COLUMNS, ignoreDuplicates: true },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.notFound)
  if (error) throw toRepositoryError('recordDismissedOpportunityDecision', error)
  const storedDecision = await findOpportunityDecision(supabase, userId, opportunityId)
  if (storedDecision?.decision === 'applied') return rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.alreadyApplied)
  return { ok: true, data: null }
}

export const deleteDismissedOpportunityDecision = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  opportunityId: string,
): Promise<boolean> => {
  const { count, error } = await supabase
    .from('opportunity_decisions')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .eq('decision', 'dismissed')
  if (error) throw toRepositoryError('deleteDismissedOpportunityDecision', error)
  return (count ?? 0) > 0
}

export const deleteAppliedOpportunityDecisionsOfJobApplication = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('opportunity_decisions')
    .delete()
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .eq('decision', 'applied')
  if (error) throw toRepositoryError('deleteAppliedOpportunityDecisionsOfJobApplication', error)
}
