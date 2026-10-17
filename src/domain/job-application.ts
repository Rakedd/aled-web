import type { ActionResult } from './action-result'
import { MAXIMUM_ENTITY_NAME_LENGTH, MAXIMUM_PHONE_LENGTH, validateOptionalEntityName } from './entities'
import {
  type TextFieldRule,
  isRecord,
  isValidDate,
  rejectWith,
  validateOptionalEmailAddress,
  validateOptionalText,
  validateOptionalUrl,
  validateRequiredText,
  validateUuid,
} from './input-validation'
import { isJobApplicationStatus, type JobApplicationStatus } from './job-application-status'
import { MAX_PASTED_TEXT_LENGTH } from './job-posting-extraction'
import { STACK_CATEGORIES, type StackItem, type StackItemOrigin } from './types'

export type JobApplicationOverview = {
  id: string
  userId: string
  title: string
  source: string | null
  postingUrl: string | null
  postingRawText: string | null
  status: JobApplicationStatus
  intermediaryId: string | null
  contactId: string | null
  endClientId: string | null
  postedDailyRate: number | null
  requestedDailyRate: number | null
  location: string | null
  remotePolicy: string | null
  desiredStart: string | null
  duration: string | null
  appliedOn: Date
  notes: string | null
  actualStartDate: Date | null
  stack: StackItem[]
  createdAt: Date
  updatedAt: Date
  lastActivityAt: Date | null
  hasJobSpec: boolean
  intermediaryName: string | null
  contactName: string | null
  endClientName: string | null
  endClientParentName: string | null
  endClientLabel: string | null
}

export type JobApplicationListItem = Omit<JobApplicationOverview, 'postingRawText'>

export type JobApplicationInput = {
  title: string
  source: string | null
  postingUrl: string | null
  postingRawText: string | null
  status: JobApplicationStatus
  postedDailyRate: number | null
  requestedDailyRate: number | null
  location: string | null
  remotePolicy: string | null
  desiredStart: string | null
  duration: string | null
  appliedOn: Date
  notes: string | null
  actualStartDate: Date | null
  stack: StackItem[]
  intermediaryName: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  endClientName: string | null
  endClientParentName: string | null
}

type JobApplicationFieldValidators = {
  [FieldName in keyof JobApplicationInput]: (candidate: unknown) => ActionResult<JobApplicationInput[FieldName]>
}

export const JOB_APPLICATION_NOT_FOUND_MESSAGE = 'Candidature introuvable'

export const JOB_APPLICATION_VALIDATION_MESSAGES = {
  malformedPayload: 'Candidature invalide',
  missingTitle: 'Le titre est obligatoire',
  invalidText: 'Un des champs texte est invalide',
  invalidStatus: 'Statut invalide',
  invalidDailyRate: 'TJM invalide',
  invalidPostingUrl: "Lien de l'annonce invalide",
  invalidAppliedOn: 'Date de candidature invalide',
  invalidActualStartDate: 'Date de démarrage invalide',
  invalidStack: 'Stack invalide',
  invalidContactEmail: 'E-mail invalide',
} as const

const MAXIMUM_DAILY_RATE = 100_000
const MAXIMUM_STACK_ITEM_COUNT = 100
const MAXIMUM_STACK_ITEM_NAME_LENGTH = 100
const POSTING_URL_ALLOWED_PROTOCOLS = ['http:', 'https:']
const STACK_ITEM_ORIGINS: readonly StackItemOrigin[] = ['posting', 'job_spec']

const TEXT_FIELD_RULES = {
  title: { label: 'Titre', maximumLength: 200 },
  source: { label: 'Source', maximumLength: 100 },
  postingRawText: { label: "Texte de l'annonce", maximumLength: MAX_PASTED_TEXT_LENGTH },
  location: { label: 'Lieu', maximumLength: 200 },
  remotePolicy: { label: 'Télétravail', maximumLength: 200 },
  desiredStart: { label: 'Démarrage', maximumLength: 200 },
  duration: { label: 'Durée', maximumLength: 200 },
  notes: { label: 'Notes', maximumLength: 10_000 },
  intermediaryName: { label: 'Intermédiaire', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH },
  contactName: { label: 'Contact', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH },
  contactPhone: { label: 'Téléphone', maximumLength: MAXIMUM_PHONE_LENGTH },
  endClientName: { label: 'Client final', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH },
  endClientParentName: { label: 'Groupe', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH },
} as const satisfies Record<string, TextFieldRule>

const validateOptionalTextField = (textFieldRule: TextFieldRule) => (candidate: unknown) =>
  validateOptionalText(candidate, textFieldRule, JOB_APPLICATION_VALIDATION_MESSAGES.invalidText)

const validateOptionalEntityNameField = (textFieldRule: TextFieldRule) => (candidate: unknown) =>
  validateOptionalEntityName(candidate, textFieldRule, JOB_APPLICATION_VALIDATION_MESSAGES.invalidText)

const validateDailyRate = (candidate: unknown): ActionResult<number | null> => {
  if (candidate === null) return { ok: true, data: null }
  const isValidDailyRate =
    typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0 && candidate <= MAXIMUM_DAILY_RATE
  return isValidDailyRate ? { ok: true, data: candidate } : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidDailyRate)
}

const validateStatus = (candidate: unknown): ActionResult<JobApplicationStatus> =>
  isJobApplicationStatus(candidate) ? { ok: true, data: candidate } : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidStatus)

const validateAppliedOn = (candidate: unknown): ActionResult<Date> =>
  isValidDate(candidate) ? { ok: true, data: candidate } : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidAppliedOn)

const validateActualStartDate = (candidate: unknown): ActionResult<Date | null> => {
  if (candidate === null) return { ok: true, data: null }
  return isValidDate(candidate)
    ? { ok: true, data: candidate }
    : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidActualStartDate)
}

export const isStackItem = (candidate: unknown): candidate is StackItem =>
  isRecord(candidate) &&
  typeof candidate.name === 'string' &&
  STACK_CATEGORIES.some((stackCategory) => stackCategory === candidate.category) &&
  STACK_ITEM_ORIGINS.some((stackItemOrigin) => stackItemOrigin === candidate.origin)

const toTrimmedStackItem = (stackItem: StackItem): StackItem => ({
  name: stackItem.name.trim(),
  category: stackItem.category,
  origin: stackItem.origin,
})

const isAcceptableStackItemName = (stackItem: StackItem): boolean =>
  stackItem.name.length > 0 && stackItem.name.length <= MAXIMUM_STACK_ITEM_NAME_LENGTH

const validateStack = (candidate: unknown): ActionResult<StackItem[]> => {
  const isWellFormedStack =
    Array.isArray(candidate) && candidate.length <= MAXIMUM_STACK_ITEM_COUNT && candidate.every(isStackItem)
  if (!isWellFormedStack) return rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidStack)
  const trimmedStack = candidate.map(toTrimmedStackItem)
  return trimmedStack.every(isAcceptableStackItemName)
    ? { ok: true, data: trimmedStack }
    : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.invalidStack)
}

const JOB_APPLICATION_FIELD_VALIDATORS: JobApplicationFieldValidators = {
  title: (candidate) =>
    validateRequiredText(candidate, TEXT_FIELD_RULES.title, JOB_APPLICATION_VALIDATION_MESSAGES.missingTitle),
  source: validateOptionalTextField(TEXT_FIELD_RULES.source),
  postingUrl: (candidate) =>
    validateOptionalUrl(candidate, POSTING_URL_ALLOWED_PROTOCOLS, JOB_APPLICATION_VALIDATION_MESSAGES.invalidPostingUrl),
  postingRawText: validateOptionalTextField(TEXT_FIELD_RULES.postingRawText),
  status: validateStatus,
  postedDailyRate: validateDailyRate,
  requestedDailyRate: validateDailyRate,
  location: validateOptionalTextField(TEXT_FIELD_RULES.location),
  remotePolicy: validateOptionalTextField(TEXT_FIELD_RULES.remotePolicy),
  desiredStart: validateOptionalTextField(TEXT_FIELD_RULES.desiredStart),
  duration: validateOptionalTextField(TEXT_FIELD_RULES.duration),
  appliedOn: validateAppliedOn,
  notes: validateOptionalTextField(TEXT_FIELD_RULES.notes),
  actualStartDate: validateActualStartDate,
  stack: validateStack,
  intermediaryName: validateOptionalEntityNameField(TEXT_FIELD_RULES.intermediaryName),
  contactName: validateOptionalEntityNameField(TEXT_FIELD_RULES.contactName),
  contactEmail: (candidate) =>
    validateOptionalEmailAddress(candidate, JOB_APPLICATION_VALIDATION_MESSAGES.invalidContactEmail),
  contactPhone: validateOptionalTextField(TEXT_FIELD_RULES.contactPhone),
  endClientName: validateOptionalEntityNameField(TEXT_FIELD_RULES.endClientName),
  endClientParentName: validateOptionalEntityNameField(TEXT_FIELD_RULES.endClientParentName),
}

const JOB_APPLICATION_FIELD_NAMES = Object.keys(JOB_APPLICATION_FIELD_VALIDATORS) as (keyof JobApplicationInput)[]

const copyValidatedField = <FieldName extends keyof JobApplicationInput>(
  fieldName: FieldName,
  candidateValue: unknown,
  validatedInput: Partial<JobApplicationInput>,
): string | null => {
  const fieldValidation = JOB_APPLICATION_FIELD_VALIDATORS[fieldName](candidateValue)
  if (!fieldValidation.ok) return fieldValidation.errorMessage
  validatedInput[fieldName] = fieldValidation.data
  return null
}

const validateFields = (
  candidate: unknown,
  shouldValidateField: (candidateRecord: Record<string, unknown>, fieldName: keyof JobApplicationInput) => boolean,
): ActionResult<Partial<JobApplicationInput>> => {
  if (!isRecord(candidate)) return rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.malformedPayload)
  const validatedInput: Partial<JobApplicationInput> = {}
  for (const fieldName of JOB_APPLICATION_FIELD_NAMES) {
    if (!shouldValidateField(candidate, fieldName)) continue
    const fieldErrorMessage = copyValidatedField(fieldName, candidate[fieldName], validatedInput)
    if (fieldErrorMessage !== null) return rejectWith(fieldErrorMessage)
  }
  return { ok: true, data: validatedInput }
}

const isEveryFieldPresent = (
  validatedInput: Partial<JobApplicationInput>,
): validatedInput is JobApplicationInput =>
  JOB_APPLICATION_FIELD_NAMES.every((fieldName) => validatedInput[fieldName] !== undefined)

export const validateJobApplicationInput = (candidate: unknown): ActionResult<JobApplicationInput> => {
  const fieldsValidation = validateFields(candidate, () => true)
  if (!fieldsValidation.ok) return fieldsValidation
  return isEveryFieldPresent(fieldsValidation.data)
    ? { ok: true, data: fieldsValidation.data }
    : rejectWith(JOB_APPLICATION_VALIDATION_MESSAGES.malformedPayload)
}

export const validateJobApplicationUpdateInput = (candidate: unknown): ActionResult<Partial<JobApplicationInput>> =>
  validateFields(candidate, (candidateRecord, fieldName) => candidateRecord[fieldName] !== undefined)

export const validateJobApplicationId = (candidate: unknown): ActionResult<string> =>
  validateUuid(candidate, JOB_APPLICATION_NOT_FOUND_MESSAGE)
