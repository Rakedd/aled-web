import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/server/supabase/database-types'

const TEST_CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } }

const readRequiredEnvironmentVariable = (variableName: string): string => {
  const variableValue = process.env[variableName]
  if (!variableValue) throw new Error(`Missing environment variable ${variableName}, is local Supabase running?`)
  return variableValue
}

export const createServiceRoleTestClient = (): SupabaseClient<Database> =>
  createClient<Database>(
    readRequiredEnvironmentVariable('SUPABASE_URL'),
    readRequiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    TEST_CLIENT_OPTIONS,
  )

export const createSignedInTestClient = async (
  email: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> => {
  const password = randomUUID()
  const { data: createdUserData, error: userCreationError } = await createServiceRoleTestClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userCreationError) throw userCreationError

  const client = createClient<Database>(
    readRequiredEnvironmentVariable('SUPABASE_URL'),
    readRequiredEnvironmentVariable('SUPABASE_ANON_KEY'),
    TEST_CLIENT_OPTIONS,
  )
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { client, userId: createdUserData.user.id }
}
