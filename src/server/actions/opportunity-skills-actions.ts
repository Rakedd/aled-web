'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { CV_MESSAGES } from '@/domain/cv-library'
import { rejectWith, validateUuid } from '@/domain/input-validation'
import { OPPORTUNITY_MATCH_MESSAGES, OPPORTUNITY_SKILLS_AI_ERROR_MESSAGES } from '@/domain/opportunity-match'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractCvSkills } from '@/server/ai/extract-cv-skills'
import { findCvRow, findCvVersionForTechnicalBrief } from '@/server/repositories/cvs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const extractSkillsWithoutThrowing = async (decryptedApiKey: string, cvPdfBase64: string): Promise<ActionResult<string[]>> => {
  try {
    return { ok: true, data: await extractCvSkills(createAnthropicClient(decryptedApiKey), cvPdfBase64) }
  } catch (extractionError) {
    const aiErrorLogContext = describeAiErrorForLogs(extractionError)
    console.error('CV skills extraction failed', aiErrorLogContext)
    return rejectWith(OPPORTUNITY_SKILLS_AI_ERROR_MESSAGES[aiErrorLogContext.aiErrorKind])
  }
}

export const extractSkillsFromCv = async (cvId: string): Promise<ActionResult<string[]>> =>
  runAuthenticatedOperation({
    operationName: 'extractSkillsFromCv',
    failureMessage: OPPORTUNITY_MATCH_MESSAGES.extractionFailure,
    validateArguments: () => validateUuid(cvId, CV_MESSAGES.cvNotFound),
    operation: async (supabase, userId, validatedCvId) => {
      const decryptedApiKey = await getDecryptedAnthropicApiKeyForUser(userId)
      if (decryptedApiKey === null) return rejectWith(OPPORTUNITY_SKILLS_AI_ERROR_MESSAGES.missing_api_key)
      const cvRowResult = await findCvRow(supabase, userId, validatedCvId)
      if (!cvRowResult.ok) return cvRowResult
      if (cvRowResult.data.currentVersionId === null) return rejectWith(CV_MESSAGES.cvVersionNotFound)
      const cvVersionResult = await findCvVersionForTechnicalBrief(supabase, userId, cvRowResult.data.currentVersionId)
      if (!cvVersionResult.ok) return cvVersionResult
      return extractSkillsWithoutThrowing(decryptedApiKey, cvVersionResult.data.pdfBase64)
    },
  })
