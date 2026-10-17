import type { ActionResult } from './action-result'
import { isRecord, isValidDate, rejectWith, validateRequiredText } from './input-validation'
import { JOB_APPLICATION_STATUS_LABELS, type JobApplicationStatus } from './job-application-status'
import type { ActivityKind } from './types'

export type ActivityLogEntry = {
  id: string
  jobApplicationId: string
  occurredAt: Date
  kind: ActivityKind
  summary: string
}

export type ActivityLogEntryInput = { kind: ActivityKind; summary: string; occurredAt?: Date }

export const ACTIVITY_KINDS: readonly ActivityKind[] = ['call', 'message', 'email', 'status_change', 'other']

export const USER_LOGGABLE_ACTIVITY_KINDS: readonly ActivityKind[] = ACTIVITY_KINDS.filter(
  (activityKind) => activityKind !== 'status_change',
)

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  call: 'Appel',
  message: 'Message',
  email: 'E-mail',
  status_change: 'Changement de statut',
  other: 'Autre',
}

export const ACTIVITY_LOG_VALIDATION_MESSAGES = {
  malformedPayload: 'Échange invalide',
  invalidKind: "Type d'échange invalide",
  missingSummary: 'Le résumé est obligatoire',
  invalidOccurredAt: "Date de l'échange invalide",
} as const

const SUMMARY_TEXT_FIELD_RULE = { label: 'Résumé', maximumLength: 2000 }

export const formatStatusChangeSummary = (
  previousStatus: JobApplicationStatus,
  newStatus: JobApplicationStatus,
): string => `Statut : ${JOB_APPLICATION_STATUS_LABELS[previousStatus]} → ${JOB_APPLICATION_STATUS_LABELS[newStatus]}`

export const validateActivityLogEntryInput = (candidate: unknown): ActionResult<ActivityLogEntryInput> => {
  if (!isRecord(candidate)) return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.malformedPayload)
  const kind = USER_LOGGABLE_ACTIVITY_KINDS.find((activityKind) => activityKind === candidate.kind)
  if (!kind) return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.invalidKind)
  const summaryValidation = validateRequiredText(
    candidate.summary,
    SUMMARY_TEXT_FIELD_RULE,
    ACTIVITY_LOG_VALIDATION_MESSAGES.missingSummary,
  )
  if (!summaryValidation.ok) return summaryValidation
  if (candidate.occurredAt === undefined) return { ok: true, data: { kind, summary: summaryValidation.data } }
  if (!isValidDate(candidate.occurredAt)) return rejectWith(ACTIVITY_LOG_VALIDATION_MESSAGES.invalidOccurredAt)
  return { ok: true, data: { kind, summary: summaryValidation.data, occurredAt: candidate.occurredAt } }
}
