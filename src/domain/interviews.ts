import type { ActionResult } from './action-result'
import { isRecord, rejectWith, validateOptionalText } from './input-validation'
import { formatParisLocalDateTime, parisLocalDateTimeToUtc } from './paris-time'
import type { InterviewFormat, InterviewKind, StackItem } from './types'

export type Interview = {
  id: string
  jobApplicationId: string
  startsAt: Date
  kind: InterviewKind
  format: InterviewFormat
  participants: string | null
  notes: string | null
}

export type InterviewWithJobApplication = Interview & {
  jobApplicationTitle: string
  endClientLabel: string | null
  stack: StackItem[]
}

export type InterviewInput = {
  parisLocalDateTime: string
  kind: InterviewKind
  format: InterviewFormat
  participants: string | null
  notes: string | null
}

export type ValidatedInterviewInput = Omit<Interview, 'id' | 'jobApplicationId'>

export const INTERVIEW_KINDS: readonly InterviewKind[] = ['client', 'mock', 'other']

export const INTERVIEW_FORMATS: readonly InterviewFormat[] = ['video', 'onsite', 'phone']

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  client: 'Entretien client',
  mock: 'Entretien blanc',
  other: 'Autre',
}

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  video: 'Visio',
  onsite: 'Sur site',
  phone: 'Téléphone',
}

export const INTERVIEW_NOT_FOUND_MESSAGE = 'Entretien introuvable'

export const INTERVIEW_VALIDATION_MESSAGES = {
  malformedInterview: 'Entretien invalide',
  missingStartsAt: "La date et l'heure de l'entretien sont obligatoires",
  invalidStartsAt: "Date ou heure de l'entretien invalide",
  invalidKind: "Type d'entretien invalide",
  invalidFormat: 'Modalité invalide',
  invalidText: 'Un des champs texte est invalide',
  invalidPeriod: 'Période invalide',
} as const

const PARTICIPANTS_TEXT_FIELD_RULE = { label: 'Interlocuteurs', maximumLength: 500 }
const NOTES_TEXT_FIELD_RULE = { label: 'Notes', maximumLength: 10_000 }
const PARIS_LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const validateStartsAt = (candidate: unknown): ActionResult<Date> => {
  if (candidate === '' || candidate === null || candidate === undefined) {
    return rejectWith(INTERVIEW_VALIDATION_MESSAGES.missingStartsAt)
  }
  if (typeof candidate !== 'string' || !PARIS_LOCAL_DATE_TIME_PATTERN.test(candidate)) {
    return rejectWith(INTERVIEW_VALIDATION_MESSAGES.invalidStartsAt)
  }
  const startsAt = parisLocalDateTimeToUtc(candidate)
  const isExistingParisWallClockTime =
    !Number.isNaN(startsAt.getTime()) && formatParisLocalDateTime(startsAt) === candidate
  return isExistingParisWallClockTime ? { ok: true, data: startsAt } : rejectWith(INTERVIEW_VALIDATION_MESSAGES.invalidStartsAt)
}

const validateInterviewKind = (candidate: unknown): ActionResult<InterviewKind> => {
  const matchingKind = INTERVIEW_KINDS.find((interviewKind) => interviewKind === candidate)
  return matchingKind ? { ok: true, data: matchingKind } : rejectWith(INTERVIEW_VALIDATION_MESSAGES.invalidKind)
}

const validateInterviewFormat = (candidate: unknown): ActionResult<InterviewFormat> => {
  const matchingFormat = INTERVIEW_FORMATS.find((interviewFormat) => interviewFormat === candidate)
  return matchingFormat ? { ok: true, data: matchingFormat } : rejectWith(INTERVIEW_VALIDATION_MESSAGES.invalidFormat)
}

export const validateInterviewInput = (candidate: unknown): ActionResult<ValidatedInterviewInput> => {
  if (!isRecord(candidate)) return rejectWith(INTERVIEW_VALIDATION_MESSAGES.malformedInterview)
  const startsAtValidation = validateStartsAt(candidate.parisLocalDateTime)
  if (!startsAtValidation.ok) return startsAtValidation
  const kindValidation = validateInterviewKind(candidate.kind)
  if (!kindValidation.ok) return kindValidation
  const formatValidation = validateInterviewFormat(candidate.format)
  if (!formatValidation.ok) return formatValidation
  const participantsValidation = validateOptionalText(
    candidate.participants,
    PARTICIPANTS_TEXT_FIELD_RULE,
    INTERVIEW_VALIDATION_MESSAGES.invalidText,
  )
  if (!participantsValidation.ok) return participantsValidation
  const notesValidation = validateOptionalText(candidate.notes, NOTES_TEXT_FIELD_RULE, INTERVIEW_VALIDATION_MESSAGES.invalidText)
  if (!notesValidation.ok) return notesValidation
  return {
    ok: true,
    data: {
      startsAt: startsAtValidation.data,
      kind: kindValidation.data,
      format: formatValidation.data,
      participants: participantsValidation.data,
      notes: notesValidation.data,
    },
  }
}

export const sortInterviewsByStartsAt = <SortedInterview extends Pick<Interview, 'startsAt'>>(
  interviews: SortedInterview[],
): SortedInterview[] =>
  [...interviews].sort((firstInterview, secondInterview) => firstInterview.startsAt.getTime() - secondInterview.startsAt.getTime())
