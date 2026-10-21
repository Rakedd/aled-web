import { INVALID_EMAIL_ADDRESS_MESSAGE, isValidEmailAddress } from './email-address'

export const MISSING_PASSWORD_MESSAGE = 'Saisis ton mot de passe.'

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou mot de passe incorrect.'

export const UNCONFIRMED_ACCOUNT_MESSAGE = "Ton compte n'est pas encore activé."

export const TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE = 'Trop de tentatives de connexion. Réessaie dans quelques minutes.'

export const SIGN_IN_FAILURE_MESSAGE = 'Connexion impossible pour le moment. Réessaie dans quelques minutes.'

export const SIGN_IN_RATE_LIMIT_ERROR_CODE = 'over_request_rate_limit'

const EXPECTED_SIGN_IN_ERROR_MESSAGES_BY_CODE: Partial<Record<string, string>> = {
  invalid_credentials: INVALID_CREDENTIALS_MESSAGE,
  email_not_confirmed: UNCONFIRMED_ACCOUNT_MESSAGE,
  [SIGN_IN_RATE_LIMIT_ERROR_CODE]: TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE,
}

export const findSignInCredentialsError = (email: string, password: string): string | null => {
  if (!isValidEmailAddress(email)) return INVALID_EMAIL_ADDRESS_MESSAGE
  if (password.length === 0) return MISSING_PASSWORD_MESSAGE
  return null
}

export const findExpectedSignInErrorMessage = (signInErrorCode: string | undefined): string | null =>
  signInErrorCode === undefined ? null : (EXPECTED_SIGN_IN_ERROR_MESSAGES_BY_CODE[signInErrorCode] ?? null)
