import {
  findChangedFields,
  isSameFormValue,
  mergeUntouchedFormValues,
  toDailyRateText,
  toFormText,
  toNullableDailyRate,
  toNullableParisDate,
  toNullableText,
} from './form-values'

describe('form text conversions', () => {
  it('shows a missing text as an empty field', () => {
    expect(toFormText(null)).toBe('')
    expect(toFormText('Paris')).toBe('Paris')
  })

  it('sends a blank field as null and keeps a filled one', () => {
    expect(toNullableText('   ')).toBeNull()
    expect(toNullableText('Lyon')).toBe('Lyon')
  })

  it('converts the daily rate both ways', () => {
    expect(toDailyRateText(null)).toBe('')
    expect(toDailyRateText(650)).toBe('650')
    expect(toNullableDailyRate(' ')).toBeNull()
    expect(toNullableDailyRate('700')).toBe(700)
    expect(toNullableDailyRate('abc')).toBeNaN()
  })

  it('reads a calendar date as Paris midnight and an empty date as null', () => {
    expect(toNullableParisDate('')).toBeNull()
    expect(toNullableParisDate('2026-10-17')).toEqual(new Date('2026-10-16T22:00:00.000Z'))
  })
})

describe('isSameFormValue', () => {
  it('compares numbers with Object.is so that NaN differs from a number', () => {
    expect(isSameFormValue(700, 700)).toBe(true)
    expect(isSameFormValue(Number.NaN, 700)).toBe(false)
    expect(isSameFormValue(null, 0)).toBe(false)
  })

  it('compares texts, dates and lists by value', () => {
    expect(isSameFormValue('Lyon', 'Lyon')).toBe(true)
    expect(isSameFormValue(new Date('2026-10-17T00:00:00Z'), new Date('2026-10-17T00:00:00Z'))).toBe(true)
    expect(isSameFormValue([{ name: 'React' }], [{ name: 'React' }])).toBe(true)
    expect(isSameFormValue([{ name: 'React' }], [{ name: 'Vue' }])).toBe(false)
  })
})

describe('findChangedFields', () => {
  it('keeps only the fields whose value changed', () => {
    expect(
      findChangedFields(
        { location: 'Paris', duration: '6 mois', postedDailyRate: 650 },
        { location: 'Lyon', duration: '6 mois', postedDailyRate: 650 },
      ),
    ).toEqual({ location: 'Lyon' })
  })

  it('returns an empty object when nothing changed', () => {
    expect(findChangedFields({ notes: null }, { notes: null })).toEqual({})
  })
})

describe('mergeUntouchedFormValues', () => {
  it('adopts the server value for untouched fields and keeps the fields being edited', () => {
    expect(
      mergeUntouchedFormValues(
        { location: 'Paris', duration: '6 mois', stack: ['React'] },
        { location: 'Marseille', duration: '12 mois', stack: ['React', 'Node'] },
        { location: 'Lyon', duration: '6 mois', stack: ['React'] },
      ),
    ).toEqual({ location: 'Lyon', duration: '12 mois', stack: ['React', 'Node'] })
  })
})
