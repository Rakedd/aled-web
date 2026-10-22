import type { ActionResult } from './action-result'
import {
  ACTIVITY_LOG_VALIDATION_MESSAGES,
  type ActivityLogEntryInput,
  validateActivityLogEntryInput,
} from './activity-log'
import {
  type ContactDetails,
  MAXIMUM_ENTITY_NAME_LENGTH,
  validateContactDetailsInput,
  validateOptionalEntityName,
} from './entities'
import { isRecord, rejectWith, validateOptionalText, validateUuid } from './input-validation'
import type { JobApplicationStatus } from './job-application-status'
import type { ActivityKind, IntermediaryKind } from './types'

export type ContactDetailFieldName = 'phone' | 'email' | 'linkedinUrl'

export type ContactDetailValues = Pick<ContactDetails, ContactDetailFieldName>

export type ContactListItem = {
  id: string
  fullName: string
  intermediaryId: string | null
  intermediaryName: string | null
  phone: string | null
  email: string | null
  linkedinUrl: string | null
  lastExchangeAt: Date | null
  proposedMissionCount: number
}

export type IntermediaryListItem = {
  id: string
  name: string
  kind: IntermediaryKind | null
  contactCount: number
  proposedMissionCount: number
  lastExchangeAt: Date | null
}

export type ContactProfile = ContactDetails & {
  intermediaryId: string | null
  intermediaryName: string | null
  referredBy: string | null
  notes: string | null
}

export type ContactProfileInput = {
  fullName: string
  phone: string | null
  email: string | null
  linkedinUrl: string | null
  intermediaryName: string | null
  referredBy: string | null
  notes: string | null
}

export type Exchange = {
  id: string
  occurredAt: Date
  kind: ActivityKind
  summary: string
  jobApplicationId: string | null
  jobApplicationTitle: string | null
  contactId: string | null
  contactName: string | null
}

export type ProposedMission = {
  jobApplicationId: string
  title: string
  appliedOn: Date
  endClientLabel: string | null
  contactName: string | null
  status: JobApplicationStatus
  sentCvLabel: string | null
  sentCvUploadedAt: Date | null
}

export type ContactExchangeInput = ActivityLogEntryInput & {
  jobApplicationId: string | null
}

export type ContactPageData = {
  profile: ContactProfile
  proposedMissions: ProposedMission[]
  exchanges: Exchange[]
}

export type IntermediaryPageData = {
  intermediary: IntermediaryListItem
  contacts: ContactListItem[]
  exchanges: Exchange[]
  proposedMissions: ProposedMission[]
}

export const MAXIMUM_CONTACT_NOTES_LENGTH = 10_000
export const MAXIMUM_REFERRED_BY_LENGTH = 200

export const CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE = "Cette candidature n'est pas liée à ce contact"

const CONTACT_DETAIL_FIELD_NAMES: readonly ContactDetailFieldName[] = ['phone', 'email', 'linkedinUrl']

const INVALID_EDITED_FIELDS_MESSAGE = 'Champs modifiés invalides'
const INVALID_INTERMEDIARY_NAME_MESSAGE = 'Agence invalide'
const INVALID_REFERRED_BY_MESSAGE = 'Recommandé par invalide'
const INVALID_NOTES_MESSAGE = 'Notes invalides'

export const validateContactProfileInput = (candidate: unknown): ActionResult<ContactProfileInput> => {
  const contactDetailsValidation = validateContactDetailsInput(candidate)
  if (!contactDetailsValidation.ok) return contactDetailsValidation
  if (!isRecord(candidate)) return rejectWith(INVALID_INTERMEDIARY_NAME_MESSAGE)
  const intermediaryNameValidation = validateOptionalEntityName(
    candidate.intermediaryName ?? null,
    { label: 'Agence', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH },
    INVALID_INTERMEDIARY_NAME_MESSAGE,
  )
  if (!intermediaryNameValidation.ok) return intermediaryNameValidation
  const referredByValidation = validateOptionalText(
    candidate.referredBy ?? null,
    { label: 'Recommandé par', maximumLength: MAXIMUM_REFERRED_BY_LENGTH },
    INVALID_REFERRED_BY_MESSAGE,
  )
  if (!referredByValidation.ok) return referredByValidation
  const notesValidation = validateOptionalText(
    candidate.notes ?? null,
    { label: 'Notes', maximumLength: MAXIMUM_CONTACT_NOTES_LENGTH },
    INVALID_NOTES_MESSAGE,
  )
  if (!notesValidation.ok) return notesValidation
  return {
    ok: true,
    data: {
      ...contactDetailsValidation.data,
      intermediaryName: intermediaryNameValidation.data,
      referredBy: referredByValidation.data,
      notes: notesValidation.data,
    },
  }
}

export const validateContactExchangeInput = (candidate: unknown, now: Date): ActionResult<ContactExchangeInput> => {
  const activityLogEntryValidation = validateActivityLogEntryInput(candidate, now)
  if (!activityLogEntryValidation.ok) return activityLogEntryValidation
  if (!isRecord(candidate)) return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.malformedPayload)
  if (candidate.jobApplicationId === null) {
    return {
      ok: true,
      data: { ...activityLogEntryValidation.data, jobApplicationId: null },
    }
  }
  const jobApplicationIdValidation = validateUuid(
    candidate.jobApplicationId,
    ACTIVITY_LOG_VALIDATION_MESSAGES.malformedPayload,
  )
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  return {
    ok: true,
    data: {
      ...activityLogEntryValidation.data,
      jobApplicationId: jobApplicationIdValidation.data,
    },
  }
}

export const validateUserEditedContactFields = (candidate: unknown): ActionResult<ContactDetailFieldName[]> => {
  if (!Array.isArray(candidate)) return rejectWith(INVALID_EDITED_FIELDS_MESSAGE)
  const editedFieldNames: ContactDetailFieldName[] = []
  for (const candidateFieldName of candidate) {
    const matchingFieldName = CONTACT_DETAIL_FIELD_NAMES.find((fieldName) => fieldName === candidateFieldName)
    if (!matchingFieldName) return rejectWith(INVALID_EDITED_FIELDS_MESSAGE)
    editedFieldNames.push(matchingFieldName)
  }
  return { ok: true, data: editedFieldNames }
}

export const mergeContactDetailValues = (
  currentValues: ContactDetailValues,
  submittedValues: ContactDetailValues,
  userEditedFields: readonly ContactDetailFieldName[],
): Partial<ContactDetailValues> => {
  const mergedValues: Partial<ContactDetailValues> = {}
  for (const fieldName of CONTACT_DETAIL_FIELD_NAMES) {
    const submittedValue = submittedValues[fieldName]
    if (submittedValue === null) continue
    if (userEditedFields.includes(fieldName) || currentValues[fieldName] === null) {
      mergedValues[fieldName] = submittedValue
    }
  }
  return mergedValues
}
