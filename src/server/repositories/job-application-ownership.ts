import 'server-only'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

export const isJobApplicationOwnedByUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id')
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('isJobApplicationOwnedByUser', error)
  return data !== null
}
