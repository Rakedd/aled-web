import type { ActionResult } from './action-result'
import { ACTIVITY_LOG_VALIDATION_MESSAGES } from './activity-log'
import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import {
  type ContactDetailFieldName,
  type ContactDetailValues,
  type ContactProfileInput,
  validateContactExchangeInput,
  validateContactProfileInput,
  validateUserEditedContactFields,
} from './contacts'
import {
  ENTITY_NOT_FOUND_MESSAGES,
  ENTITY_VALIDATION_MESSAGES,
  MAXIMUM_PHONE_LENGTH,
  validateContactDetailValues,
} from './entities'
import {
  isRecord,
  isUuid,
  isValidDate,
  rejectWith,
  validateOptionalText,
  validateRequiredText,
  validateUuid,
} from './input-validation'
import {
  JOB_APPLICATION_VALIDATION_MESSAGES,
  type JobApplicationInput,
  validateJobApplicationInput,
} from './job-application'
import { type JobApplicationStatus, PIPELINE_STATUSES } from './job-application-status'
import type { StackItem } from './types'

export const CALL_NOTE_MAX_LENGTH = 3_000
export const CALL_JOB_APPLICATION_SOURCE = 'Appel'

export const CALL_OUTCOMES = ['cv_submitted', 'interview_scheduled', 'declined', 'discussed'] as const

export type CallOutcome = (typeof CALL_OUTCOMES)[number]

export const CALL_OUTCOME_STATUSES: Record<CallOutcome, JobApplicationStatus> = {
  cv_submitted: 'cv_submitted',
  interview_scheduled: 'interview_scheduled',
  declined: 'ko_after_contact',
  discussed: 'intermediary_contact',
}

export const CALL_JOB_APPLICATION_STATUSES: readonly JobApplicationStatus[] = [
  ...PIPELINE_STATUSES,
  'ko_after_contact',
]

export const CALL_LOG_MESSAGES = {
  missingApiKey: "Ajoute ta clé Claude dans les préférences de l'app web pour utiliser l'IA. Tu peux aussi noter l'appel sans IA.",
  aiFailed: "L'IA n'a pas pu analyser l'appel. Ton texte est gardé : réessaie ou note-le sans IA.",
  draftFailed: "Impossible de préparer l'appel pour le moment. Ton texte est gardé : réessaie ou note-le sans IA.",
  saveFailed: "Impossible d'enregistrer l'appel pour le moment. Ce que tu as saisi est gardé : réessaie.",
  missingCallNote: "Raconte l'appel en quelques mots.",
  malformedRequest: 'Appel invalide',
  missingContactChoice: 'Choisis un contact ou crée-en un.',
  unauthorized: 'Ta session a expiré. Reconnecte-toi puis réessaie.',
  network: 'Pas de connexion. Ce que tu as saisi est gardé : réessaie dans un instant.',
  unexpectedResponse: 'Réponse inattendue du serveur. Ce que tu as saisi est gardé : réessaie.',
} as const

export type CallNoteExtraction = {
  contactName: string | null
  intermediaryName: string | null
  contactPhone: string | null
  contactEmail: string | null
  summary: string
  missionProposed: boolean
  missionTitle: string | null
  endClientName: string | null
  dailyRate: number | null
  location: string | null
  remotePolicy: string | null
  desiredStart: string | null
  duration: string | null
  stack: StackItem[]
  outcome: CallOutcome
  cvLabel: string | null
}

export type CallContactCandidate = {
  id: string
  fullName: string
  intermediaryName: string | null
  phone: string | null
}

export type CallJobApplicationFields = {
  title: string | null
  endClientName: string | null
  intermediaryName: string | null
  postedDailyRate: number | null
  location: string | null
  remotePolicy: string | null
  desiredStart: string | null
  duration: string | null
  stack: StackItem[]
  status: JobApplicationStatus
  cvId: string | null
}

export type CallDraft = {
  contact: {
    candidates: CallContactCandidate[]
    suggestedContactId: string | null
    fullName: string | null
    intermediaryName: string | null
    phone: string | null
    email: string | null
  }
  exchange: { summary: string; occurredAt: string }
  jobApplication: CallJobApplicationFields | null
}

export type CallDraftRequest = { text: string; phone: string | null; contactId: string | null; occurredAt: string }

export type CallDraftInput = Omit<CallDraftRequest, 'occurredAt'> & { occurredAt: Date }

export type RecordCallJobApplication = Omit<CallJobApplicationFields, 'title'> & { title: string }

export type RecordCallRequest = {
  contact: { id: string } | { new: ContactProfileInput }
  contactDetails: ContactDetailValues
  userEditedContactFields: ContactDetailFieldName[]
  exchange: { summary: string; occurredAt: string }
  jobApplication: RecordCallJobApplication | null
  existingJobApplicationId?: string | null
}

export type RecordCallInput = {
  contact: { kind: 'existing'; contactId: string } | { kind: 'new'; profile: ContactProfileInput }
  contactDetails: ContactDetailValues
  userEditedContactFields: ContactDetailFieldName[]
  exchange: { summary: string; occurredAt: Date }
  jobApplication: { input: JobApplicationInput; sentCvId: string | null } | null
  existingJobApplicationId: string | null
}

export type RecordCallResult = { contactId: string; jobApplicationId: string | null }

export type CallApiErrorKind =
  | AiErrorKind
  | 'unauthorized'
  | 'invalid_request'
  | 'not_found'
  | 'rejected'
  | 'save_failed'
  | 'network'
  | 'unexpected_response'

export type ServerCallApiErrorKind = Exclude<CallApiErrorKind, 'network' | 'unexpected_response'>

export type CallApiError = {
  kind: CallApiErrorKind
  message: string
  createdContactId: string | null
  createdJobApplicationId: string | null
}

export type CallApiResult<Data> = { ok: true; data: Data } | { ok: false; error: CallApiError }

export const toCallApiError = (kind: CallApiErrorKind, message: string): CallApiError => ({
  kind,
  message,
  createdContactId: null,
  createdJobApplicationId: null,
})

export const toCallDraftAiErrorMessage = (aiErrorKind: AiErrorKind): string => {
  if (aiErrorKind === 'missing_api_key') return CALL_LOG_MESSAGES.missingApiKey
  if (aiErrorKind === 'refused' || aiErrorKind === 'unknown' || aiErrorKind === 'input_too_long') {
    return CALL_LOG_MESSAGES.aiFailed
  }
  return AI_ERROR_MESSAGES[aiErrorKind]
}

const PHONE_NUMBER_PATTERN = /^[\s(]*\+?[\d\s.\-()]+$/
const MINIMUM_PHONE_DIGIT_COUNT = 8
const MAXIMUM_PHONE_DIGIT_COUNT = 15
const CALL_NOTE_TEXT_FIELD_RULE = { label: "Récit de l'appel", maximumLength: CALL_NOTE_MAX_LENGTH }
const CLOCK_DIFFERENCE_TOLERANCE_IN_MILLISECONDS = 5 * 60 * 1000

export const looksLikePhoneNumber = (text: string): boolean => {
  const trimmedText = text.trim()
  if (trimmedText.length > MAXIMUM_PHONE_LENGTH || !PHONE_NUMBER_PATTERN.test(trimmedText)) return false
  const digitCount = trimmedText.replace(/\D/g, '').length
  return digitCount >= MINIMUM_PHONE_DIGIT_COUNT && digitCount <= MAXIMUM_PHONE_DIGIT_COUNT
}

const parseOccurredAt = (candidate: unknown, now: Date): ActionResult<Date> => {
  const occurredAt = typeof candidate === 'string' ? new Date(candidate) : null
  if (!isValidDate(occurredAt)) return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.invalidOccurredAt)
  if (occurredAt.getTime() > now.getTime() + CLOCK_DIFFERENCE_TOLERANCE_IN_MILLISECONDS) {
    return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.futureOccurredAt)
  }
  return { ok: true, data: occurredAt }
}

export const validateCallDraftRequest = (candidate: unknown, now: Date): ActionResult<CallDraftInput> => {
  if (!isRecord(candidate)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const textValidation = validateRequiredText(candidate.text, CALL_NOTE_TEXT_FIELD_RULE, CALL_LOG_MESSAGES.missingCallNote)
  if (!textValidation.ok) return textValidation
  const phoneValidation = validateOptionalText(
    candidate.phone,
    { label: 'Téléphone', maximumLength: MAXIMUM_PHONE_LENGTH },
    ENTITY_VALIDATION_MESSAGES.invalidPhone,
  )
  if (!phoneValidation.ok) return phoneValidation
  const contactIdValidation =
    candidate.contactId === null ? { ok: true as const, data: null } : validateUuid(candidate.contactId, ENTITY_NOT_FOUND_MESSAGES.contact)
  if (!contactIdValidation.ok) return contactIdValidation
  const occurredAtValidation = parseOccurredAt(candidate.occurredAt, now)
  if (!occurredAtValidation.ok) return occurredAtValidation
  return {
    ok: true,
    data: {
      text: textValidation.data,
      phone: phoneValidation.data,
      contactId: contactIdValidation.data,
      occurredAt: occurredAtValidation.data,
    },
  }
}

const validateCallContact = (candidate: unknown): ActionResult<RecordCallInput['contact']> => {
  if (!isRecord(candidate)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const hasId = candidate.id !== undefined
  const hasNew = candidate.new !== undefined
  if (hasId === hasNew) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  if (hasId) {
    const contactIdValidation = validateUuid(candidate.id, ENTITY_NOT_FOUND_MESSAGES.contact)
    if (!contactIdValidation.ok) return contactIdValidation
    return { ok: true, data: { kind: 'existing', contactId: contactIdValidation.data } }
  }
  const profileValidation = validateContactProfileInput(candidate.new)
  if (!profileValidation.ok) return profileValidation
  return { ok: true, data: { kind: 'new', profile: profileValidation.data } }
}

const validateCallJobApplication = (
  candidate: unknown,
  occurredAt: Date,
): ActionResult<RecordCallInput['jobApplication']> => {
  if (candidate === null) return { ok: true, data: null }
  if (!isRecord(candidate)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const status = CALL_JOB_APPLICATION_STATUSES.find((callStatus) => callStatus === candidate.status)
  if (!status) return rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidStatus)
  if (candidate.cvId !== null && !isUuid(candidate.cvId)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const jobApplicationValidation = validateJobApplicationInput({
    title: candidate.title,
    source: CALL_JOB_APPLICATION_SOURCE,
    postingUrl: null,
    postingRawText: null,
    status,
    postedDailyRate: candidate.postedDailyRate,
    requestedDailyRate: null,
    location: candidate.location,
    remotePolicy: candidate.remotePolicy,
    desiredStart: candidate.desiredStart,
    duration: candidate.duration,
    appliedOn: occurredAt,
    notes: null,
    actualStartDate: null,
    stack: candidate.stack,
    intermediaryName: candidate.intermediaryName,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    contactLinkedinUrl: null,
    userEditedContactFields: [],
    endClientName: candidate.endClientName,
    endClientParentName: null,
  })
  if (!jobApplicationValidation.ok) return jobApplicationValidation
  return { ok: true, data: { input: jobApplicationValidation.data, sentCvId: candidate.cvId } }
}

const validateExistingJobApplicationId = (
  candidate: unknown,
  contact: RecordCallInput['contact'],
): ActionResult<string | null> => {
  if (candidate === undefined || candidate === null) return { ok: true, data: null }
  if (!isUuid(candidate) || contact.kind !== 'existing') return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  return { ok: true, data: candidate }
}

export const validateRecordCallRequest = (candidate: unknown, now: Date): ActionResult<RecordCallInput> => {
  if (!isRecord(candidate)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const contactValidation = validateCallContact(candidate.contact)
  if (!contactValidation.ok) return contactValidation
  const contactDetailsValidation = validateContactDetailValues(candidate.contactDetails)
  if (!contactDetailsValidation.ok) return contactDetailsValidation
  const userEditedContactFieldsValidation = validateUserEditedContactFields(candidate.userEditedContactFields)
  if (!userEditedContactFieldsValidation.ok) return userEditedContactFieldsValidation
  if (!isRecord(candidate.exchange)) return rejectWith(CALL_LOG_MESSAGES.malformedRequest)
  const occurredAtValidation = parseOccurredAt(candidate.exchange.occurredAt, now)
  if (!occurredAtValidation.ok) return occurredAtValidation
  const exchangeValidation = validateContactExchangeInput(
    {
      kind: 'call',
      summary: candidate.exchange.summary,
      occurredAt: occurredAtValidation.data,
      jobApplicationId: null,
    },
    now,
  )
  if (!exchangeValidation.ok) return exchangeValidation
  const jobApplicationValidation = validateCallJobApplication(candidate.jobApplication, occurredAtValidation.data)
  if (!jobApplicationValidation.ok) return jobApplicationValidation
  const existingJobApplicationIdValidation = validateExistingJobApplicationId(
    candidate.existingJobApplicationId,
    contactValidation.data,
  )
  if (!existingJobApplicationIdValidation.ok) return existingJobApplicationIdValidation
  return {
    ok: true,
    data: {
      contact: contactValidation.data,
      contactDetails: contactDetailsValidation.data,
      userEditedContactFields: userEditedContactFieldsValidation.data,
      exchange: { summary: exchangeValidation.data.summary, occurredAt: occurredAtValidation.data },
      jobApplication: jobApplicationValidation.data,
      existingJobApplicationId: existingJobApplicationIdValidation.data,
    },
  }
}
