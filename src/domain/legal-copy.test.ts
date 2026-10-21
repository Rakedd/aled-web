import { LEGAL_NOTICE_DOCUMENT, LEGAL_PLACEHOLDER_MARKER, PRIVACY_POLICY_DOCUMENT } from './legal-copy'

const SERIALIZED_LEGAL_DOCUMENTS = JSON.stringify([LEGAL_NOTICE_DOCUMENT, PRIVACY_POLICY_DOCUMENT])

describe('legal copy', () => {
  it('never says freelance', () => {
    expect(SERIALIZED_LEGAL_DOCUMENTS).not.toMatch(/freelance/i)
  })

  it('names the host of the site', () => {
    expect(JSON.stringify(LEGAL_NOTICE_DOCUMENT)).toContain('Vercel Inc.')
  })

  it.skip('contains no placeholder left — à activer avant le lancement', () => {
    expect(SERIALIZED_LEGAL_DOCUMENTS).not.toContain(LEGAL_PLACEHOLDER_MARKER)
  })
})
