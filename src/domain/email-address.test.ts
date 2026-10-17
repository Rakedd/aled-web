import { isValidEmailAddress } from './email-address'

describe('isValidEmailAddress', () => {
  it.each(['freelance@example.com', 'first.last+tag@sub.example.fr'])('accepts %s', (emailAddress) => {
    expect(isValidEmailAddress(emailAddress)).toBe(true)
  })

  it.each(['', 'not-an-email', 'missing-domain@', '@missing-local.com', 'no-tld@example', 'with space@example.com'])(
    'rejects "%s"',
    (emailAddress) => {
      expect(isValidEmailAddress(emailAddress)).toBe(false)
    },
  )
})
