'use server'

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { ActionResult } from '@/domain/action-result'
import { AI_ERROR_MESSAGES, type AiErrorKind } from '@/domain/ai-errors'
import { type JobPostingExtraction, MAX_PASTED_TEXT_LENGTH } from '@/domain/job-posting-extraction'
import { toAiErrorKind } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobPosting } from '@/server/ai/extract-job-posting'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

const failWithAiErrorKind = (aiErrorKind: AiErrorKind): ActionResult<never> => ({
  ok: false,
  errorMessage: AI_ERROR_MESSAGES[aiErrorKind],
})

const readHttpStatus = (error: unknown): number | null =>
  error instanceof Anthropic.APIError && error.status !== undefined ? error.status : null

const readErrorName = (error: unknown): string => (error instanceof Error ? error.constructor.name : typeof error)

export const extractJobPostingForCurrentUser = async (
  rawText: string,
): Promise<ActionResult<JobPostingExtraction>> => {
  const pastedText = typeof rawText === 'string' ? rawText.trim() : ''
  if (pastedText.length > MAX_PASTED_TEXT_LENGTH) return failWithAiErrorKind('input_too_long')
  if (pastedText.length === 0) return failWithAiErrorKind('unknown')
  const authenticatedUser = await getAuthenticatedUser()
  try {
    const decryptedApiKey = await getDecryptedAnthropicApiKeyForUser(authenticatedUser.id)
    if (decryptedApiKey === null) return failWithAiErrorKind('missing_api_key')
    return { ok: true, data: await extractJobPosting(createAnthropicClient(decryptedApiKey), pastedText) }
  } catch (extractionError) {
    const aiErrorKind = toAiErrorKind(extractionError)
    console.error('Job posting extraction failed', {
      aiErrorKind,
      httpStatus: readHttpStatus(extractionError),
      errorName: readErrorName(extractionError),
    })
    return failWithAiErrorKind(aiErrorKind)
  }
}
