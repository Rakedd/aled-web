import 'server-only'
import type { ActivityLogEntry } from '@/domain/activity-log'
import { type CallApiResult, toCallApiError } from '@/domain/call-log'
import type { ContactDetails } from '@/domain/entities'
import {
  canDraftFollowUp,
  FOLLOW_UP_AI_ERROR_MESSAGES,
  FOLLOW_UP_MESSAGES,
  type FollowUpMessageDraft,
  type FollowUpMessageRequest,
  toExternalLinkUrlOrNull,
} from '@/domain/follow-up-message'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { JOB_APPLICATION_STATUS_LABELS } from '@/domain/job-application-status'
import { describeAiErrorForLogs, toAiErrorKind } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import {
  type FollowUpMessageInput,
  type GeneratedFollowUpMessage,
  generateFollowUpMessage,
} from '@/server/ai/generate-follow-up-message'
import { decryptApiKey, readApiKeyEncryptionSecret } from '@/server/crypto/api-key-encryption'
import { listActivityLogEntriesForJobApplication } from '@/server/repositories/activity-log-repository'
import { findContactDetails } from '@/server/repositories/entities-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { findEncryptedAnthropicApiKey, findProfileSettings } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type FollowUpMessageDependencies = {
  decryptApiKey: (encryptedApiKey: string) => string
  generateFollowUpMessage: (apiKey: string, followUpMessageInput: FollowUpMessageInput) => Promise<GeneratedFollowUpMessage>
}

export const createFollowUpMessageDependencies = (): FollowUpMessageDependencies => ({
  decryptApiKey: (encryptedApiKey) => decryptApiKey(encryptedApiKey, readApiKeyEncryptionSecret()),
  generateFollowUpMessage: (apiKey, followUpMessageInput) =>
    generateFollowUpMessage(createAnthropicClient(apiKey), followUpMessageInput),
})

const findContactDetailsOrNull = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  contactId: string | null,
): Promise<ContactDetails | null> => {
  if (contactId === null) return null
  const contactDetailsResult = await findContactDetails(supabase, userId, contactId)
  return contactDetailsResult.ok ? contactDetailsResult.data : null
}

const listActivityLogEntriesOrEmpty = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActivityLogEntry[]> => {
  const activityLogEntriesResult = await listActivityLogEntriesForJobApplication(supabase, userId, jobApplicationId)
  return activityLogEntriesResult.ok ? activityLogEntriesResult.data : []
}

const runFollowUpMessageGeneration = async (
  dependencies: FollowUpMessageDependencies,
  encryptedApiKey: string,
  followUpMessageInput: FollowUpMessageInput,
): Promise<CallApiResult<GeneratedFollowUpMessage>> => {
  try {
    const apiKey = dependencies.decryptApiKey(encryptedApiKey)
    return { ok: true, data: await dependencies.generateFollowUpMessage(apiKey, followUpMessageInput) }
  } catch (error) {
    console.error('Follow up message drafting failed', describeAiErrorForLogs(error))
    const aiErrorKind = toAiErrorKind(error)
    return { ok: false, error: toCallApiError(aiErrorKind, FOLLOW_UP_AI_ERROR_MESSAGES[aiErrorKind]) }
  }
}

export const draftFollowUpMessage = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { jobApplicationId, formality }: FollowUpMessageRequest,
  dependencies: FollowUpMessageDependencies,
): Promise<CallApiResult<FollowUpMessageDraft>> => {
  const jobApplicationResult = await findJobApplicationOverview(supabase, userId, jobApplicationId)
  if (!jobApplicationResult.ok) {
    return { ok: false, error: toCallApiError('not_found', JOB_APPLICATION_NOT_FOUND_MESSAGE) }
  }
  const jobApplication = jobApplicationResult.data
  if (!canDraftFollowUp(jobApplication.status)) {
    return { ok: false, error: toCallApiError('invalid_request', FOLLOW_UP_MESSAGES.closedJobApplication) }
  }
  const encryptedApiKey = await findEncryptedAnthropicApiKey(supabase, userId)
  if (encryptedApiKey === null) {
    return { ok: false, error: toCallApiError('missing_api_key', FOLLOW_UP_AI_ERROR_MESSAGES.missing_api_key) }
  }
  const [contactDetails, activityLogEntries, profileSettings] = await Promise.all([
    findContactDetailsOrNull(supabase, userId, jobApplication.contactId),
    listActivityLogEntriesOrEmpty(supabase, userId, jobApplicationId),
    findProfileSettings(supabase, userId),
  ])
  const generationResult = await runFollowUpMessageGeneration(dependencies, encryptedApiKey, {
    formality,
    missionTitle: jobApplication.title,
    statusLabel: JOB_APPLICATION_STATUS_LABELS[jobApplication.status],
    endClientName: jobApplication.endClientName,
    intermediaryName: jobApplication.intermediaryName,
    contactName: jobApplication.contactName,
    appliedOn: jobApplication.appliedOn,
    lastActivityAt: jobApplication.lastActivityAt,
    recentActivities: activityLogEntries.map(({ occurredAt, kind, summary }) => ({ occurredAt, kind, summary })),
    userFirstName: profileSettings.firstName,
  })
  if (!generationResult.ok) return generationResult
  return {
    ok: true,
    data: {
      ...generationResult.data,
      contactEmail: contactDetails?.email ?? null,
      contactLinkedinUrl: toExternalLinkUrlOrNull(contactDetails?.linkedinUrl ?? null),
    },
  }
}
