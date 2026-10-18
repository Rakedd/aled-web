/**
 * @jest-environment node
 */
import type { Opportunity } from '@/domain/opportunities'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import { findOpportunity } from '@/server/repositories/opportunities-repository'
import {
  findOpportunityDecision,
  upsertOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { applyToOpportunityForUser } from './apply-to-opportunity'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/job-applications-repository', () => ({ insertJobApplication: jest.fn() }))
jest.mock('@/server/repositories/opportunities-repository', () => ({ findOpportunity: jest.fn() }))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({
  findOpportunityDecision: jest.fn(),
  upsertOpportunityDecision: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const opportunityId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const now = new Date('2026-10-18T22:30:00Z')

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
