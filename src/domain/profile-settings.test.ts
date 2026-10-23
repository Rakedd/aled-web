import { validateProfileSettingsInput } from './profile-settings'

const validProfileSettingsInput = {
  firstName: ' Ada ',
  lastName: 'Lovelace',
  links: [{ label: ' LinkedIn ', url: ' https://www.linkedin.com/in/ada ' }],
  followUpDelayDays: 7,
  professionalStatus: 'freelance',
}

describe('validateProfileSettingsInput', () => {
  it('accepts valid settings and trims every text field', () => {
    expect(validateProfileSettingsInput(validProfileSettingsInput)).toEqual({
      ok: true,
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/ada' }],
        followUpDelayDays: 7,
        professionalStatus: 'freelance',
      },
    })
  })

  it('accepts a missing professional status', () => {
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, professionalStatus: null })).toMatchObject({
      ok: true,
      data: { professionalStatus: null },
    })
  })

  it.each(['intern', '', undefined, 3])('rejects the professional status %p', (professionalStatus) => {
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, professionalStatus })).toEqual({
      ok: false,
      errorMessage: 'Préférences invalides',
    })
  })

  it.each([0, 61, 7.5, Number.NaN, '7'])('rejects the follow-up delay %p', (followUpDelayDays) => {
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, followUpDelayDays })).toEqual({
      ok: false,
      errorMessage: 'Entre 1 et 60 jours',
    })
  })

  it.each(['http://example.com', 'www.example.com', 'https://', 'javascript:alert(1)'])('rejects the link url %p', (url) => {
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, links: [{ label: 'Site', url }] })).toEqual({
      ok: false,
      errorMessage: 'Un lien doit commencer par https://',
    })
  })

  it('rejects a link without a label', () => {
    expect(
      validateProfileSettingsInput({ ...validProfileSettingsInput, links: [{ label: '  ', url: 'https://example.com' }] }),
    ).toEqual({ ok: false, errorMessage: "Chaque lien a besoin d'un libellé (50 caractères maximum)" })
  })

  it('rejects more than ten links', () => {
    const elevenLinks = Array.from({ length: 11 }, (_, linkIndex) => ({
      label: `Lien ${linkIndex}`,
      url: 'https://example.com',
    }))
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, links: elevenLinks })).toEqual({
      ok: false,
      errorMessage: '10 liens maximum',
    })
  })

  it('rejects a name longer than 100 characters', () => {
    expect(validateProfileSettingsInput({ ...validProfileSettingsInput, lastName: 'a'.repeat(101) })).toEqual({
      ok: false,
      errorMessage: 'Nom et prénom : 100 caractères maximum',
    })
  })

  it.each([null, 'settings', { firstName: 'Ada' }, { ...validProfileSettingsInput, links: 'https://example.com' }])(
    'rejects the malformed payload %p',
    (malformedPayload) => {
      expect(validateProfileSettingsInput(malformedPayload)).toEqual({ ok: false, errorMessage: 'Préférences invalides' })
    },
  )
})
