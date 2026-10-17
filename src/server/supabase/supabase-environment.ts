import 'server-only'

type SupabaseEnvironmentVariableName = 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'

export const readSupabaseEnvironmentVariable = (variableName: SupabaseEnvironmentVariableName): string => {
  const variableValue = process.env[variableName]
  if (!variableValue) throw new Error(`Missing environment variable ${variableName}`)
  return variableValue
}
