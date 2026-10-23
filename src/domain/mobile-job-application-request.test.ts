import { AI_ERROR_MESSAGES, type AiErrorKind } from './ai-errors'
import {
  JOB_APPLICATION_TEXT_FIELD_RULES,
  JOB_APPLICATION_VALIDATION_MESSAGES,
  MAXIMUM_STACK_ITEM_COUNT,
  MAXIMUM_STACK_ITEM_NAME_LENGTH,
} from './job-application'
import { MAX_PASTED_TEXT_LENGTH, type JobPostingExtraction } from './job-posting-extraction'
import {
  buildJobApplicationInputFromMobileRequest,
  findFirstHttpUrl,
  isCreatedJobApplication,
  isJobPostingExtraction,
  MOBILE_JOB_APPLICATION_MESSAGES,
  MOBILE_JOB_APPLICATION_SOURCE,
  MOBILE_JOB_POSTING_AI_ERROR_MESSAGES,
  type MobileJobApplicationRequest,
  validateJobPostingExtractionRequest,
} from './mobile-job-application-request'

const PARIS_EVENING_ALREADY_TOMORROW_IN_UTC = new Date('2026-10-23T22:30:00.000Z')
const PARIS_MIDNIGHT_OF_OCTOBER_24 = new Date('2026-10-23T22:00:00.000Z')
const PARIS_MIDNIGHT_OF_OCTOBER_23 = new Date('2026-10-22T22:00:00.000Z')
const PARIS_AFTERNOON = new Date('2026-10-23T14:00:00.000Z')

const buildMobileRequest = (overrides: Partial<Record<keyof MobileJobApplicationRequest, unknown>> = {}) => ({
  title: 'Développeur React senior',
  endClientName: 'BNP Paribas AM',
  intermediaryName: 'Talentis',
  contactName: 'Julie Martin',
  postedDailyRate: 650,
  location: 'Paris',
  remotePolicy: '2 jours sur site',
  postingUrl: 'https://www.free-work.com/fr/tech-it/jobs/react-123',
  postingRawText: 'Mission React chez BNP Paribas AM',
  desiredStart: 'ASAP',
  duration: '6 mois',
  contactEmail: 'julie@talentis.fr',
  contactPhone: '06 12 34 56 78',
  stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
  ...overrides,
})

const buildStackItem = (name: string) => ({ name, category: 'framework', origin: 'posting' })

const buildInputData = (overrides: Partial<Record<keyof MobileJobApplicationRequest, unknown>>) => {
  const buildResult = buildJobApplicationInputFromMobileRequest(buildMobileRequest(overrides), PARIS_AFTERNOON)
  if (!buildResult.ok) throw new Error(buildResult.errorMessage)
  return buildResult.data
}

const COMPLETE_EXTRACTION: JobPostingExtraction = {
  title: 'Développeur React',
  intermediaryName: 'Talentis',
  contactName: null,
  contactEmail: 'julie@talentis.fr',
  contactPhone: null,
  endClientName: null,
  postedDailyRate: 600,
  location: 'Paris',
  remotePolicy: null,
  desiredStart: 'ASAP',
  duration: '6 mois',
  stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
}

describe('buildJobApplicationInputFromMobileRequest', () => {
  it('keeps the reviewed fields and fills every other field with the share defaults', () => {
    expect(buildJobApplicationInputFromMobileRequest(buildMobileRequest(), PARIS_AFTERNOON)).toEqual({
      ok: true,
      data: {
        title: 'Développeur React senior',
        source: MOBILE_JOB_APPLICATION_SOURCE,
        postingUrl: 'https://www.free-work.com/fr/tech-it/jobs/react-123',
        postingRawText: 'Mission React chez BNP Paribas AM',
        status: 'applied',
        postedDailyRate: 650,
        requestedDailyRate: null,
        location: 'Paris',
        remotePolicy: '2 jours sur site',
        desiredStart: 'ASAP',
        duration: '6 mois',
        appliedOn: PARIS_MIDNIGHT_OF_OCTOBER_23,
        notes: null,
        actualStartDate: null,
        stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
        intermediaryName: 'Talentis',
        contactName: 'Julie Martin',
        contactEmail: 'julie@talentis.fr',
        contactPhone: '06 12 34 56 78',
        contactLinkedinUrl: null,
        userEditedContactFields: [],
        endClientName: 'BNP Paribas AM',
        endClientParentName: null,
      },
    })
  })

  it('labels the source as a mobile share', () => {
    expect(MOBILE_JOB_APPLICATION_SOURCE).toBe('Partage mobile')
  })

  it('dates the application from the Paris calendar day, even when UTC is still on the previous day', () => {
    const buildResult = buildJobApplicationInputFromMobileRequest(
      buildMobileRequest(),
      PARIS_EVENING_ALREADY_TOMORROW_IN_UTC,
    )
    expect(buildResult.ok && buildResult.data.appliedOn).toEqual(PARIS_MIDNIGHT_OF_OCTOBER_24)
  })

  it('treats omitted optional fields as empty', () => {
    expect(buildJobApplicationInputFromMobileRequest({ title: 'Lead dev' }, PARIS_AFTERNOON)).toEqual({
      ok: true,
      data: expect.objectContaining({
        title: 'Lead dev',
        endClientName: null,
        intermediaryName: null,
        contactName: null,
        postedDailyRate: null,
        location: null,
        remotePolicy: null,
        postingUrl: null,
        postingRawText: null,
        desiredStart: null,
        duration: null,
        contactEmail: null,
        contactPhone: null,
        stack: [],
      }),
    })
  })

  it('ignores fields the review step does not send, so the client cannot pick the status or the notes', () => {
    const buildResult = buildJobApplicationInputFromMobileRequest(
      { ...buildMobileRequest(), status: 'won', notes: 'injecté', source: 'Autre', appliedOn: '2020-01-01' },
      PARIS_AFTERNOON,
    )
    expect(buildResult).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: 'applied',
        notes: null,
        source: MOBILE_JOB_APPLICATION_SOURCE,
        appliedOn: PARIS_MIDNIGHT_OF_OCTOBER_23,
      }),
    })
  })

  it.each([undefined, null, '', '   '])('rejects a missing title (%p)', (title) => {
    expect(buildJobApplicationInputFromMobileRequest(buildMobileRequest({ title }), PARIS_AFTERNOON)).toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.missingTitle,
    })
  })

  it.each(['ftp://example.com/annonce', 'javascript:alert(1)', 'pas une url'])(
    'rejects a posting url that is not http(s) (%s)',
    (postingUrl) => {
      expect(buildJobApplicationInputFromMobileRequest(buildMobileRequest({ postingUrl }), PARIS_AFTERNOON)).toEqual({
        ok: false,
        errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.invalidPostingUrl,
      })
    },
  )

  it.each([
    [650.5, 651],
    [649.4, 649],
    [99_999.6, 100_000],
  ])('rounds the extracted daily rate %d to %d euros', (postedDailyRate, expectedDailyRate) => {
    expect(buildInputData({ postedDailyRate }).postedDailyRate).toBe(expectedDailyRate)
  })

  it.each([-1, -0.6, 100_000.5, 150_000, '600', Number.POSITIVE_INFINITY])(
    'rejects a daily rate that is out of range or not a number once rounded (%p)',
    (postedDailyRate) => {
      expect(
        buildJobApplicationInputFromMobileRequest(buildMobileRequest({ postedDailyRate }), PARIS_AFTERNOON),
      ).toEqual({ ok: false, errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.invalidDailyRate })
    },
  )

  it.each<[string, Partial<Record<keyof MobileJobApplicationRequest, unknown>>]>([
    ['an end client name that is too long', { endClientName: 'a'.repeat(JOB_APPLICATION_TEXT_FIELD_RULES.endClientName.maximumLength + 1) }],
    ['a location that is not text', { location: 75 }],
    ['a remote policy that is too long', { remotePolicy: 'a'.repeat(JOB_APPLICATION_TEXT_FIELD_RULES.remotePolicy.maximumLength + 1) }],
  ])('still rejects %s, because the user can correct it', (_description, overrides) => {
    expect(buildJobApplicationInputFromMobileRequest(buildMobileRequest(overrides), PARIS_AFTERNOON).ok).toBe(false)
  })

  describe('fields the user cannot correct on mobile', () => {
    it('keeps an extracted e-mail that is invalid out of the application instead of rejecting it', () => {
      const inputData = buildInputData({ contactEmail: 'jobs@a.fr / rh@a.fr' })
      expect(inputData.contactEmail).toBeNull()
      expect(inputData.title).toBe('Développeur React senior')
    })

    it.each<[keyof MobileJobApplicationRequest, unknown]>([
      ['contactEmail', 'via LinkedIn'],
      ['contactEmail', 42],
      ['contactPhone', '0'.repeat(JOB_APPLICATION_TEXT_FIELD_RULES.contactPhone.maximumLength + 1)],
      ['desiredStart', 'a'.repeat(JOB_APPLICATION_TEXT_FIELD_RULES.desiredStart.maximumLength + 1)],
      ['duration', 'a'.repeat(JOB_APPLICATION_TEXT_FIELD_RULES.duration.maximumLength + 1)],
      ['duration', { mois: 6 }],
    ])('empties an invalid %s instead of rejecting the request', (fieldName, invalidValue) => {
      expect(buildInputData({ [fieldName]: invalidValue })[fieldName]).toBeNull()
    })

    it('trims the pass-through fields and empties blank ones', () => {
      const inputData = buildInputData({ desiredStart: '  Janvier  ', duration: '   ', contactPhone: ' 06 12 34 56 78 ' })
      expect(inputData).toMatchObject({ desiredStart: 'Janvier', duration: null, contactPhone: '06 12 34 56 78' })
    })

    it('keeps the first 100 stack items of a longer stack', () => {
      const longStack = Array.from({ length: MAXIMUM_STACK_ITEM_COUNT + 1 }, (_, stackItemIndex) =>
        buildStackItem(`Outil ${stackItemIndex}`),
      )
      const inputData = buildInputData({ stack: longStack })
      expect(inputData.stack).toHaveLength(MAXIMUM_STACK_ITEM_COUNT)
      expect(inputData.stack.at(-1)?.name).toBe(`Outil ${MAXIMUM_STACK_ITEM_COUNT - 1}`)
    })

    it('drops stack items with an empty or too long name and trims the others', () => {
      const inputData = buildInputData({
        stack: [
          buildStackItem('   '),
          buildStackItem(''),
          buildStackItem('a'.repeat(MAXIMUM_STACK_ITEM_NAME_LENGTH + 1)),
          buildStackItem('  TypeScript  '),
          buildStackItem('a'.repeat(MAXIMUM_STACK_ITEM_NAME_LENGTH)),
        ],
      })
      expect(inputData.stack.map((stackItem) => stackItem.name)).toEqual([
        'TypeScript',
        'a'.repeat(MAXIMUM_STACK_ITEM_NAME_LENGTH),
      ])
    })

    it('keeps the first of stack items that differ only by case', () => {
      const inputData = buildInputData({
        stack: [buildStackItem('React'), buildStackItem('react '), buildStackItem('REACT'), buildStackItem('Vue')],
      })
      expect(inputData.stack).toEqual([buildStackItem('React'), buildStackItem('Vue')])
    })

    it('drops malformed stack items and treats a stack that is not a list as empty', () => {
      expect(buildInputData({ stack: [{ name: 'React' }, buildStackItem('Vue')] }).stack).toEqual([buildStackItem('Vue')])
      expect(buildInputData({ stack: 'React' }).stack).toEqual([])
    })
  })

  it('accepts a posting text of exactly the maximum length and rejects a longer one', () => {
    const longestPostingText = 'a'.repeat(MAX_PASTED_TEXT_LENGTH)
    expect(
      buildJobApplicationInputFromMobileRequest(buildMobileRequest({ postingRawText: longestPostingText }), PARIS_AFTERNOON)
        .ok,
    ).toBe(true)
    expect(
      buildJobApplicationInputFromMobileRequest(
        buildMobileRequest({ postingRawText: `${longestPostingText}a` }),
        PARIS_AFTERNOON,
      ).ok,
    ).toBe(false)
  })

  it.each([null, 'texte', ['titre'], 42])('rejects a body that is not an object (%p)', (candidate) => {
    expect(buildJobApplicationInputFromMobileRequest(candidate, PARIS_AFTERNOON)).toEqual({
      ok: false,
      errorMessage: MOBILE_JOB_APPLICATION_MESSAGES.invalidJobApplicationRequest,
    })
  })
})

describe('findFirstHttpUrl', () => {
  it('finds the url inside a LinkedIn share text', () => {
    expect(
      findFirstHttpUrl('Découvrez cette offre : https://www.linkedin.com/jobs/view/4012345678/?trk=share Bonne chance'),
    ).toBe('https://www.linkedin.com/jobs/view/4012345678/?trk=share')
  })

  it('returns the first url when the text holds several', () => {
    expect(findFirstHttpUrl('http://first.example.com/a puis https://second.example.com/b')).toBe(
      'http://first.example.com/a',
    )
  })

  it('returns a bare shared url as is', () => {
    expect(findFirstHttpUrl('https://www.free-work.com/fr/tech-it/jobs/react-123')).toBe(
      'https://www.free-work.com/fr/tech-it/jobs/react-123',
    )
  })

  it.each([
    ['(voir https://example.com/offre).', 'https://example.com/offre'],
    ['Lien : https://example.com/offre, merci', 'https://example.com/offre'],
    ['Va voir https://example.com/offre !', 'https://example.com/offre'],
    ['Postule ici https://example.com/offre?', 'https://example.com/offre'],
    ['« https://example.com/offre »', 'https://example.com/offre'],
    ['«https://example.com/offre»', 'https://example.com/offre'],
    ['"https://example.com/offre"', 'https://example.com/offre'],
    ["'https://example.com/offre';", 'https://example.com/offre'],
    ['https://example.com/offre...', 'https://example.com/offre'],
    ['“https://example.com/offre”', 'https://example.com/offre'],
    ['https://example.com/offre… suite', 'https://example.com/offre'],
    ['{https://example.com/offre}', 'https://example.com/offre'],
    ['**https://example.com/offre**', 'https://example.com/offre'],
    ['https://example.com/offre。', 'https://example.com/offre'],
    ['Voir https://example.com/offre’', 'https://example.com/offre'],
    ['https://example.com/offre、 ensuite', 'https://example.com/offre'],
  ])('trims the punctuation around %s', (sharedText, expectedUrl) => {
    expect(findFirstHttpUrl(sharedText)).toBe(expectedUrl)
  })

  it('keeps a closing parenthesis that belongs to the url', () => {
    expect(findFirstHttpUrl('Voir https://fr.wikipedia.org/wiki/React_(JavaScript).')).toBe(
      'https://fr.wikipedia.org/wiki/React_(JavaScript)',
    )
  })

  it('finds an url written in upper case', () => {
    expect(findFirstHttpUrl('HTTPS://EXAMPLE.COM/OFFRE')).toBe('HTTPS://EXAMPLE.COM/OFFRE')
  })

  it.each(['', 'Une mission React sans lien', 'ftp://example.com/offre', 'www.example.com/offre', 'https:// rien'])(
    'returns null when the text holds no http(s) url (%p)',
    (sharedText) => {
      expect(findFirstHttpUrl(sharedText)).toBeNull()
    },
  )

  it('skips an url too long to be saved and returns the next valid one', () => {
    const tooLongUrl = `https://example.com/${'a'.repeat(2_048)}`
    expect(findFirstHttpUrl(`${tooLongUrl} https://example.com/offre`)).toBe('https://example.com/offre')
  })

  it('trims a very long run of closing brackets quickly', () => {
    expect(findFirstHttpUrl(`https://example.com/${')'.repeat(50_000)}`)).toBe('https://example.com/')
  })

  it('skips a broken url and returns the next valid one', () => {
    expect(findFirstHttpUrl('https://[cassé puis https://example.com/offre')).toBe('https://example.com/offre')
  })
})

describe('validateJobPostingExtractionRequest', () => {
  it('trims the posting text', () => {
    expect(validateJobPostingExtractionRequest({ rawText: '  Mission React  ' })).toEqual({
      ok: true,
      data: { rawText: 'Mission React' },
    })
  })

  it('accepts a posting text of exactly the maximum length', () => {
    const longestPostingText = 'é'.repeat(MAX_PASTED_TEXT_LENGTH)
    expect(validateJobPostingExtractionRequest({ rawText: `  ${longestPostingText}\n` })).toEqual({
      ok: true,
      data: { rawText: longestPostingText },
    })
  })

  it('tells a posting text that is too long apart, so the route can answer 413', () => {
    expect(validateJobPostingExtractionRequest({ rawText: 'a'.repeat(MAX_PASTED_TEXT_LENGTH + 1) })).toEqual({
      ok: false,
      rejection: 'input_too_long',
      errorMessage: AI_ERROR_MESSAGES.input_too_long,
    })
  })

  it.each(['', '   \n  '])('asks for the posting text when it is blank (%p)', (rawText) => {
    expect(validateJobPostingExtractionRequest({ rawText })).toEqual({
      ok: false,
      rejection: 'invalid_request',
      errorMessage: MOBILE_JOB_APPLICATION_MESSAGES.missingPostingText,
    })
  })

  it.each([null, 'Mission React', [], {}, { rawText: 42 }, { rawText: null }])(
    'rejects a malformed body (%p)',
    (candidate) => {
      expect(validateJobPostingExtractionRequest(candidate)).toEqual({
        ok: false,
        rejection: 'invalid_request',
        errorMessage: MOBILE_JOB_APPLICATION_MESSAGES.invalidPostingRequest,
      })
    },
  )
})

describe('MOBILE_JOB_POSTING_AI_ERROR_MESSAGES', () => {
  it('points to the web app preferences when the Claude key is missing or refused', () => {
    expect(MOBILE_JOB_POSTING_AI_ERROR_MESSAGES.missing_api_key).toBe(MOBILE_JOB_APPLICATION_MESSAGES.missingApiKey)
    expect(MOBILE_JOB_POSTING_AI_ERROR_MESSAGES.invalid_api_key).toBe(MOBILE_JOB_APPLICATION_MESSAGES.invalidApiKey)
    expect(MOBILE_JOB_APPLICATION_MESSAGES.missingApiKey).toContain("app web")
    expect(MOBILE_JOB_APPLICATION_MESSAGES.invalidApiKey).toContain("app web")
  })

  it.each<AiErrorKind>(['rate_limited', 'refused', 'timeout', 'input_too_long', 'unknown'])(
    'reuses the extraction wording for %s',
    (aiErrorKind) => {
      expect(MOBILE_JOB_POSTING_AI_ERROR_MESSAGES[aiErrorKind]).toBe(AI_ERROR_MESSAGES[aiErrorKind])
    },
  )
})

describe('isJobPostingExtraction', () => {
  it('accepts a complete extraction', () => {
    expect(isJobPostingExtraction(COMPLETE_EXTRACTION)).toBe(true)
  })

  it.each<[string, unknown]>([
    ['not an object', 'extraction'],
    ['null', null],
    ['a missing text field', { ...COMPLETE_EXTRACTION, title: undefined }],
    ['a text field that is a number', { ...COMPLETE_EXTRACTION, location: 75 }],
    ['a daily rate that is text', { ...COMPLETE_EXTRACTION, postedDailyRate: '600' }],
    ['a daily rate that is not finite', { ...COMPLETE_EXTRACTION, postedDailyRate: Number.NaN }],
    ['a stack that is not a list', { ...COMPLETE_EXTRACTION, stack: 'React' }],
    ['a malformed stack item', { ...COMPLETE_EXTRACTION, stack: [{ name: 'React' }] }],
  ])('rejects %s', (_description, candidate) => {
    expect(isJobPostingExtraction(candidate)).toBe(false)
  })
})

describe('isCreatedJobApplication', () => {
  it('accepts the id of the created job application', () => {
    expect(isCreatedJobApplication({ jobApplicationId: '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6' })).toBe(true)
  })

  it.each([null, {}, { jobApplicationId: 42 }, { jobApplicationId: 'pas-un-uuid' }, { id: '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6' }])(
    'rejects %p',
    (candidate) => {
      expect(isCreatedJobApplication(candidate)).toBe(false)
    },
  )
})
