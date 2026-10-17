import type { ActionResult } from './action-result'
import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import { isRecord, validateOptionalText } from './input-validation'

export type ClientBriefSource = { title: string; url: string }

export type ClientBrief = { markdown: string; sources: ClientBriefSource[] }

export type GeneratedClientBrief = ClientBrief & { generatedAt: Date }

export type EndClientBrief = {
  endClientId: string
  notes: string | null
  brief: GeneratedClientBrief | null
}

export const CLIENT_BRIEF_MESSAGES = {
  unknownClient: "Client inconnu, demande-le à l'intermédiaire",
  unusableEndClientName: 'Le nom du client final ne permet pas de générer un brief. Corrige-le dans les infos mission.',
  invalidNotes: 'Notes invalides',
} as const

export const CLIENT_BRIEF_AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  ...AI_ERROR_MESSAGES,
  missing_api_key: 'Ajoute ta clé Claude dans les réglages pour générer le brief.',
  refused: "Claude n'a pas pu générer ce brief. Réessaie plus tard.",
  unknown: 'La génération du brief a échoué, réessaie.',
}

export const MAXIMUM_END_CLIENT_NOTES_LENGTH = 10_000

const ANGLE_BRACKETS_PATTERN = /[<>]/g
const EXTERNAL_LINK_PROTOCOLS = ['http:', 'https:']

export const removeAngleBrackets = (companyName: string): string => companyName.replace(ANGLE_BRACKETS_PATTERN, '').trim()

export const isBriefableEndClientName = (endClientName: string): boolean => removeAngleBrackets(endClientName).length > 0

export const isExternalLinkUrl = (candidateUrl: string): boolean =>
  URL.canParse(candidateUrl) && EXTERNAL_LINK_PROTOCOLS.includes(new URL(candidateUrl).protocol)

export const isClientBriefSource = (candidate: unknown): candidate is ClientBriefSource =>
  isRecord(candidate) && typeof candidate.title === 'string' && typeof candidate.url === 'string'

export const validateEndClientNotes = (candidate: unknown): ActionResult<string | null> =>
  validateOptionalText(
    candidate,
    { label: 'Notes', maximumLength: MAXIMUM_END_CLIENT_NOTES_LENGTH },
    CLIENT_BRIEF_MESSAGES.invalidNotes,
  )
