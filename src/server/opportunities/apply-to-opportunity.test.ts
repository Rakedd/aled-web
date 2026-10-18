/**
 * @jest-environment node
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { Opportunity } from '@/domain/opportunities'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobSpecStack } from '@/server/ai/extract-job-spec-stack'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import { findOpportunity } from '@/server/repositories/opportunities-repository'
import {
  findOpportunityDecision,
  upsertOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { applyToOpportunityForUser } from './apply-to-opportunity'

jest.mock('server-only', () => ({}))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))
jest.mock('@/server/ai/extract-job-spec-stack', () => ({ extractJobSpecStack: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/repositories/job-applications-repository', () => ({ insertJobApplication: jest.fn() }))
jest.mock('@/server/repositories/opportunities-repository', () => ({ findOpportunity: jest.fn() }))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({
  findOpportunityDecision: jest.fn(),
  upsertOpportunityDecision: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const opportunityId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const now = new Date('2026-10-18T22:30:00Z')
const fakeAnthropicClient = { messages: { create: jest.fn() } } as unknown as Anthropic

const opportunity: Opportunity = {
  id: opportunityId,
  source: 'free-work',
  externalId: '123',
  url: 'https://www.free-work.com/fr/tech-it/job-mission/dev-react',
  title: 'Dev React',
  company: 'Agence X',
  description: 'Mission React',
  rateMin: 450,
  rateMax: 550,
  rateLabel: null,
  currency: 'EUR',
  remoteMode: 'full',
  locationLabel: null,
  region: null,
  country: null,
  durationMonths: 6,
  publishedAt: new Date('2026-10-18T08:00:00Z'),
  skills: ['React'],
  receivedAt: new Date('2026-10-18T09:00:00Z'),
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(findOpportunity).mockResolvedValue(opportunity)
  jest.mocked(findOpportunityDecision).mockResolvedValue(null)
  jest.mocked(insertJobApplication).mockResolvedValue({ ok: true, data: { id: 'application-1' } })
  jest.mocked(upsertOpportunityDecision).mockResolvedValue({ ok: true, data: null })
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-api03-key')
  jest.mocked(createAnthropicClient).mockReturnValue(fakeAnthropicClient)
  jest.mocked(extractJobSpecStack).mockResolvedValue([])
})

describe('applyToOpportunityForUser', () => {
  it('creates the job application dated today in Paris, then records the applied decision', async () => {
    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(insertJobApplication).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      expect.objectContaining({ title: 'Dev React', source: 'Free-Work', appliedOn: new Date('2026-10-18T22:00:00Z') }),
    )
    expect(upsertOpportunityDecision).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', {
      opportunityId,
      decision: 'applied',
      jobApplicationId: 'application-1',
    })
  })

  it('returns the existing job application without creating another one', async () => {
    jest
      .mocked(findOpportunityDecision)
      .mockResolvedValue({ opportunityId, decision: 'applied', jobApplicationId: 'application-0' })

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-0' },
    })
    expect(insertJobApplication).not.toHaveBeenCalled()
    expect(upsertOpportunityDecision).not.toHaveBeenCalled()
    expect(getDecryptedAnthropicApiKeyForUser).not.toHaveBeenCalled()
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })

  it('extracts the stack from the description with one retry and a 30 second timeout', async () => {
    await applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)

    expect(getDecryptedAnthropicApiKeyForUser).toHaveBeenCalledWith('user-1')
    expect(createAnthropicClient).toHaveBeenCalledWith('sk-ant-api03-key')
    expect(extractJobSpecStack).toHaveBeenCalledWith(
      fakeAnthropicClient,
      { kind: 'text', text: 'Mission React' },
      { maxRetries: 1, timeout: 30_000 },
    )
  })

  it('creates the job application with the extracted stack merged after the Free-Work skills', async () => {
    jest.mocked(extractJobSpecStack).mockResolvedValue([
      { name: 'react', category: 'framework', origin: 'job_spec' },
      { name: 'TypeScript', category: 'language', origin: 'job_spec' },
    ])

    await applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)

    expect(insertJobApplication).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      expect.objectContaining({
        stack: [
          { name: 'React', category: 'other', origin: 'posting' },
          { name: 'TypeScript', category: 'language', origin: 'posting' },
        ],
      }),
    )
  })

  it('still creates the job application with the Free-Work skills when the extraction fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(extractJobSpecStack).mockRejectedValue(new Error('Claude failure'))

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(insertJobApplication).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      expect.objectContaining({ stack: [{ name: 'React', category: 'other', origin: 'posting' }] }),
    )
    consoleErrorSpy.mockRestore()
  })

  it('creates the job application without calling Claude when the user has no key', async () => {
    jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue(null)

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })

  it('applies to a dismissed opportunity', async () => {
    jest.mocked(findOpportunityDecision).mockResolvedValue({ opportunityId, decision: 'dismissed', jobApplicationId: null })

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(insertJobApplication).toHaveBeenCalledTimes(1)
  })

  it('answers « Opportunité introuvable » when the opportunity does not exist', async () => {
    jest.mocked(findOpportunity).mockResolvedValue(null)

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: false,
      errorMessage: 'Opportunité introuvable',
    })
    expect(insertJobApplication).not.toHaveBeenCalled()
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })

  it.each([
    ['throws', () => jest.mocked(upsertOpportunityDecision).mockRejectedValue(new Error('Repository failure'))],
    [
      'is refused',
      () => jest.mocked(upsertOpportunityDecision).mockResolvedValue({ ok: false, errorMessage: 'Opportunité introuvable' }),
    ],
  ])('logs and still returns the job application when the decision %s', async (_caseName, makeDecisionFail) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    makeDecisionFail()

    await expect(applyToOpportunityForUser(fakeSupabaseClient, 'user-1', opportunityId, now)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Applied opportunity decision was not recorded',
      expect.objectContaining({ opportunityId }),
    )
    consoleErrorSpy.mockRestore()
  })
})
