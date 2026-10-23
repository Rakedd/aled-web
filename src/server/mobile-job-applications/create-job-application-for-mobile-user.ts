import 'server-only'
import { type CallApiResult, toCallApiError } from '@/domain/call-log'
import type { JobApplicationInput } from '@/domain/job-application'
import type { CreatedJobApplication } from '@/domain/mobile-job-application-request'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export const createJobApplicationForMobileUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: JobApplicationInput,
): Promise<CallApiResult<CreatedJobApplication>> => {
  const insertionResult = await insertJobApplication(supabase, userId, input)
  if (!insertionResult.ok) return { ok: false, error: toCallApiError('rejected', insertionResult.errorMessage) }
  return { ok: true, data: { jobApplicationId: insertionResult.data.id } }
}
