import {
  BRIEF_LANGUAGE_LABELS,
  BRIEF_LANGUAGES,
  isBriefLanguage,
  MAX_INTERVIEW_QUESTIONS,
  MIN_INTERVIEW_QUESTIONS,
} from './interview-preparation'

describe('isBriefLanguage', () => {
  it.each(['fr', 'en'])('accepts %s', (candidate) => {
    expect(isBriefLanguage(candidate)).toBe(true)
  })

  it.each([['de'], ['FR'], [''], [null], [undefined], [42], [{ language: 'fr' }]])('rejects %p', (candidate) => {
    expect(isBriefLanguage(candidate)).toBe(false)
  })
})

describe('brief languages', () => {
  it('lists french first so it is the default choice', () => {
    expect(BRIEF_LANGUAGES).toEqual(['fr', 'en'])
  })

  it('labels every language in its own language', () => {
    expect(BRIEF_LANGUAGE_LABELS).toEqual({ fr: 'Français', en: 'English' })
  })
})

describe('interview questions bounds', () => {
  it('asks for between 8 and 10 questions', () => {
    expect([MIN_INTERVIEW_QUESTIONS, MAX_INTERVIEW_QUESTIONS]).toEqual([8, 10])
  })
})
