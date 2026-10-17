import type { ActionResult } from './action-result'
import { isValidEmailAddress } from './email-address'

export type UnvalidatedRecord = Record<string, unknown>

export type TextFieldRule = { label: string; maximumLength: number }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAXIMUM_URL_LENGTH = 2048
const MAXIMUM_EMAIL_ADDRESS_LENGTH = 320

export const rejectWith = (errorMessage: string): { ok: false; errorMessage: string } => ({ ok: false, errorMessage })

export const isRecord = (candidate: unknown): candidate is UnvalidatedRecord =>
  typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)

export const isUuid = (candidate: unknown): candidate is string =>
  typeof candidate === 'string' && UUID_PATTERN.test(candidate)

export const isValidDate = (candidate: unknown): candidate is Date =>
  candidate instanceof Date && !Number.isNaN(candidate.getTime())

const formatTooLongMessage = ({ label, maximumLength }: TextFieldRule): string =>
  `${label} : ${maximumLength} caractères maximum`

export const validateOptionalText = (
  candidate: unknown,
  textFieldRule: TextFieldRule,
  malformedMessage: string,
): ActionResult<string | null> => {
  if (candidate === null) return { ok: true, data: null }
  if (typeof candidate !== 'string') return rejectWith(malformedMessage)
  const trimmedText = candidate.trim()
  if (trimmedText.length > textFieldRule.maximumLength) return rejectWith(formatTooLongMessage(textFieldRule))
  return { ok: true, data: trimmedText.length === 0 ? null : trimmedText }
}

export const validateRequiredText = (
  candidate: unknown,
  textFieldRule: TextFieldRule,
  missingMessage: string,
): ActionResult<string> => {
  const optionalTextValidation = validateOptionalText(candidate, textFieldRule, missingMessage)
  if (!optionalTextValidation.ok) return optionalTextValidation
  if (optionalTextValidation.data === null) return rejectWith(missingMessage)
  return { ok: true, data: optionalTextValidation.data }
}

const isUrlWithAllowedProtocol = (candidateUrl: string, allowedProtocols: readonly string[]): boolean =>
  URL.canParse(candidateUrl) && allowedProtocols.includes(new URL(candidateUrl).protocol)

export const validateOptionalUrl = (
  candidate: unknown,
  allowedProtocols: readonly string[],
  invalidMessage: string,
): ActionResult<string | null> => {
  const textValidation = validateOptionalText(
    candidate,
    { label: invalidMessage, maximumLength: MAXIMUM_URL_LENGTH },
    invalidMessage,
  )
  if (!textValidation.ok) return rejectWith(invalidMessage)
  if (textValidation.data === null) return textValidation
  return isUrlWithAllowedProtocol(textValidation.data, allowedProtocols) ? textValidation : rejectWith(invalidMessage)
}

export const validateOptionalEmailAddress = (candidate: unknown, invalidMessage: string): ActionResult<string | null> => {
  const textValidation = validateOptionalText(
    candidate,
    { label: invalidMessage, maximumLength: MAXIMUM_EMAIL_ADDRESS_LENGTH },
    invalidMessage,
  )
  if (!textValidation.ok) return rejectWith(invalidMessage)
  if (textValidation.data === null) return textValidation
  return isValidEmailAddress(textValidation.data) ? textValidation : rejectWith(invalidMessage)
}

export const validateUuid = (candidate: unknown, notFoundMessage: string): ActionResult<string> =>
  isUuid(candidate) ? { ok: true, data: candidate } : rejectWith(notFoundMessage)
