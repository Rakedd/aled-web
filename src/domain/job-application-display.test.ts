import {
  MISSING_VALUE_LABEL,
  formatDailyRate,
  groupStackByCategory,
  toDisplayText,
  toPhoneHref,
} from './job-application-display'

describe('toDisplayText', () => {
  it('shows a dash for a missing or blank value', () => {
    expect(toDisplayText(null)).toBe(MISSING_VALUE_LABEL)
    expect(toDisplayText('  ')).toBe('—')
    expect(toDisplayText('Paris')).toBe('Paris')
  })
})

describe('formatDailyRate', () => {
  it('formats a daily rate in euros and returns null without a rate', () => {
    expect(formatDailyRate(650)).toBe('650\u00a0€')
    expect(formatDailyRate(1200)).toBe('1\u202f200\u00a0€')
    expect(formatDailyRate(null)).toBeNull()
  })
})

describe('toPhoneHref', () => {
  it('keeps only the digits and the leading plus of the phone number', () => {
    expect(toPhoneHref('+33 6 12-34.56 78')).toBe('tel:+33612345678')
    expect(toPhoneHref('01 02 03 04 05')).toBe('tel:0102030405')
  })
})

describe('groupStackByCategory', () => {
  it('groups the technologies in the category order and skips empty categories', () => {
    expect(
      groupStackByCategory([
        { name: 'React', category: 'framework', origin: 'posting' },
        { name: 'TypeScript', category: 'language', origin: 'posting' },
        { name: 'Next.js', category: 'framework', origin: 'job_spec' },
      ]),
    ).toEqual([
      { category: 'language', label: 'Langage', names: ['TypeScript'] },
      { category: 'framework', label: 'Framework', names: ['React', 'Next.js'] },
    ])
  })
})
