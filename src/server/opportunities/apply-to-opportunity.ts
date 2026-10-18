import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import { validateJobApplicationInput } from '@/domain/job-application'
import {
  buildJobApplicationInputFromOpportunity,
  mergeStackItems,
  OPPORTUNITY_VALIDATION_MESSAGES,
} from '@/domain/opportunities'
import { formatParisCalendarDate, parseParisCalendarDate } from '@/domain/paris-time'
import type { StackItem } from '@/domain/types'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobSpecStack, type JobSpecStackRequestOptions } from '@/server/ai/extract-job-spec-stack'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import { findOpportunity } from '@/server/repositories/opportunities-repository'
import {
  findOpportunityDecision,
  upsertOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { extractOpportunityStack } from './extract-opportunity-stack'

type AppliedOpportunity = { jobApplicationId: string }

const STACK_EXTRACTION_REQUEST_OPTIONS: JobSpecStackRequestOptions = { maxRetries: 1, timeout: 30_000 }

const describeError = (unknownError: unknown): string =>
  unknownError instanceof Error ? unknownError.message : typeof unknownError

const recordAppliedDecision = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  opportunityId: string,
  jobApplicationId: string,
): Promise<void> => {
  try {
    const decisionResult = await upsertOpportunityDecision(supabase, userId, {
      opportunityId,
      decision: 'applied',
      jobApplicationId,
    })
    if (!decisionResult.ok) {
      console.error('Applied opportunity decision was not recorded', {
        opportunityId,
        errorMessage: decisionResult.errorMessage,
      })
    }
  } catch (decisionError) {
    console.error('Applied opportunity decision was not recorded', {
      opportunityId,
      errorMessage: describeError(decisionError),
    })
  }
}

const extractPostingStackForUser = (userId: string, description: string | null): Promise<StackItem[]> =>
  extractOpportunityStack(
    {
      getApiKey: () => getDecryptedAnthropicApiKeyForUser(userId),
      extract: (apiKey, descriptionText) =>
        extractJobSpecStack(
          createAnthropicClient(apiKey),
          { kind: 'text', text: descriptionText },
          STACK_EXTRACTION_REQUEST_OPTIONS,
        ),
    },
    description,
  )

export const applyToOpportunityForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  opportunityId: string,
  now: Date,
): Promise<ActionResult<AppliedOpportunity>> => {
  const [existingDecision, opportunity] = await Promise.all([
    findOpportunityDecision(supabase, userId, opportunityId),
    findOpportunity(supabase, opportunityId),
  ])
  if (existingDecision?.decision === 'applied' && existingDecision.jobApplicationId !== null) {
    return { ok: true, data: { jobApplicationId: existingDecision.jobApplicationId } }
  }
  if (opportunity === null) return rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.notFound)
  const parisToday = parseParisCalendarDate(formatParisCalendarDate(now))
  const opportunityInput = buildJobApplicationInputFromOpportunity(opportunity, parisToday)
  const extractedStack = await extractPostingStackForUser(userId, opportunityInput.postingRawText)
  const inputValidation = validateJobApplicationInput({
    ...opportunityInput,
    stack: mergeStackItems(opportunityInput.stack, extractedStack),
  })
  if (!inputValidation.ok) return inputValidation
  const jobApplicationCreation = await insertJobApplication(supabase, userId, inputValidation.data)
  if (!jobApplicationCreation.ok) return jobApplicationCreation
  const jobApplicationId = jobApplicationCreation.data.id
  await recordAppliedDecision(supabase, userId, opportunityId, jobApplicationId)
  return { ok: true, data: { jobApplicationId } }
}
