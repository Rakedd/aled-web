import { INTERVIEW_VALIDATION_MESSAGES, sortInterviewsByStartsAt, validateInterviewInput, type Interview } from './interviews'

const buildInterviewInput = (overrides: Record<string, unknown> = {}) => ({
  parisLocalDateTime: '2026-10-28T14:00',
  kind: 'client',
  format: 'video',
  participants: '  Jeanne Martin, CTO  ',
  notes: '',
  ...overrides,
})

const buildInterview = (id: string, startsAt: string): Interview => ({
  id,
  jobApplicationId: 'job-application-1',
  startsAt: new Date(startsAt),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
})

describe('validateInterviewInput', () => {
  it('converts the Paris wall-clock time to an instant and trims the texts', () => {
    expect(validateInterviewInput(buildInterviewInput())).toEqual({
      ok: true,
      data: {
        startsAt: new Date('2026-10-28T13:00:00.000Z'),
        kind: 'client',
        format: 'video',
        participants: 'Jeanne Martin, CTO',
        notes: null,
      },
    })
  })

  it('accepts a past date to record an interview afterwards', () => {
    expect(validateInterviewInput(buildInterviewInput({ parisLocalDateTime: '2020-01-15T09:30' })).ok).toBe(true)
  })

  it('refuses an interview without a date', () => {
    expect(validateInterviewInput(buildInterviewInput({ parisLocalDateTime: '' }))).toEqual({
      ok: false,
      errorMessage: INTERVIEW_VALIDATION_MESSAGES.missingStartsAt,
    })
  })

  it.each(['2026-02-30T10:00', '2026-10-28 14:00', '2026-10-28T14:00:00', '2026-03-29T02:30', 42])(
    'refuses the malformed or nonexistent Paris date %p',
    (parisLocalDateTime) => {
      expect(validateInterviewInput(buildInterviewInput({ parisLocalDateTime }))).toEqual({
        ok: false,
        errorMessage: INTERVIEW_VALIDATION_MESSAGES.invalidStartsAt,
      })
    },
  )

  it('refuses an unknown kind or format', () => {
    expect(validateInterviewInput(buildInterviewInput({ kind: 'lunch' }))).toEqual({
      ok: false,
      errorMessage: INTERVIEW_VALIDATION_MESSAGES.invalidKind,
    })
    expect(validateInterviewInput(buildInterviewInput({ format: 'carrier pigeon' }))).toEqual({
      ok: false,
      errorMessage: INTERVIEW_VALIDATION_MESSAGES.invalidFormat,
    })
  })

  it('refuses something that is not an interview input', () => {
    expect(validateInterviewInput('2026-10-28T14:00')).toEqual({
      ok: false,
      errorMessage: INTERVIEW_VALIDATION_MESSAGES.malformedInterview,
    })
  })

  it('refuses participants longer than 500 characters', () => {
    expect(validateInterviewInput(buildInterviewInput({ participants: 'a'.repeat(501) })).ok).toBe(false)
  })
})

describe('sortInterviewsByStartsAt', () => {
  it('sorts interviews by ascending start without mutating the input', () => {
    const interviews = [
      buildInterview('later', '2026-11-02T09:00:00Z'),
      buildInterview('earlier', '2026-10-20T09:00:00Z'),
    ]
    expect(sortInterviewsByStartsAt(interviews).map(({ id }) => id)).toEqual(['earlier', 'later'])
    expect(interviews.map(({ id }) => id)).toEqual(['later', 'earlier'])
  })
})
