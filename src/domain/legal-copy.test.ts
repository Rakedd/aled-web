import { LEGAL_NOTICE_DOCUMENT, LEGAL_PLACEHOLDER_MARKER, PRIVACY_POLICY_DOCUMENT, TERMS_OF_USE_DOCUMENT } from './legal-copy'

const SERIALIZED_LEGAL_DOCUMENTS = JSON.stringify([LEGAL_NOTICE_DOCUMENT, PRIVACY_POLICY_DOCUMENT, TERMS_OF_USE_DOCUMENT])

describe('legal copy', () => {
  it('never says freelance', () => {
    expect(SERIALIZED_LEGAL_DOCUMENTS).not.toMatch(/freelance/i)
  })

  it('names the host of the site', () => {
    expect(JSON.stringify(LEGAL_NOTICE_DOCUMENT)).toContain('Vercel Inc.')
  })

  it('leaves the sections of the terms of use for the owner to complete', () => {
    expect(TERMS_OF_USE_DOCUMENT.title).toBe("Conditions d'utilisation")
    expect(TERMS_OF_USE_DOCUMENT.sections.map((section) => section.heading)).toEqual([
      'Objet',
      'Compte',
      'Usage de l\'IA et clé Claude',
      'Données',
      'Responsabilité',
      'Résiliation',
      'Droit applicable',
    ])
    TERMS_OF_USE_DOCUMENT.sections.forEach((section) =>
      expect(JSON.stringify(section.paragraphs)).toContain(LEGAL_PLACEHOLDER_MARKER),
    )
  })

  it.skip('contains no placeholder left — à activer avant le lancement', () => {
    expect(SERIALIZED_LEGAL_DOCUMENTS).not.toContain(LEGAL_PLACEHOLDER_MARKER)
  })
})
