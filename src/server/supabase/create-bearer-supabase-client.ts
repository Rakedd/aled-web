import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database-types'
import type { FreeclutchSupabaseClient } from './freeclutch-supabase-client'
import { readSupabaseEnvironmentVariable } from './supabase-environment'

export const createBearerSupabaseClient = (accessToken: string): FreeclutchSupabaseClient =>
  createClient<Database>(
    readSupabaseEnvironmentVariable('SUPABASE_URL'),
    readSupabaseEnvironmentVariable('SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )
