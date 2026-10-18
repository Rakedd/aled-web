import {
  BRIEF_LANGUAGE_LABELS,
  BRIEF_LANGUAGES,
  INTERVIEW_PREPARATION_MESSAGES,
  isBriefLanguage,
  isInterviewQuestionList,
  MAX_INTERVIEW_QUESTIONS,
  MIN_INTERVIEW_QUESTIONS,
  validateBriefLanguage,
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

describe('validateBriefLanguage', () => {
  it.each(['fr', 'en'])('accepts %s', (candidate) => {
    expect(validateBriefLanguage(candidate)).toEqual({ ok: true, data: candidate })
  })

  it.each([['de'], [''], [null], [42]])('rejects %p with the invalid language message', (candidate) => {
    expect(validateBriefLanguage(candidate)).toEqual({
      ok: false,
      errorMessage: INTERVIEW_PREPARATION_MESSAGES.invalidLanguage,
    })
  })
})

describe('isInterviewQuestionList', () => {
  it('accepts a list of texts, empty or not', () => {
    expect(isInterviewQuestionList(['Quelle équipe ?', 'Quel planning ?'])).toBe(true)
    expect(isInterviewQuestionList([])).toBe(true)
  })

  it.each([[['Quelle équipe ?', 42]], ['Quelle équipe ?'], [null], [{ questions: [] }]])('rejects %p', (candidate) => {
    expect(isInterviewQuestionList(candidate)).toBe(false)
  })
})
