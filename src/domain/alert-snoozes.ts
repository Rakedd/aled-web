import type { ActionResult } from './action-result'
import { rejectWith } from './input-validation'
import { validateJobApplicationId } from './job-application'
import type { AlertKind } from './types'

export const SNOOZE_DURATIONS_IN_DAYS = [3, 7] as const

export type SnoozeDurationInDays = (typeof SNOOZE_DURATIONS_IN_DAYS)[number]

export type SnoozeAlertArguments = {
  jobApplicationId: string
  alertKind: AlertKind
  snoozeDays: SnoozeDurationInDays
}

export const ALERT_KINDS: readonly AlertKind[] = [
  'follow_up_due',
  'job_spec_missing',
  'end_client_unknown',
  'upcoming_interview',
  'no_news_suggestion',
]

export const ALERT_SNOOZE_MESSAGES = {
  invalidAlertKind: "Type d'alerte invalide",
  upcomingInterviewNotSnoozable: 'Un entretien à venir ne peut pas être reporté',
  invalidDuration: 'Report de 3 ou 7 jours uniquement',
} as const

export const isSnoozableAlertKind = (alertKind: AlertKind): boolean => alertKind !== 'upcoming_interview'

export const validateSnoozeAlertArguments = (
  jobApplicationIdCandidate: unknown,
  alertKindCandidate: unknown,
  snoozeDaysCandidate: unknown,
): ActionResult<SnoozeAlertArguments> => {
  const jobApplicationIdValidation = validateJobApplicationId(jobApplicationIdCandidate)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const alertKind = ALERT_KINDS.find((knownAlertKind) => knownAlertKind === alertKindCandidate)
  if (!alertKind) return rejectWith(ALERT_SNOOZE_MESSAGES.invalidAlertKind)
  if (!isSnoozableAlertKind(alertKind)) return rejectWith(ALERT_SNOOZE_MESSAGES.upcomingInterviewNotSnoozable)
  const snoozeDays = SNOOZE_DURATIONS_IN_DAYS.find((snoozeDuration) => snoozeDuration === snoozeDaysCandidate)
  if (!snoozeDays) return rejectWith(ALERT_SNOOZE_MESSAGES.invalidDuration)
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, alertKind, snoozeDays } }
}
