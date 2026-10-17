import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'

export const POSTGRES_FOREIGN_KEY_VIOLATION_CODE = '23503'
export const POSTGRES_UNIQUE_VIOLATION_CODE = '23505'

export const toRepositoryError = (operationName: string, postgrestError: PostgrestError): Error =>
  new Error(`Repository operation ${operationName} failed with code ${postgrestError.code}`)
