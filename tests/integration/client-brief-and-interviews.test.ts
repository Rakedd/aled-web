import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientBrief } from '@/domain/client-brief'
import type { InterviewInput } from '@/domain/interviews'
import type { StackItem } from '@/domain/types'
import { generateBriefForEndClient, getEndClientBrief, updateEndClientNotes } from '@/server/actions/client-brief-actions'
import {
  createInterview,
  deleteInterview,
  listInterviewsForJobApplication,
  listUpcomingInterviews,
  updateInterview,
} from '@/server/actions/interview-actions'
import { generateClientBrief } from '@/server/ai/generate-client-brief'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/ai/generate-client-brief', () => ({ generateClientBrief: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const generatedClientBrief: ClientBrief = {
  markdown: '## Enjeux\n\nDigitaliser la gestion immobilière',
  sources: [{ title: 'Rapport annuel', url: 'https://example.com/report' }],
}

const jobApplicationStack: StackItem[] = [{ name: 'React', category: 'framework', origin: 'job_spec' }]

const buildInterviewInput = (overrides: Partial<InterviewInput> = {}): InterviewInput => ({
  parisLocalDateTime: '2026-10-28T14:00',
  kind: 'client',
  format: 'video',
  participants: 'Jeanne Martin',
  notes: null,
  ...overrides,
})

const actAs = (user: TestUser): void => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const createTestUser = (): Promise<TestUser> =>
  createSignedInTestClient(`client-brief-interviews-${randomUUID()}@test.local`)

const findEndClientIdOrFail = async (user: TestUser, jobApplicationId: string): Promise<string> => {
  const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
  if (!overviewResult.ok || overviewResult.data.endClientId === null) throw new Error('Expected an end client')
  return overviewResult.data.endClientId
}

const createInterviewOrFail = async (jobApplicationId: string, input: InterviewInput): Promise<string> => {
  const creationResult = await createInterview(jobApplicationId, input)
  if (!creationResult.ok) throw new Error(creationResult.errorMessage)
  return creationResult.data.id
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-test-key')
  jest.mocked(generateClientBrief).mockResolvedValue(generatedClientBrief)
})

describe('client brief actions', () => {
  it('stores the brief on the end client so every application with this client shares it', async () => {
    const user = await createTestUser()
    actAs(user)
    const firstJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      endClientName: 'BNP Paribas Real Estate',
      endClientParentName: 'BNP Paribas',
    })
    const secondJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Lead dev',
      endClientName: 'bnp paribas real estate',
    })
    const endClientId = await findEndClientIdOrFail(user, firstJobApplicationId)
    expect(await findEndClientIdOrFail(user, secondJobApplicationId)).toBe(endClientId)

    const generationResult = await generateBriefForEndClient(endClientId)

    expect(generateClientBrief).toHaveBeenCalledWith(expect.anything(), {
      endClientName: 'BNP Paribas Real Estate',
      parentGroupName: 'BNP Paribas',
    })
    expect(generationResult).toEqual({ ok: true, data: { ...generatedClientBrief, generatedAt: expect.any(Date) } })
    expect(await getEndClientBrief(endClientId)).toEqual({
      ok: true,
      data: { endClientId, notes: null, brief: { ...generatedClientBrief, generatedAt: expect.any(Date) } },
    })
  })

  it('saves the personal notes of the end client', async () => {
    const user = await createTestUser()
    actAs(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Decathlon' })
    const endClientId = await findEndClientIdOrFail(user, jobApplicationId)

    expect(await updateEndClientNotes(endClientId, '  Parler de la refonte  ')).toEqual({ ok: true, data: null })

    expect(await getEndClientBrief(endClientId)).toEqual({
      ok: true,
      data: { endClientId, notes: 'Parler de la refonte', brief: null },
    })
  })

  it('prevents user B from reading, generating or annotating the brief of user A end client', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    actAs(userA)
    const jobApplicationId = await createJobApplicationOrFail(userA.client, userA.userId, { endClientName: 'Leroy Merlin' })
    const endClientId = await findEndClientIdOrFail(userA, jobApplicationId)
    await updateEndClientNotes(endClientId, 'Notes de A')

    actAs(userB)
    const endClientNotFound = { ok: false, errorMessage: 'Client final introuvable' }
    expect(await getEndClientBrief(endClientId)).toEqual(endClientNotFound)
    expect(await generateBriefForEndClient(endClientId)).toEqual(endClientNotFound)
    expect(generateClientBrief).not.toHaveBeenCalled()
    expect(await updateEndClientNotes(endClientId, 'Écrasé par B')).toEqual(endClientNotFound)

    actAs(userA)
    expect(await getEndClientBrief(endClientId)).toEqual({
      ok: true,
      data: { endClientId, notes: 'Notes de A', brief: null },
    })
  })
})

describe('interview actions', () => {
  it('stores the Paris wall-clock time as UTC, then updates, lists by start and deletes interviews', async () => {
    const user = await createTestUser()
    actAs(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const laterInterviewId = await createInterviewOrFail(jobApplicationId, buildInterviewInput())
    const earlierInterviewId = await createInterviewOrFail(
      jobApplicationId,
      buildInterviewInput({ parisLocalDateTime: '2026-07-01T14:00', kind: 'mock', participants: null }),
    )

    const { data: storedRows } = await user.client.from('interviews').select('id, starts_at').eq('id', laterInterviewId)
    expect(new Date(storedRows?.[0].starts_at ?? '').toISOString()).toBe('2026-10-28T13:00:00.000Z')

    expect(
      await updateInterview(laterInterviewId, buildInterviewInput({ format: 'onsite', notes: 'Apporter le CV' })),
    ).toEqual({ ok: true, data: null })

    expect(await listInterviewsForJobApplication(jobApplicationId)).toEqual({
      ok: true,
      data: [
        {
          id: earlierInterviewId,
          jobApplicationId,
          startsAt: new Date('2026-07-01T12:00:00.000Z'),
          kind: 'mock',
          format: 'video',
          participants: null,
          notes: null,
        },
        {
          id: laterInterviewId,
          jobApplicationId,
          startsAt: new Date('2026-10-28T13:00:00.000Z'),
          kind: 'client',
          format: 'onsite',
          participants: 'Jeanne Martin',
          notes: 'Apporter le CV',
        },
      ],
    })

    expect(await deleteInterview(earlierInterviewId)).toEqual({ ok: true, data: null })
    const listAfterDeletion = await listInterviewsForJobApplication(jobApplicationId)
    expect(listAfterDeletion.ok && listAfterDeletion.data.map(({ id }) => id)).toEqual([laterInterviewId])
  })

  it('lists the interviews of the period with their job application title, end client, mission description and stack', async () => {
    const user = await createTestUser()
    actAs(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Développeur React senior',
      endClientName: 'BNP Paribas Real Estate',
      endClientParentName: 'BNP Paribas',
      stack: jobApplicationStack,
      location: 'Paris',
      remotePolicy: '2 jours sur site',
      postedDailyRate: 650,
      requestedDailyRate: 700,
      desiredStart: 'ASAP',
      duration: '6 mois',
      postingRawText: 'Mission React pour une foncière',
    })
    const insideInterviewId = await createInterviewOrFail(jobApplicationId, buildInterviewInput())
    await createInterviewOrFail(jobApplicationId, buildInterviewInput({ parisLocalDateTime: '2026-11-20T10:00' }))

    expect(
      await listUpcomingInterviews(new Date('2026-10-27T00:00:00Z'), new Date('2026-11-04T00:00:00Z')),
    ).toEqual({
      ok: true,
      data: [
        {
          id: insideInterviewId,
          jobApplicationId,
          startsAt: new Date('2026-10-28T13:00:00.000Z'),
          kind: 'client',
          format: 'video',
          participants: 'Jeanne Martin',
          notes: null,
          jobApplicationTitle: 'Développeur React senior',
          endClientLabel: 'BNP Paribas Real Estate (BNP Paribas)',
          stack: jobApplicationStack,
          location: 'Paris',
          remotePolicy: '2 jours sur site',
          postedDailyRate: 650,
          requestedDailyRate: 700,
          desiredStart: 'ASAP',
          duration: '6 mois',
          postingRawText: 'Mission React pour une foncière',
        },
      ],
    })
  })

  it('prevents user B from creating, listing, updating or deleting interviews of user A', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    actAs(userA)
    const jobApplicationId = await createJobApplicationOrFail(userA.client, userA.userId)
    const interviewId = await createInterviewOrFail(jobApplicationId, buildInterviewInput())

    actAs(userB)
    const jobApplicationNotFound = { ok: false, errorMessage: 'Candidature introuvable' }
    const interviewNotFound = { ok: false, errorMessage: 'Entretien introuvable' }
    expect(await createInterview(jobApplicationId, buildInterviewInput())).toEqual(jobApplicationNotFound)
    expect(await listInterviewsForJobApplication(jobApplicationId)).toEqual(jobApplicationNotFound)
    expect(await updateInterview(interviewId, buildInterviewInput({ notes: 'Piraté' }))).toEqual(interviewNotFound)
    expect(await deleteInterview(interviewId)).toEqual(interviewNotFound)
    expect(
      await listUpcomingInterviews(new Date('2026-10-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z')),
    ).toEqual({ ok: true, data: [] })

    actAs(userA)
    const listResult = await listInterviewsForJobApplication(jobApplicationId)
    expect(listResult).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: interviewId, notes: null })],
    })
  })
})
