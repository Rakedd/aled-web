import type { ActionResult } from './action-result'
import { normalizeEntityName } from './entity-names'
import {
  type TextFieldRule,
  isRecord,
  rejectWith,
  validateOptionalEmailAddress,
  validateOptionalText,
  validateOptionalUrl,
  validateRequiredText,
} from './input-validation'
import type { IntermediaryKind } from './types'

export const ENTITY_KINDS = ['intermediary', 'contact', 'end_client'] as const

export type EntityKind = (typeof ENTITY_KINDS)[number]

export type EntitySuggestion = { id: string; name: string; label: string; parentName: string | null }

export type ContactDetails = {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  linkedinUrl: string | null
}

export type ContactDetailsInput = Omit<ContactDetails, 'id'>

export type EndClientParentLink = { id: string; parentEndClientId: string | null }

export type EntitySearchArguments = { entityKind: EntityKind; query: string }

export const INTERMEDIARY_KINDS: readonly IntermediaryKind[] = ['agency', 'esn', 'platform', 'direct', 'other']

export const INTERMEDIARY_KIND_LABELS: Record<IntermediaryKind, string> = {
  agency: 'Agence',
  esn: 'ESN',
  platform: 'Plateforme',
  direct: 'Direct',
  other: 'Autre',
}

export const MAXIMUM_ENTITY_NAME_LENGTH = 200
export const MAXIMUM_PHONE_LENGTH = 50

export const END_CLIENT_PARENT_CYCLE_MESSAGE = 'Un groupe ne peut pas être sa propre filiale'

export const ENTITY_VALIDATION_MESSAGES = {
  malformedContact: 'Contact invalide',
  missingContactName: 'Le nom du contact est obligatoire',
  invalidEmail: 'E-mail invalide',
  invalidLinkedinUrl: 'Lien LinkedIn invalide',
  invalidPhone: 'Téléphone invalide',
  invalidIntermediaryKind: "Type d'intermédiaire invalide",
  invalidSearch: 'Recherche invalide',
} as const

export const ENTITY_NOT_FOUND_MESSAGES = {
  contact: 'Contact introuvable',
  intermediary: 'Intermédiaire introuvable',
  endClient: 'Client final introuvable',
} as const

const CONTACT_FULL_NAME_TEXT_FIELD_RULE = { label: 'Nom du contact', maximumLength: MAXIMUM_ENTITY_NAME_LENGTH }

const LINKEDIN_URL_ALLOWED_PROTOCOLS = ['https:']
const MAXIMUM_SEARCH_QUERY_LENGTH = MAXIMUM_ENTITY_NAME_LENGTH

export const wouldCreateEndClientParentCycle = (
  endClientParentLinks: EndClientParentLink[],
  endClientId: string,
  candidateParentEndClientId: string,
): boolean => {
  const parentEndClientIdById = new Map(
    endClientParentLinks.map((endClientParentLink) => [endClientParentLink.id, endClientParentLink.parentEndClientId]),
  )
  const visitedEndClientIds = new Set<string>()
  let currentAncestorId: string | null = candidateParentEndClientId
  while (currentAncestorId !== null && !visitedEndClientIds.has(currentAncestorId)) {
    if (currentAncestorId === endClientId) return true
    visitedEndClientIds.add(currentAncestorId)
    currentAncestorId = parentEndClientIdById.get(currentAncestorId) ?? null
  }
  return false
}

const hasNonEmptyNormalizedName = (entityName: string): boolean => normalizeEntityName(entityName).length > 0

const formatInvalidEntityNameMessage = ({ label }: TextFieldRule): string => `${label} : nom invalide`

export const validateOptionalEntityName = (
  candidate: unknown,
  textFieldRule: TextFieldRule,
  malformedMessage: string,
): ActionResult<string | null> => {
  const textValidation = validateOptionalText(candidate, textFieldRule, malformedMessage)
  if (!textValidation.ok || textValidation.data === null) return textValidation
  return hasNonEmptyNormalizedName(textValidation.data)
    ? textValidation
    : rejectWith(formatInvalidEntityNameMessage(textFieldRule))
}

export const validateContactDetailsInput = (candidate: unknown): ActionResult<ContactDetailsInput> => {
  if (!isRecord(candidate)) return rejectWith(ENTITY_VALIDATION_MESSAGES.malformedContact)
  const fullNameValidation = validateRequiredText(
    candidate.fullName,
    CONTACT_FULL_NAME_TEXT_FIELD_RULE,
    ENTITY_VALIDATION_MESSAGES.missingContactName,
  )
  if (!fullNameValidation.ok) return fullNameValidation
  if (!hasNonEmptyNormalizedName(fullNameValidation.data)) {
    return rejectWith(formatInvalidEntityNameMessage(CONTACT_FULL_NAME_TEXT_FIELD_RULE))
  }
  const phoneValidation = validateOptionalText(
    candidate.phone,
    { label: 'Téléphone', maximumLength: MAXIMUM_PHONE_LENGTH },
    ENTITY_VALIDATION_MESSAGES.invalidPhone,
  )
  if (!phoneValidation.ok) return phoneValidation
  const emailValidation = validateOptionalEmailAddress(candidate.email, ENTITY_VALIDATION_MESSAGES.invalidEmail)
  if (!emailValidation.ok) return emailValidation
  const linkedinUrlValidation = validateOptionalUrl(
    candidate.linkedinUrl,
    LINKEDIN_URL_ALLOWED_PROTOCOLS,
    ENTITY_VALIDATION_MESSAGES.invalidLinkedinUrl,
  )
  if (!linkedinUrlValidation.ok) return linkedinUrlValidation
  return {
    ok: true,
    data: {
      fullName: fullNameValidation.data,
      phone: phoneValidation.data,
      email: emailValidation.data,
      linkedinUrl: linkedinUrlValidation.data,
    },
  }
}

export const validateIntermediaryKind = (candidate: unknown): ActionResult<IntermediaryKind> => {
  const matchingIntermediaryKind = INTERMEDIARY_KINDS.find((intermediaryKind) => intermediaryKind === candidate)
  return matchingIntermediaryKind
    ? { ok: true, data: matchingIntermediaryKind }
    : rejectWith(ENTITY_VALIDATION_MESSAGES.invalidIntermediaryKind)
}

export const validateEntitySearchArguments = (
  entityKindCandidate: unknown,
  queryCandidate: unknown,
): ActionResult<EntitySearchArguments> => {
  const entityKind = ENTITY_KINDS.find((knownEntityKind) => knownEntityKind === entityKindCandidate)
  const isQueryValid = typeof queryCandidate === 'string' && queryCandidate.length <= MAXIMUM_SEARCH_QUERY_LENGTH
  if (!entityKind || !isQueryValid) return rejectWith(ENTITY_VALIDATION_MESSAGES.invalidSearch)
  return { ok: true, data: { entityKind, query: queryCandidate } }
}
