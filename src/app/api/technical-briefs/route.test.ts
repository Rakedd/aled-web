/** @jest-environment node */
import { INTERVIEW_PREPARATION_MESSAGES } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { TECHNICAL_BRIEF_MESSAGES, type TechnicalBriefView } from '@/domain/technical-brief'
import {
  createTechnicalBriefDependencies,
  generateTechnicalBriefForUser,
  type TechnicalBriefDependencies,
} from '@/server/interview-preparation/prepare-technical-brief'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { POST, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ findAuthenticatedUser: jest.fn() }))
jest.mock('@/server/interview-preparation/prepare-technical-brief', () => ({
  createTechnicalBriefDependencies: jest.fn(),
  generateTechnicalBriefForUser: jest.fn(),
}))

const createServerSupabaseClientMock = jest.mocked(createServerSupabaseClient)
const findAuthenticatedUserMock = jest.mocked(findAuthenticatedUser)
const createTechnicalBriefDependenciesMock = jest.mocked(createTechnicalBriefDependencies)
const generateTechnicalBriefForUserMock = jest.mocked(generateTechnicalBriefForUser)

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const GENERATION_FAILURE_MESSAGE =
  "Impossible d'enregistrer le brief technique pour le moment. Réessaie dans quelques minutes."
const fakeSupabase = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const fakeDependencies = { now: () => new Date() } as unknown as TechnicalBriefDependencies

const generatedView: TechnicalBriefView = {
  language: 'en',
  availability: 'ready',
  isCvOutdated: false,
  brief: {
    language: 'en',
    content: { storyline: [], missions: [], gaps: [] },
    cvVersionId: 'cv-version-1',
    cvLabel: 'CV 2026',
    cvUploadedAt: new Date('2026-10-20T09:00:00.000Z'),
    generatedAt: new Date('2026-10-23T10:00:00.000Z'),
  },
}

const requestGeneration = (body: string) =>
  POST(new Request('http://localhost:3000/api/technical-briefs', { method: 'POST', body }))

const buildValidBody = () => JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, language: 'en' })

describe('POST /api/technical-briefs', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    createServerSupabaseClientMock.mockResolvedValue(fakeSupabase)
    findAuthenticatedUserMock.mockResolvedValue({ id: 'user-1', email: 'user@test.local' })
    createTechnicalBriefDependenciesMock.mockReturnValue(fakeDependencies)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('lets the generation run for up to five minutes', () => {
    expect(maxDuration).toBe(300)
  })

  it('answers 401 without generating anything when nobody is signed in', async () => {
    findAuthenticatedUserMock.mockResolvedValue(null)

    const response = await requestGeneration(buildValidBody())

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ error: TECHNICAL_BRIEF_MESSAGES.sessionExpired })
    expect(generateTechnicalBriefForUserMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a non JSON body', 'pas du json', TECHNICAL_BRIEF_MESSAGES.invalidRequest],
    ['a JSON body that is not an object', '["en"]', TECHNICAL_BRIEF_MESSAGES.invalidRequest],
    ['a malformed job application id', JSON.stringify({ jobApplicationId: 'pas-un-uuid', language: 'en' }), JOB_APPLICATION_NOT_FOUND_MESSAGE],
    ['an unknown language', JSON.stringify({ jobApplicationId: JOB_APPLICATION_ID, language: 'de' }), INTERVIEW_PREPARATION_MESSAGES.invalidLanguage],
  ])('answers 400 without generating anything for %s', async (_caseName, body, expectedErrorMessage) => {
    const response = await requestGeneration(body)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ error: expectedErrorMessage })
    expect(generateTechnicalBriefForUserMock).not.toHaveBeenCalled()
  })

  it('generates the brief for the signed in user and answers the generated view', async () => {
    generateTechnicalBriefForUserMock.mockResolvedValue({ ok: true, data: { kind: 'generated', view: generatedView } })

    const response = await requestGeneration(buildValidBody())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(generateTechnicalBriefForUserMock).toHaveBeenCalledWith(
      fakeSupabase,
      'user-1',
      { jobApplicationId: JOB_APPLICATION_ID, language: 'en' },
      fakeDependencies,
    )
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        kind: 'generated',
        view: {
          ...generatedView,
          brief: {
            ...generatedView.brief,
            cvUploadedAt: '2026-10-20T09:00:00.000Z',
            generatedAt: '2026-10-23T10:00:00.000Z',
          },
        },
      },
    })
  })

  it('answers 200 with the refusal message when the generation is refused', async () => {
    generateTechnicalBriefForUserMock.mockResolvedValue({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.missingSentCv })

    const response = await requestGeneration(buildValidBody())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.missingSentCv })
  })

  it('answers 500 with the generation failure message and logs only the error message when the generation throws', async () => {
    generateTechnicalBriefForUserMock.mockRejectedValue(new Error('database down'))

    const response = await requestGeneration(buildValidBody())

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ ok: false, errorMessage: GENERATION_FAILURE_MESSAGE })
    expect(console.error).toHaveBeenCalledWith('Technical brief route failed', { errorMessage: 'database down' })
  })

  it('answers 500 when the authentication throws', async () => {
    findAuthenticatedUserMock.mockRejectedValue(new Error('auth down'))

    const response = await requestGeneration(buildValidBody())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ ok: false, errorMessage: GENERATION_FAILURE_MESSAGE })
    expect(generateTechnicalBriefForUserMock).not.toHaveBeenCalled()
  })
})
