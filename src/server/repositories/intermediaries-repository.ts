import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { IntermediaryListItem } from '@/domain/contacts'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

type IntermediariesOverviewRow = Tables<'intermediaries_overview'>

const requireOverviewValue = <OverviewValue>(overviewValue: OverviewValue | null, columnName: string): OverviewValue => {
  if (overviewValue === null) throw new Error(`Intermediaries overview row is missing ${columnName}`)
  return overviewValue
}

export const toIntermediaryListItem = (overviewRow: IntermediariesOverviewRow): IntermediaryListItem => ({
  id: requireOverviewValue(overviewRow.id, 'id'),
  name: requireOverviewValue(overviewRow.name, 'name'),
  kind: overviewRow.kind,
  contactCount: overviewRow.contact_count ?? 0,
  proposedMissionCount: overviewRow.proposed_mission_count ?? 0,
  lastExchangeAt: overviewRow.last_exchange_at === null ? null : new Date(overviewRow.last_exchange_at),
})

export const listIntermediaryListItems = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<IntermediaryListItem[]> => {
  const { data, error } = await supabase.from('intermediaries_overview').select('*').eq('user_id', userId)
  if (error) throw toRepositoryError('listIntermediaryListItems', error)
  return data.map(toIntermediaryListItem)
}

export const findIntermediaryListItem = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  intermediaryId: string,
): Promise<ActionResult<IntermediaryListItem>> => {
  const { data, error } = await supabase
    .from('intermediaries_overview')
    .select('*')
    .eq('id', intermediaryId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findIntermediaryListItem', error)
  if (data === null) return { ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.intermediary }
  return { ok: true, data: toIntermediaryListItem(data) }
}
