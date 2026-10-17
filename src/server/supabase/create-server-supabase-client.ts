import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database-types'
import { readSupabaseEnvironmentVariable } from './supabase-environment'

export const createServerSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    readSupabaseEnvironmentVariable('SUPABASE_URL'),
    readSupabaseEnvironmentVariable('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    },
  )
}
