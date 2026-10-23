import { INVALID_EMAIL_ADDRESS_MESSAGE } from '@/domain/email-address'
import {
  MAXIMUM_FIRST_NAME_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  OAUTH_PROVIDERS,
  OAUTH_PROVIDER_LABELS,
  PROFESSIONAL_STATUSES,
  PROFESSIONAL_STATUS_LABELS,
  RESEND_COOLDOWN_SECONDS,
  SIGN_UP_MESSAGES,
  findNewPasswordError,
  findSignUpErrorMessage,
  findSignUpInputError,
  formatResendCooldown,
  isAlreadyRegisteredSignUpError,
  isOAuthProvider,
  isProfessionalStatus,
} from '@/domain/sign-up'
import type { SignUpInput } from '@/domain/sign-up'

const validSignUpInput: SignUpInput = {
  firstName: 'Camille',
  email: 'camille@example.com',
  password: 'motdepasse',
  professionalStatus: 'freelance',
  hasAcceptedTerms: true,
}

describe('constants', () => {
  it('exposes the expected values', () => {
    expect(PROFESSIONAL_STATUSES).toEqual(['freelance', 'employee'])
    expect(PROFESSIONAL_STATUS_LABELS).toEqual({ freelance: 'Freelance', employee: 'CDI' })
    expect(MINIMUM_PASSWORD_LENGTH).toBe(8)
    expect(MAXIMUM_FIRST_NAME_LENGTH).toBe(100)
    expect(RESEND_COOLDOWN_SECONDS).toBe(60)
    expect(OAUTH_PROVIDERS).toEqual(['google', 'linkedin_oidc'])
    expect(OAUTH_PROVIDER_LABELS).toEqual({
      google: 'Continuer avec Google',
      linkedin_oidc: 'Continuer avec LinkedIn',
    })
  })
})

describe('isProfessionalStatus', () => {
  it.each(['freelance', 'employee'])('accepts %s', (candidate) => {
    expect(isProfessionalStatus(candidate)).toBe(true)
  })

  it.each([['manager'], [null], [undefined], [42]])('rejects %p', (candidate) => {
    expect(isProfessionalStatus(candidate)).toBe(false)
  })
})

describe('isOAuthProvider', () => {
  it.each(['google', 'linkedin_oidc'])('accepts %s', (candidate) => {
    expect(isOAuthProvider(candidate)).toBe(true)
  })

  it.each([['github'], [null], [undefined], [42]])('rejects %p', (candidate) => {
    expect(isOAuthProvider(candidate)).toBe(false)
  })
})

describe('findSignUpInputError', () => {
  it('accepts a complete input', () => {
    expect(findSignUpInputError(validSignUpInput)).toBeNull()
  })

  it('rejects an empty first name', () => {
    expect(findSignUpInputError({ ...validSignUpInput, firstName: '   ' })).toBe('Saisis ton prénom.')
  })

  it('rejects a first name that is too long', () => {
    expect(
      findSignUpInputError({ ...validSignUpInput, firstName: 'a'.repeat(MAXIMUM_FIRST_NAME_LENGTH + 1) }),
    ).toBe('Ton prénom est trop long.')
  })

  it('accepts a first name of the maximum length', () => {
    expect(
      findSignUpInputError({ ...validSignUpInput, firstName: 'a'.repeat(MAXIMUM_FIRST_NAME_LENGTH) }),
    ).toBeNull()
  })

  it('rejects an invalid email', () => {
    expect(findSignUpInputError({ ...validSignUpInput, email: 'nope' })).toBe(INVALID_EMAIL_ADDRESS_MESSAGE)
  })

  it('rejects a password shorter than the minimum', () => {
    expect(findSignUpInputError({ ...validSignUpInput, password: 'a'.repeat(MINIMUM_PASSWORD_LENGTH - 1) })).toBe(
      'Ton mot de passe doit faire au moins 8 caractères.',
    )
  })

  it('rejects a missing professional status', () => {
    expect(findSignUpInputError({ ...validSignUpInput, professionalStatus: null })).toBe(
      'Dis-nous si tu es freelance ou en CDI.',
    )
  })

  it('rejects unaccepted terms', () => {
    expect(findSignUpInputError({ ...validSignUpInput, hasAcceptedTerms: false })).toBe(
      "Accepte les conditions d'utilisation et la politique de confidentialité pour continuer.",
    )
  })

  it('reports the first applicable error in order', () => {
    expect(
      findSignUpInputError({
        firstName: '',
        email: 'nope',
        password: '',
        professionalStatus: null,
        hasAcceptedTerms: false,
      }),
    ).toBe('Saisis ton prénom.')
  })
})

describe('findNewPasswordError', () => {
  it('accepts a long enough matching password', () => {
    expect(findNewPasswordError('motdepasse', 'motdepasse')).toBeNull()
  })

  it('rejects a password that is too short', () => {
    expect(findNewPasswordError('court', 'court')).toBe('Ton mot de passe doit faire au moins 8 caractères.')
  })

  it('rejects different confirmations', () => {
    expect(findNewPasswordError('motdepasse', 'motdepasse2')).toBe('Les deux mots de passe ne correspondent pas.')
  })
})

describe('SIGN_UP_MESSAGES', () => {
  it('holds the verbatim texts', () => {
    expect(SIGN_UP_MESSAGES).toEqual({
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
      passwordUpdateFailure:
        'Impossible de modifier ton mot de passe pour le moment. Réessaie dans quelques minutes.',
      oauthFailure: "La connexion avec ce compte n'a pas abouti. Réessaie ou utilise ton e-mail.",
      termsNotice: "En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité.",
      samePassword: "Choisis un mot de passe différent de l'actuel.",
    })
  })
})

describe('findSignUpErrorMessage', () => {
  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])('maps %s to tooManyAttempts', (code) => {
    expect(findSignUpErrorMessage(code)).toBe(SIGN_UP_MESSAGES.tooManyAttempts)
  })

  it('maps weak_password to weakPassword', () => {
    expect(findSignUpErrorMessage('weak_password')).toBe(SIGN_UP_MESSAGES.weakPassword)
  })

  it('maps email_address_invalid to the invalid email message', () => {
    expect(findSignUpErrorMessage('email_address_invalid')).toBe(INVALID_EMAIL_ADDRESS_MESSAGE)
  })

  it.each(['user_already_exists', 'email_exists', 'unexpected_failure'])('maps %s to failure', (code) => {
    expect(findSignUpErrorMessage(code)).toBe(SIGN_UP_MESSAGES.failure)
  })

  it('maps an undefined code to failure', () => {
    expect(findSignUpErrorMessage(undefined)).toBe(SIGN_UP_MESSAGES.failure)
  })
})

describe('isAlreadyRegisteredSignUpError', () => {
  it.each(['user_already_exists', 'email_exists'])('returns true for %s', (code) => {
    expect(isAlreadyRegisteredSignUpError(code)).toBe(true)
  })

  it.each([['weak_password'], [undefined]])('returns false for %p', (code) => {
    expect(isAlreadyRegisteredSignUpError(code)).toBe(false)
  })
})

describe('formatResendCooldown', () => {
  it('injects the remaining seconds', () => {
    expect(formatResendCooldown(42)).toBe('Renvoyer dans 42 s')
  })
})
