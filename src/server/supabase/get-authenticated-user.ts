import 'server-only'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './create-server-supabase-client'
import type { FreeclutchSupabaseClient } from './freeclutch-supabase-client'

export type AuthenticatedUser = { id: string; email: string }

export const findAuthenticatedUser = async (supabase: FreeclutchSupabaseClient): Promise<AuthenticatedUser | null> => {
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  const userEmail = data?.claims.email
  return userId && userEmail ? { id: userId, email: userEmail } : null
}

export const getAuthenticatedUser = async (): Promise<AuthenticatedUser> => {
  const authenticatedUser = await findAuthenticatedUser(await createServerSupabaseClient())
  if (authenticatedUser === null) redirect('/login')
  return authenticatedUser
}
