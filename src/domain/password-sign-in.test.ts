import {
  INVALID_CREDENTIALS_MESSAGE,
  MISSING_PASSWORD_MESSAGE,
  TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE,
  UNCONFIRMED_ACCOUNT_MESSAGE,
  findExpectedSignInErrorMessage,
  findSignInCredentialsError,
} from './password-sign-in'

describe('findSignInCredentialsError', () => {
  it('accepts a valid email with a password', () => {
    expect(findSignInCredentialsError('freelance@example.com', 'secret')).toBeNull()
  })

  it('rejects an invalid email before checking the password', () => {
    expect(findSignInCredentialsError('not-an-email', '')).toBe('Adresse e-mail invalide')
  })

  it('rejects an empty password', () => {
    expect(findSignInCredentialsError('freelance@example.com', '')).toBe(MISSING_PASSWORD_MESSAGE)
  })

  it('accepts a password made of spaces, since passwords are never trimmed', () => {
    expect(findSignInCredentialsError('freelance@example.com', '   ')).toBeNull()
  })
})

describe('findExpectedSignInErrorMessage', () => {
  it.each([
    ['invalid_credentials', INVALID_CREDENTIALS_MESSAGE],
    ['email_not_confirmed', UNCONFIRMED_ACCOUNT_MESSAGE],
    ['over_request_rate_limit', TOO_MANY_SIGN_IN_ATTEMPTS_MESSAGE],
  ])('explains the %s error', (signInErrorCode, expectedMessage) => {
    expect(findExpectedSignInErrorMessage(signInErrorCode)).toBe(expectedMessage)
  })

  it.each([undefined, 'unexpected_failure'])('returns null for the unexpected error code %p', (signInErrorCode) => {
    expect(findExpectedSignInErrorMessage(signInErrorCode)).toBeNull()
  })
})
