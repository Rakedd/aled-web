/**
 * @jest-environment node
 */
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import type { OpportunitySource } from '@/domain/opportunities'
import { applyToOpportunityForUser } from '@/server/opportunities/apply-to-opportunity'
import { buildOpportunityListing } from '@/server/opportunities/opportunity-listing'
import {
  deleteOpportunityDecision,
  upsertOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import {
  findOpportunityFilters,
  upsertOpportunityFilters,
} from '@/server/repositories/opportunity-filters-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import {
  applyToOpportunity,
  dismissOpportunity,
  getOpportunityFilters,
  listOpportunities,
  restoreOpportunity,
  saveOpportunityFilters,
} from './opportunity-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/opportunities/apply-to-opportunity', () => ({ applyToOpportunityForUser: jest.fn() }))
jest.mock('@/server/opportunities/opportunity-listing', () => ({
  buildOpportunityListing: jest.fn(),
  countOpportunitiesToProcessForUser: jest.fn(),
}))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({
  upsertOpportunityDecision: jest.fn(),
  deleteOpportunityDecision: jest.fn(),
}))
jest.mock('@/server/repositories/opportunity-filters-repository', () => ({
  findOpportunityFilters: jest.fn(),
  upsertOpportunityFilters: jest.fn(),
}))
jest.mock('@/server/repositories/opportunities-repository', () => ({ listOpportunityRegionsPublishedSince: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ recordOpportunitiesViewedAt: jest.fn() }))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const opportunityId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const notFound = { ok: false, errorMessage: 'Opportunité introuvable' } as const

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
})

describe('opportunity id validation', () => {
  it.each([
    ['applyToOpportunity', applyToOpportunity],
    ['dismissOpportunity', dismissOpportunity],
    ['restoreOpportunity', restoreOpportunity],
  ])('%s rejects an id that is not a uuid without querying the database', async (_actionName, action) => {
    await expect(action('42')).resolves.toEqual(notFound)
    await expect(action("'; drop table opportunities; --")).resolves.toEqual(notFound)
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
    expect(applyToOpportunityForUser).not.toHaveBeenCalled()
    expect(upsertOpportunityDecision).not.toHaveBeenCalled()
    expect(deleteOpportunityDecision).not.toHaveBeenCalled()
  })
})

describe('applyToOpportunity', () => {
  it('applies for the authenticated user', async () => {
    jest.mocked(applyToOpportunityForUser).mockResolvedValue({ ok: true, data: { jobApplicationId: 'application-1' } })

    await expect(applyToOpportunity(opportunityId)).resolves.toEqual({
      ok: true,
      data: { jobApplicationId: 'application-1' },
    })
    expect(applyToOpportunityForUser).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', opportunityId, expect.any(Date))
  })
})

describe('dismissOpportunity', () => {
  it('records a dismissed decision without job application', async () => {
    jest.mocked(upsertOpportunityDecision).mockResolvedValue({ ok: true, data: null })

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })
    expect(upsertOpportunityDecision).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', {
      opportunityId,
      decision: 'dismissed',
      jobApplicationId: null,
    })
  })
})

describe('listOpportunities', () => {
  it.each([
    ['an unknown tab', 'archived', 1],
    ['a page below 1', 'to_process', 0],
    ['a fractional page', 'to_process', 1.5],
  ])('rejects %s without querying the database', async (_caseName, tab, page) => {
    await expect(listOpportunities(tab as 'to_process', page)).resolves.toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
    expect(buildOpportunityListing).not.toHaveBeenCalled()
  })
})

describe('getOpportunityFilters', () => {
  it('rejects an unknown source without querying the database', async () => {
    await expect(getOpportunityFilters('linkedin' as OpportunitySource)).resolves.toEqual({
      ok: false,
      errorMessage: 'Source inconnue',
    })
    expect(findOpportunityFilters).not.toHaveBeenCalled()
  })
})

describe('saveOpportunityFilters', () => {
  it('rejects a negative rate floor without querying the database', async () => {
    await expect(
      saveOpportunityFilters('free-work', { ...EMPTY_OPPORTUNITY_FILTERS, rateFloorHybrid: -1 }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Le TJM minimum doit être un entier entre 0 et 5000' })
    expect(upsertOpportunityFilters).not.toHaveBeenCalled()
  })

  it('saves the validated filters of the authenticated user only', async () => {
    const savedFilters = { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: ['react'] }
    jest.mocked(upsertOpportunityFilters).mockResolvedValue(savedFilters)

    await expect(
      saveOpportunityFilters('free-work', { ...savedFilters, includeKeywords: [' react ', ''], user_id: 'user-2' }),
    ).resolves.toEqual({ ok: true, data: savedFilters })
    expect(upsertOpportunityFilters).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', 'free-work', savedFilters)
  })
})
