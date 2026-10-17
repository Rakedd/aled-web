import 'server-only'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './create-server-supabase-client'

export type AuthenticatedUser = { id: string; email: string }

export const getAuthenticatedUser = async (): Promise<AuthenticatedUser> => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  const userEmail = data?.claims.email

  if (!userId || !userEmail) redirect('/login')

  return { id: userId, email: userEmail }
}
