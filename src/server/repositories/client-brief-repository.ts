import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { rejectWith } from '@/domain/input-validation'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

export const saveEndClientNotes = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  notes: string | null,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('end_clients')
    .update({ notes })
    .eq('id', endClientId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('saveEndClientNotes', error)
  return data === null ? rejectWith(ENTITY_NOT_FOUND_MESSAGES.endClient) : { ok: true, data: null }
}
