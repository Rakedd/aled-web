import 'server-only'
import { type CallApiResult, toCallApiError } from '@/domain/call-log'
import type { JobPostingExtraction } from '@/domain/job-posting-extraction'
import { MOBILE_JOB_POSTING_AI_ERROR_MESSAGES } from '@/domain/mobile-job-application-request'
import { describeAiErrorForLogs, toAiErrorKind } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobPosting, type JobPostingExtractionRequestLimits } from '@/server/ai/extract-job-posting'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { findEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export const MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS: JobPostingExtractionRequestLimits = {
  timeoutInMilliseconds: 50_000,
  maxRetries: 0,
}

export const extractJobPostingForMobileUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  rawText: string,
): Promise<CallApiResult<JobPostingExtraction>> => {
  const encryptedApiKey = await findEncryptedAnthropicApiKey(supabase, userId)
  if (encryptedApiKey === null) {
    return { ok: false, error: toCallApiError('missing_api_key', MOBILE_JOB_POSTING_AI_ERROR_MESSAGES.missing_api_key) }
  }
  try {
    const apiKey = decryptApiKey(encryptedApiKey, readApiKeyEncryptionSecret())
    const extraction = await extractJobPosting(
      createAnthropicClient(apiKey),
      rawText,
      MOBILE_JOB_POSTING_EXTRACTION_REQUEST_LIMITS,
    )
    return { ok: true, data: extraction }
  } catch (error) {
    console.error('Mobile job posting extraction failed', describeAiErrorForLogs(error))
    const aiErrorKind = toAiErrorKind(error)
    return { ok: false, error: toCallApiError(aiErrorKind, MOBILE_JOB_POSTING_AI_ERROR_MESSAGES[aiErrorKind]) }
  }
}
