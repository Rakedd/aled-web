import type { ActionResult } from './action-result'
import { isRecord, rejectWith } from './input-validation'
import { isProfessionalStatus, type ProfessionalStatus } from './sign-up'

export type ProfileLink = { label: string; url: string }

export type ProfileSettings = {
  firstName: string
  lastName: string
  email: string
  links: ProfileLink[]
  followUpDelayDays: number
  anthropicApiKeyLastFour: string | null
  professionalStatus: ProfessionalStatus | null
}

export type ProfileSettingsInput = Pick<
  ProfileSettings,
  'firstName' | 'lastName' | 'links' | 'followUpDelayDays' | 'professionalStatus'
>

export const MINIMUM_FOLLOW_UP_DELAY_DAYS = 1
export const MAXIMUM_FOLLOW_UP_DELAY_DAYS = 60
export const MAXIMUM_PROFILE_LINK_COUNT = 10
const REQUIRED_PROFILE_LINK_URL_PREFIX = 'https://'

const MAXIMUM_NAME_LENGTH = 100
const MAXIMUM_LINK_LABEL_LENGTH = 50
const MAXIMUM_LINK_URL_LENGTH = 2048

export const PROFILE_SETTINGS_VALIDATION_MESSAGES = {
  malformedPayload: 'Préférences invalides',
  nameTooLong: `Nom et prénom : ${MAXIMUM_NAME_LENGTH} caractères maximum`,
  followUpDelayOutOfRange: `Entre ${MINIMUM_FOLLOW_UP_DELAY_DAYS} et ${MAXIMUM_FOLLOW_UP_DELAY_DAYS} jours`,
  tooManyLinks: `${MAXIMUM_PROFILE_LINK_COUNT} liens maximum`,
  missingLinkLabel: `Chaque lien a besoin d'un libellé (${MAXIMUM_LINK_LABEL_LENGTH} caractères maximum)`,
  invalidLinkUrl: `Un lien doit commencer par ${REQUIRED_PROFILE_LINK_URL_PREFIX}`,
} as const

type ProfileSettingsInputShape = Omit<ProfileSettingsInput, 'followUpDelayDays'> & { followUpDelayDays: unknown }


export const isProfileLink = (candidate: unknown): candidate is ProfileLink =>
  isRecord(candidate) && typeof candidate.label === 'string' && typeof candidate.url === 'string'

const isProfileSettingsInputShape = (candidate: unknown): candidate is ProfileSettingsInputShape =>
  isRecord(candidate) &&
  typeof candidate.firstName === 'string' &&
  typeof candidate.lastName === 'string' &&
  Array.isArray(candidate.links) &&
  candidate.links.every(isProfileLink) &&
  (candidate.professionalStatus === null || isProfessionalStatus(candidate.professionalStatus))

const isValidFollowUpDelayDays = (candidate: unknown): candidate is number =>
  typeof candidate === 'number' &&
  Number.isInteger(candidate) &&
  candidate >= MINIMUM_FOLLOW_UP_DELAY_DAYS &&
  candidate <= MAXIMUM_FOLLOW_UP_DELAY_DAYS

const isValidHttpsUrl = (candidateUrl: string): boolean => {
  if (!candidateUrl.startsWith(REQUIRED_PROFILE_LINK_URL_PREFIX)) return false
  if (candidateUrl.length > MAXIMUM_LINK_URL_LENGTH) return false
  if (!URL.canParse(candidateUrl)) return false
  return new URL(candidateUrl).hostname.length > 0
}

const trimProfileLink = (profileLink: ProfileLink): ProfileLink => ({
  label: profileLink.label.trim(),
  url: profileLink.url.trim(),
})

export const validateProfileSettingsInput = (candidate: unknown): ActionResult<ProfileSettingsInput> => {
  if (!isProfileSettingsInputShape(candidate)) return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.malformedPayload)
  const firstName = candidate.firstName.trim()
  const lastName = candidate.lastName.trim()
  const links = candidate.links.map(trimProfileLink)
  if (firstName.length > MAXIMUM_NAME_LENGTH || lastName.length > MAXIMUM_NAME_LENGTH) {
    return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.nameTooLong)
  }
  if (!isValidFollowUpDelayDays(candidate.followUpDelayDays)) {
    return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.followUpDelayOutOfRange)
  }
  if (links.length > MAXIMUM_PROFILE_LINK_COUNT) return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.tooManyLinks)
  const hasLinkWithoutValidLabel = links.some(
    (profileLink) => profileLink.label.length === 0 || profileLink.label.length > MAXIMUM_LINK_LABEL_LENGTH,
  )
  if (hasLinkWithoutValidLabel) return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.missingLinkLabel)
  if (!links.every((profileLink) => isValidHttpsUrl(profileLink.url))) {
    return rejectWith(PROFILE_SETTINGS_VALIDATION_MESSAGES.invalidLinkUrl)
  }
  return {
    ok: true,
    data: {
      firstName,
      lastName,
      links,
      followUpDelayDays: candidate.followUpDelayDays,
      professionalStatus: candidate.professionalStatus,
    },
  }
}
