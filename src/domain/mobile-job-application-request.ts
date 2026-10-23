import type { ActionResult } from './action-result'
import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import {
  isRecord,
  isUuid,
  rejectWith,
  type TextFieldRule,
  validateOptionalEmailAddress,
  validateOptionalText,
  validateOptionalUrl,
} from './input-validation'
import {
  isStackItem,
  JOB_APPLICATION_TEXT_FIELD_RULES,
  JOB_APPLICATION_VALIDATION_MESSAGES,
  type JobApplicationInput,
  MAXIMUM_STACK_ITEM_COUNT,
  MAXIMUM_STACK_ITEM_NAME_LENGTH,
  POSTING_URL_ALLOWED_PROTOCOLS,
  validateJobApplicationInput,
} from './job-application'
import { type JobPostingExtraction, MAX_PASTED_TEXT_LENGTH } from './job-posting-extraction'
import { formatParisCalendarDate, parseParisCalendarDate } from './paris-time'
import type { StackItem } from './types'

export type MobileJobApplicationRequest = {
  title: string
  endClientName: string | null
  intermediaryName: string | null
  contactName: string | null
  postedDailyRate: number | null
  location: string | null
  remotePolicy: string | null
  postingUrl: string | null
  postingRawText: string | null
  desiredStart: string | null
  duration: string | null
  contactEmail: string | null
  contactPhone: string | null
  stack: StackItem[]
}

export type JobPostingExtractionRequest = { rawText: string }

export type JobPostingExtractionRequestRejection = 'invalid_request' | 'input_too_long'

export type JobPostingExtractionRequestValidation =
  | { ok: true; data: JobPostingExtractionRequest }
  | { ok: false; rejection: JobPostingExtractionRequestRejection; errorMessage: string }

export type CreatedJobApplication = { jobApplicationId: string }

export const MOBILE_JOB_APPLICATION_SOURCE = 'Partage mobile'

export const MOBILE_JOB_APPLICATION_MESSAGES = {
  invalidPostingRequest: 'Annonce invalide.',
  invalidJobApplicationRequest: `${JOB_APPLICATION_VALIDATION_MESSAGES.malformedPayload}.`,
  missingPostingText: "Colle le texte de l'annonce pour l'analyser, ou saisis la candidature à la main.",
  postingTextTooLong: AI_ERROR_MESSAGES.input_too_long,
  missingApiKey:
    "Ajoute ta clé Claude dans les préférences de l'app web pour analyser l'annonce. Tu peux saisir à la main en attendant.",
  invalidApiKey: "Ta clé Claude est refusée. Remplace-la dans les préférences de l'app web, ou saisis à la main.",
  extractionFailed: "Impossible d'analyser l'annonce pour le moment. Ton texte est gardé : réessaie ou saisis à la main.",
  creationFailed: "Impossible de créer la candidature pour le moment. Ce que tu as saisi est gardé : réessaie.",
  linkedinShareHint:
    "Sur LinkedIn, le partage n'envoie que le lien : copie aussi le texte de l'annonce pour une meilleure analyse.",
} as const

export const MOBILE_JOB_POSTING_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...AI_ERROR_MESSAGES,
  missing_api_key: MOBILE_JOB_APPLICATION_MESSAGES.missingApiKey,
  invalid_api_key: MOBILE_JOB_APPLICATION_MESSAGES.invalidApiKey,
}

const toParisStartOfDay = (date: Date): Date => parseParisCalendarDate(formatParisCalendarDate(date))

const roundDailyRate = (candidate: unknown): unknown =>
  typeof candidate === 'number' && Number.isFinite(candidate) ? Math.round(candidate) : candidate

const textOrNullWhenInvalid = (candidate: unknown, textFieldRule: TextFieldRule): string | null => {
  const textValidation = validateOptionalText(candidate ?? null, textFieldRule, JOB_APPLICATION_VALIDATION_MESSAGES.invalidText)
  return textValidation.ok ? textValidation.data : null
}

const emailAddressOrNullWhenInvalid = (candidate: unknown): string | null => {
  const emailAddressValidation = validateOptionalEmailAddress(
    candidate ?? null,
    JOB_APPLICATION_VALIDATION_MESSAGES.invalidContactEmail,
  )
  return emailAddressValidation.ok ? emailAddressValidation.data : null
}

const toTrimmedStackItem = (stackItem: StackItem): StackItem => ({ ...stackItem, name: stackItem.name.trim() })

const hasAcceptableStackItemName = (stackItem: StackItem): boolean =>
  stackItem.name.length > 0 && stackItem.name.length <= MAXIMUM_STACK_ITEM_NAME_LENGTH

const sanitizeStack = (candidate: unknown): StackItem[] => {
  if (!Array.isArray(candidate)) return []
  const seenStackItemNames = new Set<string>()
  const sanitizedStack: StackItem[] = []
  for (const stackItem of candidate.filter(isStackItem).map(toTrimmedStackItem).filter(hasAcceptableStackItemName)) {
    const comparableStackItemName = stackItem.name.toLowerCase()
    if (seenStackItemNames.has(comparableStackItemName)) continue
    seenStackItemNames.add(comparableStackItemName)
    sanitizedStack.push(stackItem)
  }
  return sanitizedStack.slice(0, MAXIMUM_STACK_ITEM_COUNT)
}

export const buildJobApplicationInputFromMobileRequest = (
  candidate: unknown,
  today: Date,
): ActionResult<JobApplicationInput> => {
  if (!isRecord(candidate)) return rejectWith(MOBILE_JOB_APPLICATION_MESSAGES.invalidJobApplicationRequest)
  const unvalidatedJobApplicationInput = {
    title: candidate.title,
    source: MOBILE_JOB_APPLICATION_SOURCE,
    postingUrl: candidate.postingUrl ?? null,
    postingRawText: candidate.postingRawText ?? null,
    status: 'applied',
    postedDailyRate: roundDailyRate(candidate.postedDailyRate ?? null),
    requestedDailyRate: null,
    location: candidate.location ?? null,
    remotePolicy: candidate.remotePolicy ?? null,
    desiredStart: textOrNullWhenInvalid(candidate.desiredStart, JOB_APPLICATION_TEXT_FIELD_RULES.desiredStart),
    duration: textOrNullWhenInvalid(candidate.duration, JOB_APPLICATION_TEXT_FIELD_RULES.duration),
    appliedOn: toParisStartOfDay(today),
    notes: null,
    actualStartDate: null,
    stack: sanitizeStack(candidate.stack),
    intermediaryName: candidate.intermediaryName ?? null,
    contactName: candidate.contactName ?? null,
    contactEmail: emailAddressOrNullWhenInvalid(candidate.contactEmail),
    contactPhone: textOrNullWhenInvalid(candidate.contactPhone, JOB_APPLICATION_TEXT_FIELD_RULES.contactPhone),
    contactLinkedinUrl: null,
    userEditedContactFields: [],
    endClientName: candidate.endClientName ?? null,
    endClientParentName: null,
  } satisfies Record<keyof JobApplicationInput, unknown>
  return validateJobApplicationInput(unvalidatedJobApplicationInput)
}

const HTTP_URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"«»“”]+/gi
const TRAILING_PUNCTUATION: readonly string[] = ['.', ',', ';', ':', '!', '?', "'", '…', '’', '*', '。', '、']
const CLOSING_TO_OPENING_BRACKETS: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' }

const countUnmatchedClosingBrackets = (urlCandidate: string): Map<string, number> => {
  const unmatchedClosingBracketCounts = new Map<string, number>()
  const closingBracketByOpeningBracket = new Map(
    Object.entries(CLOSING_TO_OPENING_BRACKETS).map(([closingBracket, openingBracket]) => [openingBracket, closingBracket]),
  )
  for (const character of urlCandidate) {
    const isClosingBracket = CLOSING_TO_OPENING_BRACKETS[character] !== undefined
    const matchingClosingBracket = closingBracketByOpeningBracket.get(character)
    if (isClosingBracket) {
      unmatchedClosingBracketCounts.set(character, (unmatchedClosingBracketCounts.get(character) ?? 0) + 1)
    } else if (matchingClosingBracket !== undefined) {
      unmatchedClosingBracketCounts.set(
        matchingClosingBracket,
        (unmatchedClosingBracketCounts.get(matchingClosingBracket) ?? 0) - 1,
      )
    }
  }
  return unmatchedClosingBracketCounts
}

const trimTrailingPunctuation = (urlCandidate: string): string => {
  const unmatchedClosingBracketCounts = countUnmatchedClosingBrackets(urlCandidate)
  let keptLength = urlCandidate.length
  while (keptLength > 0) {
    const lastCharacter = urlCandidate[keptLength - 1]
    const unmatchedCount = unmatchedClosingBracketCounts.get(lastCharacter) ?? 0
    if (unmatchedCount > 0) {
      unmatchedClosingBracketCounts.set(lastCharacter, unmatchedCount - 1)
    } else if (!TRAILING_PUNCTUATION.includes(lastCharacter)) {
      break
    }
    keptLength -= 1
  }
  return urlCandidate.slice(0, keptLength)
}

const isCreatablePostingUrl = (urlCandidate: string): boolean =>
  validateOptionalUrl(urlCandidate, POSTING_URL_ALLOWED_PROTOCOLS, JOB_APPLICATION_VALIDATION_MESSAGES.invalidPostingUrl)
    .ok

export const findFirstHttpUrl = (text: string): string | null => {
  for (const [urlCandidate] of text.matchAll(HTTP_URL_CANDIDATE_PATTERN)) {
    const trimmedUrlCandidate = trimTrailingPunctuation(urlCandidate)
    if (isCreatablePostingUrl(trimmedUrlCandidate)) return trimmedUrlCandidate
  }
  return null
}

const rejectExtractionRequest = (
  rejection: JobPostingExtractionRequestRejection,
  errorMessage: string,
): JobPostingExtractionRequestValidation => ({ ok: false, rejection, errorMessage })

export const validateJobPostingExtractionRequest = (candidate: unknown): JobPostingExtractionRequestValidation => {
  if (!isRecord(candidate) || typeof candidate.rawText !== 'string') {
    return rejectExtractionRequest('invalid_request', MOBILE_JOB_APPLICATION_MESSAGES.invalidPostingRequest)
  }
  const rawText = candidate.rawText.trim()
  if (rawText.length === 0) {
    return rejectExtractionRequest('invalid_request', MOBILE_JOB_APPLICATION_MESSAGES.missingPostingText)
  }
  if (rawText.length > MAX_PASTED_TEXT_LENGTH) {
    return rejectExtractionRequest('input_too_long', MOBILE_JOB_APPLICATION_MESSAGES.postingTextTooLong)
  }
  return { ok: true, data: { rawText } }
}

const JOB_POSTING_EXTRACTION_TEXT_FIELD_NAMES = [
  'title',
  'intermediaryName',
  'contactName',
  'contactEmail',
  'contactPhone',
  'endClientName',
  'location',
  'remotePolicy',
  'desiredStart',
  'duration',
] as const satisfies readonly (keyof JobPostingExtraction)[]

const isStringOrNull = (candidate: unknown): candidate is string | null =>
  candidate === null || typeof candidate === 'string'

const isFiniteNumberOrNull = (candidate: unknown): candidate is number | null =>
  candidate === null || (typeof candidate === 'number' && Number.isFinite(candidate))

export const isJobPostingExtraction = (candidate: unknown): candidate is JobPostingExtraction =>
  isRecord(candidate) &&
  JOB_POSTING_EXTRACTION_TEXT_FIELD_NAMES.every((fieldName) => isStringOrNull(candidate[fieldName])) &&
  isFiniteNumberOrNull(candidate.postedDailyRate) &&
  Array.isArray(candidate.stack) &&
  candidate.stack.every(isStackItem)

export const isCreatedJobApplication = (candidate: unknown): candidate is CreatedJobApplication =>
  isRecord(candidate) && isUuid(candidate.jobApplicationId)
