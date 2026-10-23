import { INVALID_EMAIL_ADDRESS_MESSAGE, isValidEmailAddress } from '@/domain/email-address'

export const PROFESSIONAL_STATUSES = ['freelance', 'employee'] as const

export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number]

export const PROFESSIONAL_STATUS_LABELS: Record<ProfessionalStatus, string> = {
  freelance: 'Freelance',
  employee: 'CDI',
}

export const MINIMUM_PASSWORD_LENGTH = 8

export const MAXIMUM_FIRST_NAME_LENGTH = 100

export const RESEND_COOLDOWN_SECONDS = 60

export const OAUTH_PROVIDERS = ['google', 'linkedin_oidc'] as const

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Continuer avec Google',
  linkedin_oidc: 'Continuer avec LinkedIn',
}

export type SignUpInput = {
  firstName: string
  email: string
  password: string
  professionalStatus: ProfessionalStatus | null
  hasAcceptedTerms: boolean
}

export const SIGN_UP_MESSAGES = {
  checkInbox: "Vérifie ta boîte mail : on t'a envoyé un lien pour activer ton compte.",
  resend: "Renvoyer l'e-mail",
  resendCooldown: 'Renvoyer dans {seconds} s',
  resent: 'E-mail renvoyé.',
  tooManyAttempts: 'Trop de tentatives, réessaie dans quelques minutes.',
  weakPassword: 'Ce mot de passe est trop facile à deviner.',
  failure: 'Inscription impossible pour le moment. Réessaie dans quelques minutes.',
  passwordResetSent:
    'Si un compte existe pour cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe.',
  passwordUpdated: 'Mot de passe modifié.',
  passwordUpdateFailure: 'Impossible de modifier ton mot de passe pour le moment. Réessaie dans quelques minutes.',
  oauthFailure: "La connexion avec ce compte n'a pas abouti. Réessaie ou utilise ton e-mail.",
  termsNotice: "En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité.",
  samePassword: "Choisis un mot de passe différent de l'actuel.",
} as const

const MISSING_FIRST_NAME_MESSAGE = 'Saisis ton prénom.'

const FIRST_NAME_TOO_LONG_MESSAGE = 'Ton prénom est trop long.'

const PASSWORD_TOO_SHORT_MESSAGE = `Ton mot de passe doit faire au moins ${MINIMUM_PASSWORD_LENGTH} caractères.`

const MISSING_PROFESSIONAL_STATUS_MESSAGE = 'Dis-nous si tu es freelance ou en CDI.'

const TERMS_NOT_ACCEPTED_MESSAGE =
  "Accepte les conditions d'utilisation et la politique de confidentialité pour continuer."

const PASSWORD_CONFIRMATION_MISMATCH_MESSAGE = 'Les deux mots de passe ne correspondent pas.'

const ALREADY_REGISTERED_ERROR_CODES: readonly string[] = ['user_already_exists', 'email_exists']

const REQUEST_RATE_LIMIT_ERROR_CODE = 'over_request_rate_limit'

const EMAIL_SEND_RATE_LIMIT_ERROR_CODE = 'over_email_send_rate_limit'

const SIGN_UP_ERROR_MESSAGES_BY_CODE: Partial<Record<string, string>> = {
  [REQUEST_RATE_LIMIT_ERROR_CODE]: SIGN_UP_MESSAGES.tooManyAttempts,
  weak_password: SIGN_UP_MESSAGES.weakPassword,
  email_address_invalid: INVALID_EMAIL_ADDRESS_MESSAGE,
}

export const isProfessionalStatus = (candidate: unknown): candidate is ProfessionalStatus =>
  PROFESSIONAL_STATUSES.some((professionalStatus) => professionalStatus === candidate)

export const isOAuthProvider = (candidate: unknown): candidate is OAuthProvider =>
  OAUTH_PROVIDERS.some((oauthProvider) => oauthProvider === candidate)

export const findSignUpInputError = (input: SignUpInput): string | null => {
  const trimmedFirstName = input.firstName.trim()
  if (trimmedFirstName.length === 0) return MISSING_FIRST_NAME_MESSAGE
  if (trimmedFirstName.length > MAXIMUM_FIRST_NAME_LENGTH) return FIRST_NAME_TOO_LONG_MESSAGE
  if (!isValidEmailAddress(input.email)) return INVALID_EMAIL_ADDRESS_MESSAGE
  if (input.password.length < MINIMUM_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT_MESSAGE
  if (input.professionalStatus === null) return MISSING_PROFESSIONAL_STATUS_MESSAGE
  if (!input.hasAcceptedTerms) return TERMS_NOT_ACCEPTED_MESSAGE
  return null
}

export const findNewPasswordError = (password: string, confirmation: string): string | null => {
  if (password.length < MINIMUM_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT_MESSAGE
  if (password !== confirmation) return PASSWORD_CONFIRMATION_MISMATCH_MESSAGE
  return null
}

export const isAlreadyRegisteredSignUpError = (errorCode: string | undefined): boolean =>
  errorCode !== undefined && ALREADY_REGISTERED_ERROR_CODES.includes(errorCode)

export const isRequestRateLimitSignUpError = (errorCode: string | undefined): boolean =>
  errorCode === REQUEST_RATE_LIMIT_ERROR_CODE

export const isEmailSendRateLimitSignUpError = (errorCode: string | undefined): boolean =>
  errorCode === EMAIL_SEND_RATE_LIMIT_ERROR_CODE

export const isExpectedSignUpError = (errorCode: string | undefined): errorCode is string =>
  errorCode !== undefined && Object.hasOwn(SIGN_UP_ERROR_MESSAGES_BY_CODE, errorCode)

export const findSignUpErrorMessage = (errorCode: string | undefined): string =>
  (isExpectedSignUpError(errorCode) ? SIGN_UP_ERROR_MESSAGES_BY_CODE[errorCode] : undefined) ?? SIGN_UP_MESSAGES.failure

export const formatResendCooldown = (seconds: number): string =>
  SIGN_UP_MESSAGES.resendCooldown.replace('{seconds}', String(seconds))
