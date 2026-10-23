import type { ActionResult } from './action-result'
import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import { isExternalLinkUrl } from './client-brief'
import { isRecord, rejectWith, validateUuid } from './input-validation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from './job-application'
import { ALL_JOB_APPLICATION_STATUSES, isActiveStatus, type JobApplicationStatus } from './job-application-status'

export const FOLLOW_UP_FORMALITIES = ['vous', 'tu'] as const

export type FollowUpFormality = (typeof FOLLOW_UP_FORMALITIES)[number]

export type FollowUpMessageRequest = { jobApplicationId: string; formality: FollowUpFormality }

export type FollowUpMessageDraft = {
  subject: string
  message: string
  contactEmail: string | null
  contactLinkedinUrl: string | null
}

export const DEFAULT_FOLLOW_UP_FORMALITY: FollowUpFormality = 'vous'

export const FOLLOW_UP_MESSAGE_LIMITS = {
  minimumSentences: 3,
  maximumSentences: 6,
  messageMaximumLength: 600,
  subjectMaximumLength: 80,
  recentActivityEntries: 5,
  activitySummaryMaximumLength: 500,
} as const

export const FOLLOW_UP_MESSAGES = {
  openButton: 'Rédiger une relance',
  compactOpenButton: 'Rédiger',
  dialogTitle: 'Relance',
  drafting: 'Rédaction…',
  drafted: 'Relance rédigée.',
  formalityLegend: 'Ton du message',
  formalityLabels: { vous: 'Vous', tu: 'Tu' } satisfies Record<FollowUpFormality, string>,
  subjectLabel: 'Objet',
  messageLabel: 'Message',
  copy: 'Copier',
  copied: 'Message copié.',
  copyFailed: 'Impossible de copier. Sélectionne le message et copie-le à la main.',
  sendByEmail: 'Envoyer par e-mail',
  openLinkedin: 'Ouvrir LinkedIn',
  linkedinCopied: 'Message copié, colle-le dans LinkedIn.',
  regenerate: 'Régénérer',
  replaceEditedMessageQuestion: 'Remplacer ton message modifié ?',
  confirmReplace: 'Remplacer',
  cancelReplace: 'Annuler',
  newTabHint: ' (nouvel onglet)',
  retry: 'Réessayer',
  close: 'Fermer',
  markAsSent: "J'ai envoyé la relance",
  markingAsSent: 'Enregistrement…',
  sentActivitySummary: 'Relance envoyée',
  sentAnnouncement: 'Relance notée dans le journal.',
  missingApiKeyFeature: 'la rédaction des relances',
  invalidRequest: 'Demande de relance invalide.',
  closedJobApplication: 'Cette candidature est close : pas de relance à rédiger.',
  draftFailed: 'La rédaction a échoué. Réessaie dans un instant.',
} as const

export const FOLLOW_UP_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...AI_ERROR_MESSAGES,
  missing_api_key: 'Ajoute ta clé Claude dans tes préférences pour rédiger une relance.',
  refused: "Claude n'a pas pu rédiger cette relance. Écris-la à la main.",
  input_too_long: 'Le journal de cette candidature est trop long pour Claude.',
  unknown: FOLLOW_UP_MESSAGES.draftFailed,
}

export const FOLLOW_UP_DRAFTABLE_STATUSES: readonly JobApplicationStatus[] = ALL_JOB_APPLICATION_STATUSES.filter(isActiveStatus)

export const canDraftFollowUp = (status: JobApplicationStatus): boolean => FOLLOW_UP_DRAFTABLE_STATUSES.includes(status)

export const formatCompactFollowUpButtonAccessibleLabel = (jobApplicationTitle: string): string =>
  `${FOLLOW_UP_MESSAGES.openButton} pour « ${jobApplicationTitle} »`

const isFollowUpFormality = (candidate: unknown): candidate is FollowUpFormality =>
  (FOLLOW_UP_FORMALITIES as readonly unknown[]).includes(candidate)

export const validateFollowUpMessageRequest = (candidate: unknown): ActionResult<FollowUpMessageRequest> => {
  if (!isRecord(candidate)) return rejectWith(FOLLOW_UP_MESSAGES.invalidRequest)
  const jobApplicationIdValidation = validateUuid(candidate.jobApplicationId, JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  if (!isFollowUpFormality(candidate.formality)) return rejectWith(FOLLOW_UP_MESSAGES.invalidRequest)
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, formality: candidate.formality } }
}

const LINE_BREAK_PATTERN = /\r?\n/g

const encodeMailtoAddress = (email: string): string => encodeURIComponent(email.trim()).replaceAll('%40', '@')

export const buildFollowUpMailtoUrl = (email: string, subject: string, message: string): string =>
  `mailto:${encodeMailtoAddress(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    message.replace(LINE_BREAK_PATTERN, '\r\n'),
  )}`

const isStringOrNull = (candidate: unknown): candidate is string | null =>
  candidate === null || typeof candidate === 'string'

export const toExternalLinkUrlOrNull = (candidateUrl: string | null): string | null =>
  candidateUrl !== null && isExternalLinkUrl(candidateUrl) ? candidateUrl : null

export const parseFollowUpMessageDraft = (candidate: unknown): FollowUpMessageDraft | null => {
  if (!isRecord(candidate)) return null
  const { subject, message, contactEmail, contactLinkedinUrl } = candidate
  if (typeof subject !== 'string' || typeof message !== 'string') return null
  if (!isStringOrNull(contactEmail) || !isStringOrNull(contactLinkedinUrl)) return null
  return { subject, message, contactEmail, contactLinkedinUrl: toExternalLinkUrlOrNull(contactLinkedinUrl) }
}

export const isFollowUpMessageDraft = (candidate: unknown): candidate is FollowUpMessageDraft =>
  parseFollowUpMessageDraft(candidate) !== null
