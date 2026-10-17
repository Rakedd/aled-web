import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database-types'
import { readSupabaseEnvironmentVariable } from './supabase-environment'

export const createServiceRoleSupabaseClient = (): SupabaseClient<Database> =>
  createClient<Database>(
    readSupabaseEnvironmentVariable('SUPABASE_URL'),
    readSupabaseEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
