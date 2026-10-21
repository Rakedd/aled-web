import {
  mergeContactDetailValues,
  validateContactExchangeInput,
  validateContactProfileInput,
  validateUserEditedContactFields,
} from './contacts'

const now = new Date('2026-10-22T10:00:00Z')
const validProfile = {
  fullName: 'Alice Martin',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
}

describe('mergeContactDetailValues', () => {
  const currentValues = { email: 'old@x.fr', phone: null, linkedinUrl: null }
  const submittedValues = { email: 'new@x.fr', phone: '06', linkedinUrl: null }

  it('keeps the stored email when the submitted one comes from the AI', () => {
    expect(mergeContactDetailValues(currentValues, submittedValues, [])).toEqual({ phone: '06' })
  })

  it('overwrites a field edited by the user', () => {
    expect(mergeContactDetailValues(currentValues, submittedValues, ['email'])).toEqual({
      email: 'new@x.fr',
      phone: '06',
    })
  })

  it('never clears a field from an empty submission', () => {
    const emptyValues = { email: null, phone: null, linkedinUrl: null }
    expect(mergeContactDetailValues(currentValues, emptyValues, ['email', 'phone', 'linkedinUrl'])).toEqual({})
  })
})

describe('validateContactProfileInput', () => {
  it('accepts a minimal profile', () => {
    expect(validateContactProfileInput(validProfile)).toEqual({
      ok: true,
      data: validProfile,
    })
  })

  it('rejects referredBy longer than 200 characters', () => {
    expect(
      validateContactProfileInput({
        ...validProfile,
        referredBy: 'a'.repeat(201),
      }).ok,
    ).toBe(false)
  })

  it('accepts referredBy of 200 characters', () => {
    expect(
      validateContactProfileInput({
        ...validProfile,
        referredBy: 'a'.repeat(200),
      }).ok,
    ).toBe(true)
  })

  it('rejects notes longer than 10000 characters', () => {
    expect(
      validateContactProfileInput({
        ...validProfile,
        notes: 'a'.repeat(10_001),
      }).ok,
    ).toBe(false)
  })

  it('rejects a non-record', () => {
    expect(validateContactProfileInput('x').ok).toBe(false)
  })
})

describe('validateContactExchangeInput', () => {
  const exchange = { kind: 'call', summary: 'Point rapide' }

  it('accepts an exchange without job application and rejects a malformed job application id', () => {
    expect(validateContactExchangeInput({ ...exchange, jobApplicationId: null }, now)).toEqual({
      ok: true,
      data: { kind: 'call', summary: 'Point rapide', jobApplicationId: null },
    })
    expect(validateContactExchangeInput({ ...exchange, jobApplicationId: 'nope' }, now).ok).toBe(false)
  })

  it('accepts a valid job application id', () => {
    const jobApplicationId = '123e4567-e89b-12d3-a456-426614174000'
    expect(validateContactExchangeInput({ ...exchange, jobApplicationId }, now)).toMatchObject({
      ok: true,
      data: { jobApplicationId },
    })
  })
})

describe('validateUserEditedContactFields', () => {
  it.each([[['phone']], [['email', 'linkedinUrl']], [[]]])('accepts edited fields %p', (editedFields) => {
    expect(validateUserEditedContactFields(editedFields)).toEqual({
      ok: true,
      data: editedFields,
    })
  })

  it('rejects unknown names and non-arrays', () => {
    expect(validateUserEditedContactFields(['fullName']).ok).toBe(false)
    expect(validateUserEditedContactFields('phone').ok).toBe(false)
  })
})
