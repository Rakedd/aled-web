import 'server-only'
import {
  type CallApiError,
  type RecordCallInput,
  type RecordCallResult,
  CALL_LOG_MESSAGES,
} from '@/domain/call-log'
import { CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE } from '@/domain/contacts'
import { insertContact } from '@/server/repositories/contacts-repository'
import { findCvRow, setSentCvVersion } from '@/server/repositories/cvs-repository'
import { applyContactDetails } from '@/server/repositories/entities-repository'
import { recordContactExchange } from '@/server/repositories/exchanges-repository'
import { findJobApplicationOverview, insertJobApplication } from '@/server/repositories/job-applications-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type RecordCallOutcome = { ok: true; data: RecordCallResult } | { ok: false; error: CallApiError }

type RecordCallStep = 'contact' | 'jobApplication' | 'exchange'

type CreatedIds = { createdContactId: string | null; createdJobApplicationId: string | null }

const toFailure = (kind: 'rejected' | 'save_failed', message: string, createdIds: CreatedIds): RecordCallOutcome => ({
  ok: false,
  error: { kind, message, ...createdIds },
})

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const attachSentCv = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  sentCvId: string | null,
): Promise<void> => {
  if (sentCvId === null) return
  try {
    const cvLookup = await findCvRow(supabase, userId, sentCvId)
    if (!cvLookup.ok || cvLookup.data.currentVersionId === null) return
    await setSentCvVersion(supabase, userId, jobApplicationId, cvLookup.data.currentVersionId)
  } catch (error) {
    console.error('Sent cv attachment failed after a call', { errorMessage: toErrorMessage(error) })
  }
}

const belongsToExistingContact = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: RecordCallInput,
  existingJobApplicationId: string,
): Promise<boolean> => {
  if (input.contact.kind !== 'existing') return false
  const jobApplicationLookup = await findJobApplicationOverview(supabase, userId, existingJobApplicationId)
  return jobApplicationLookup.ok && jobApplicationLookup.data.contactId === input.contact.contactId
}

export const recordCall = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: RecordCallInput,
): Promise<RecordCallOutcome> => {
  const createdIds: CreatedIds = { createdContactId: null, createdJobApplicationId: null }
  let step: RecordCallStep = 'contact'
  try {
    if (
      input.existingJobApplicationId !== null &&
      !(await belongsToExistingContact(supabase, userId, input, input.existingJobApplicationId))
    ) {
      return toFailure('rejected', CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE, createdIds)
    }
    let contactId: string
    let contactFullName: string
    if (input.contact.kind === 'existing') {
      const detailsApplication = await applyContactDetails(
        supabase,
        userId,
        input.contact.contactId,
        input.contactDetails,
        input.userEditedContactFields,
      )
      if (!detailsApplication.ok) return toFailure('rejected', detailsApplication.errorMessage, createdIds)
      contactId = detailsApplication.data.id
      contactFullName = detailsApplication.data.fullName
    } else {
      const contactCreation = await insertContact(supabase, userId, input.contact.profile)
      if (!contactCreation.ok) return toFailure('rejected', contactCreation.errorMessage, createdIds)
      contactId = contactCreation.data.id
      contactFullName = input.contact.profile.fullName
      createdIds.createdContactId = contactId
    }

    step = 'jobApplication'
    let jobApplicationId = input.existingJobApplicationId
    if (jobApplicationId === null && input.jobApplication !== null) {
      const jobApplicationCreation = await insertJobApplication(supabase, userId, {
        ...input.jobApplication.input,
        contactName: contactFullName,
      })
      if (!jobApplicationCreation.ok) return toFailure('rejected', jobApplicationCreation.errorMessage, createdIds)
      jobApplicationId = jobApplicationCreation.data.id
      createdIds.createdJobApplicationId = jobApplicationId
      await attachSentCv(supabase, userId, jobApplicationId, input.jobApplication.sentCvId)
    }

    step = 'exchange'
    const exchangeRecording = await recordContactExchange(supabase, userId, contactId, {
      kind: 'call',
      summary: input.exchange.summary,
      occurredAt: input.exchange.occurredAt,
      jobApplicationId,
    })
    if (!exchangeRecording.ok) return toFailure('rejected', exchangeRecording.errorMessage, createdIds)
    return { ok: true, data: { contactId, jobApplicationId } }
  } catch (error) {
    console.error('Call recording failed', { step, errorMessage: toErrorMessage(error) })
    return toFailure('save_failed', CALL_LOG_MESSAGES.saveFailed, createdIds)
  }
}
