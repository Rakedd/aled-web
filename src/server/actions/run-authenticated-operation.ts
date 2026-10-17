import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

export const NO_ARGUMENTS: ActionResult<null> = { ok: true, data: null }

type AuthenticatedOperationOptions<ValidatedArguments, OperationData> = {
  operationName: string
  failureMessage: string
  validateArguments: () => ActionResult<ValidatedArguments>
  operation: (
    supabase: FreeclutchSupabaseClient,
    userId: string,
    validatedArguments: ValidatedArguments,
  ) => Promise<ActionResult<OperationData>>
}

export const runAuthenticatedOperation = async <ValidatedArguments, OperationData>({
  operationName,
  failureMessage,
  validateArguments,
  operation,
}: AuthenticatedOperationOptions<ValidatedArguments, OperationData>): Promise<ActionResult<OperationData>> => {
  const authenticatedUser = await getAuthenticatedUser()
  const argumentsValidation = validateArguments()
  if (!argumentsValidation.ok) return argumentsValidation
  try {
    const supabase = await createServerSupabaseClient()
    return await operation(supabase, authenticatedUser.id, argumentsValidation.data)
  } catch (operationError) {
    console.error(`Action ${operationName} failed`, {
      errorMessage: operationError instanceof Error ? operationError.message : typeof operationError,
    })
    return { ok: false, errorMessage: failureMessage }
  }
}
