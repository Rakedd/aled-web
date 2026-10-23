import 'server-only'
import type { CalendarFeedStatus } from '@/domain/calendar-feed'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

const INACTIVE_CALENDAR_FEED_STATUS: CalendarFeedStatus = { isActive: false, createdAt: null }

export const findCalendarFeedStatus = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<CalendarFeedStatus> => {
  const { data, error } = await supabase.from('calendar_feeds').select('created_at').eq('user_id', userId).maybeSingle()
  if (error) throw toRepositoryError('findCalendarFeedStatus', error)
  return data === null ? INACTIVE_CALENDAR_FEED_STATUS : { isActive: true, createdAt: new Date(data.created_at) }
}

export const saveCalendarFeedTokenHash = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  tokenHash: string,
  createdAt: Date,
): Promise<void> => {
  const { error } = await supabase
    .from('calendar_feeds')
    .upsert({ user_id: userId, token_hash: tokenHash, created_at: createdAt.toISOString() }, { onConflict: 'user_id' })
  if (error) throw toRepositoryError('saveCalendarFeedTokenHash', error)
}

export const removeCalendarFeed = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase.from('calendar_feeds').delete().eq('user_id', userId)
  if (error) throw toRepositoryError('removeCalendarFeed', error)
}

export const findCalendarFeedOwnerUserId = async (
  serviceRoleSupabase: FreeclutchSupabaseClient,
  tokenHash: string,
): Promise<string | null> => {
  const { data, error } = await serviceRoleSupabase
    .from('calendar_feeds')
    .select('user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw toRepositoryError('findCalendarFeedOwnerUserId', error)
  return data?.user_id ?? null
}
