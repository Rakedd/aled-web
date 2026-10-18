/**
 * @jest-environment node
 */
import { type BriefLanguage, INTERVIEW_PREPARATION_MESSAGES, type InterviewPreparation } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import {
  findInterviewPreparationForUser,
  generateInterviewPreparationForUser,
} from '@/server/interview-preparation/prepare-interview'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import * as interviewPreparationActions from './interview-preparation-actions'
import { generateInterviewPreparation, getInterviewPreparation } from './interview-preparation-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/interview-preparation/prepare-interview', () => ({
  createInterviewPreparationDependencies: jest.fn((startedAtInMilliseconds: number) => ({ startedAtInMilliseconds })),
  findInterviewPreparationForUser: jest.fn(),
  generateInterviewPreparationForUser: jest.fn(),
}))

const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'
const fakeSupabaseClient = {} as FreeclutchSupabaseClient

const emptyPreparation: InterviewPreparation = {
  language: 'en',
  endClientId: null,
  endClientName: null,
  brief: null,
  questions: null,
  notes: null,
  lastUsedLanguage: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(findInterviewPreparationForUser).mockResolvedValue({ ok: true, data: emptyPreparation })
  jest.mocked(generateInterviewPreparationForUser).mockResolvedValue({ ok: true, data: emptyPreparation })
})

describe('interview preparation actions', () => {
  it('exports only the two server actions', () => {
    expect(Object.keys(interviewPreparationActions).sort()).toEqual([
      'generateInterviewPreparation',
      'getInterviewPreparation',
    ])
  })

  it('refuses an unsupported language without reaching the database', async () => {
    const invalidLanguageResult = { ok: false, errorMessage: INTERVIEW_PREPARATION_MESSAGES.invalidLanguage }
    expect(await getInterviewPreparation(JOB_APPLICATION_ID, 'de' as BriefLanguage)).toEqual(invalidLanguageResult)
    expect(await generateInterviewPreparation(JOB_APPLICATION_ID, 'de' as BriefLanguage, false)).toEqual(invalidLanguageResult)
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
    expect(findInterviewPreparationForUser).not.toHaveBeenCalled()
    expect(generateInterviewPreparationForUser).not.toHaveBeenCalled()
  })

  it('refuses a job application identifier that is not a uuid without reaching the database', async () => {
    const notFoundResult = { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
    expect(await getInterviewPreparation('not-a-uuid', 'fr')).toEqual(notFoundResult)
    expect(await generateInterviewPreparation('not-a-uuid', 'fr', true)).toEqual(notFoundResult)
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('loads the preparation of the authenticated user in the chosen language', async () => {
    expect(await getInterviewPreparation(JOB_APPLICATION_ID, 'en')).toEqual({ ok: true, data: emptyPreparation })
    expect(findInterviewPreparationForUser).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', JOB_APPLICATION_ID, 'en')
  })

  it('generates for the authenticated user with a time budget that starts when the action is called', async () => {
    const actionCalledAtInMilliseconds = Date.now()
    await generateInterviewPreparation(JOB_APPLICATION_ID, 'fr', true)
    const [supabase, userId, preparationRequest, dependencies] = jest.mocked(generateInterviewPreparationForUser).mock
      .calls[0]
    expect([supabase, userId, preparationRequest]).toEqual([
      fakeSupabaseClient,
      'user-1',
      { jobApplicationId: JOB_APPLICATION_ID, language: 'fr', regenerate: true },
    ])
    expect(dependencies.startedAtInMilliseconds).toBeGreaterThanOrEqual(actionCalledAtInMilliseconds)
    expect(dependencies.startedAtInMilliseconds).toBeLessThanOrEqual(Date.now())
  })

  it('only regenerates when asked with an explicit true', async () => {
    await generateInterviewPreparation(JOB_APPLICATION_ID, 'fr', 'yes' as unknown as boolean)
    expect(generateInterviewPreparationForUser).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      { jobApplicationId: JOB_APPLICATION_ID, language: 'fr', regenerate: false },
      expect.anything(),
    )
  })
})
