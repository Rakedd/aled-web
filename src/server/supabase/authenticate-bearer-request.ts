import 'server-only'
import { createBearerSupabaseClient } from './create-bearer-supabase-client'
import type { FreeclutchSupabaseClient } from './freeclutch-supabase-client'

export type BearerAuthentication = { supabase: FreeclutchSupabaseClient; userId: string }

const BEARER_AUTHORIZATION_PATTERN = /^Bearer (\S+)$/

export const authenticateBearerRequest = async (request: Request): Promise<BearerAuthentication | null> => {
  const accessToken = request.headers.get('authorization')?.match(BEARER_AUTHORIZATION_PATTERN)?.[1]
  if (!accessToken) return null

  const supabase = createBearerSupabaseClient(accessToken)
  const { data, error } = await supabase.auth.getClaims(accessToken)
  const userId = data?.claims.sub
  if (error || !userId) return null

  return { supabase, userId }
}
