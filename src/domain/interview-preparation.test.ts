import {
  BRIEF_LANGUAGE_LABELS,
  BRIEF_LANGUAGES,
  findGenerationScope,
  hasReadablePreparation,
  INTERVIEW_PREPARATION_MESSAGES,
  type InterviewPreparation,
  type InterviewQuestions,
  isBriefLanguage,
  isInterviewQuestionList,
  type LanguageBrief,
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

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const GENERATED_AT = new Date('2026-10-17T09:15:00Z')
const BRIEF: LanguageBrief = { language: 'fr', markdown: 'Brief', sources: [], generatedAt: GENERATED_AT }
const QUESTIONS: InterviewQuestions = { language: 'fr', questions: ['Pourquoi nous ?'], generatedAt: GENERATED_AT }

const buildPreparation = (overrides: Partial<InterviewPreparation> = {}): InterviewPreparation => ({
  language: 'fr',
  endClientId: END_CLIENT_ID,
  endClientName: 'BNP Paribas',
  brief: null,
  questions: null,
  notes: null,
  lastUsedLanguage: null,
  ...overrides,
})

describe('hasReadablePreparation', () => {
  it.each<[string, Partial<InterviewPreparation>, boolean]>([
    ['nothing', {}, false],
    ['only the brief', { brief: BRIEF }, true],
    ['only the questions', { questions: QUESTIONS }, true],
    ['the brief and the questions', { brief: BRIEF, questions: QUESTIONS }, true],
  ])('is computed for %s', (_description, overrides, expected) => {
    expect(hasReadablePreparation(buildPreparation(overrides))).toBe(expected)
  })
})

describe('findGenerationScope', () => {
  it.each([[false], [true]])('only covers the questions when the end client is unknown (regenerate %p)', (regenerate) => {
    const preparation = buildPreparation({ endClientId: null, endClientName: null })
    expect(findGenerationScope(preparation, regenerate)).toBe('questions_only')
  })

  it('covers the brief and the questions when the brief is missing', () => {
    expect(findGenerationScope(buildPreparation(), false)).toBe('brief_and_questions')
  })

  it('only covers the questions when the brief exists and nothing is regenerated', () => {
    expect(findGenerationScope(buildPreparation({ brief: BRIEF }), false)).toBe('questions_only')
  })

  it('covers the brief and the questions when regenerating an existing brief', () => {
    expect(findGenerationScope(buildPreparation({ brief: BRIEF, questions: QUESTIONS }), true)).toBe(
      'brief_and_questions',
    )
  })
})
