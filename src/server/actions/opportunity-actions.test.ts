/**
 * @jest-environment node
 */
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import type { OpportunityListingCursor, OpportunityQuickFilters } from '@/domain/opportunities'
import { applyToOpportunityForUser } from '@/server/opportunities/apply-to-opportunity'
import { buildOpportunityListing } from '@/server/opportunities/opportunity-listing'
import {
  deleteDismissedOpportunityDecision,
  recordDismissedOpportunityDecision,
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
  recordDismissedOpportunityDecision: jest.fn(),
  deleteDismissedOpportunityDecision: jest.fn(),
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
    expect(recordDismissedOpportunityDecision).not.toHaveBeenCalled()
    expect(deleteDismissedOpportunityDecision).not.toHaveBeenCalled()
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
  it('records a dismissed decision for the authenticated user', async () => {
    jest.mocked(recordDismissedOpportunityDecision).mockResolvedValue({ ok: true, data: null })

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })
    expect(recordDismissedOpportunityDecision).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', opportunityId)
  })

  it('relays the refusal when the opportunity was already applied to', async () => {
    jest
      .mocked(recordDismissedOpportunityDecision)
      .mockResolvedValue({ ok: false, errorMessage: 'Tu as déjà postulé à cette mission' })

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Tu as déjà postulé à cette mission',
    })
  })
})

describe('restoreOpportunity', () => {
  it('deletes the dismissed decision of the authenticated user', async () => {
    jest.mocked(deleteDismissedOpportunityDecision).mockResolvedValue(true)

    await expect(restoreOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })
    expect(deleteDismissedOpportunityDecision).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', opportunityId)
  })

  it('refuses when no dismissed decision was deleted', async () => {
    jest.mocked(deleteDismissedOpportunityDecision).mockResolvedValue(false)

    await expect(restoreOpportunity(opportunityId)).resolves.toEqual({
      ok: false,
      errorMessage: "Cette mission n'est pas ignorée",
    })
  })
})

describe('listOpportunities', () => {
  it.each([
    ['an unknown tab', 'archived', null],
    ['a page number', 'to_process', 2],
    ['a cursor with an invalid id', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: '42' }],
  ])('rejects %s without querying the database', async (_caseName, tab, cursor) => {
    await expect(
      listOpportunities(tab as 'to_process', cursor as OpportunityListingCursor | null, ''),
    ).resolves.toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
    expect(buildOpportunityListing).not.toHaveBeenCalled()
  })

  it('rejects a search longer than 100 characters without querying the database', async () => {
    await expect(listOpportunities('to_process', null, 'a'.repeat(101))).resolves.toEqual({
      ok: false,
      errorMessage: 'La recherche ne peut pas dépasser 100 caractères',
    })
    expect(buildOpportunityListing).not.toHaveBeenCalled()
  })

  it('lists the items after the cursor for the authenticated user', async () => {
    const listing = {
      items: [],
      hasMore: false,
      counts: { to_process: 0, applied: 0, dismissed: 0 },
      lastReceivedAt: null,
      lastViewedAt: null,
    }
    jest.mocked(buildOpportunityListing).mockResolvedValue(listing)

    await expect(
      listOpportunities(
        'to_process',
        { publishedAt: '2026-10-17T09:00:00.000Z', id: opportunityId, rate: null, matchPercent: 80 },
        '  react ',
      ),
    ).resolves.toEqual({ ok: true, data: listing })
    expect(buildOpportunityListing).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      {
        tab: 'to_process',
        after: { publishedAt: new Date('2026-10-17T09:00:00.000Z'), id: opportunityId, rate: null, matchPercent: 80 },
        search: 'react',
        quickFilters: { sortOrder: 'publication', remoteModes: [] },
      },
      expect.any(Date),
    )
  })

  it('passes the validated quick filters to the listing', async () => {
    jest.mocked(buildOpportunityListing).mockResolvedValue({
      items: [],
      hasMore: false,
      counts: { to_process: 0, applied: 0, dismissed: 0 },
      lastReceivedAt: null,
      lastViewedAt: null,
    })

    await listOpportunities('applied', null, '', { sortOrder: 'match', remoteModes: ['none', 'full'] })

    expect(buildOpportunityListing).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      { tab: 'applied', after: null, search: '', quickFilters: { sortOrder: 'match', remoteModes: ['full', 'none'] } },
      expect.any(Date),
    )
  })

  it('rejects invalid quick filters without querying the database', async () => {
    await expect(
      listOpportunities('to_process', null, '', { sortOrder: 'publication', remoteModes: ['moon'] } as unknown as OpportunityQuickFilters),
    ).resolves.toEqual({ ok: false, errorMessage: 'Filtres rapides invalides' })
    expect(buildOpportunityListing).not.toHaveBeenCalled()
  })
})

describe('getOpportunityFilters', () => {
  it('loads the shared filters of the authenticated user', async () => {
    jest.mocked(findOpportunityFilters).mockResolvedValue(EMPTY_OPPORTUNITY_FILTERS)

    await expect(getOpportunityFilters()).resolves.toEqual({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
    expect(findOpportunityFilters).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })
})

describe('saveOpportunityFilters', () => {
  it('rejects a negative rate floor without querying the database', async () => {
    await expect(
      saveOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, rateFloorHybrid: -1 }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Le TJM minimum doit être un entier entre 0 et 5000' })
    expect(upsertOpportunityFilters).not.toHaveBeenCalled()
  })

  it('saves the validated filters of the authenticated user only', async () => {
    const savedFilters = { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: ['react'] }
    jest.mocked(upsertOpportunityFilters).mockResolvedValue(savedFilters)

    await expect(
      saveOpportunityFilters({ ...savedFilters, includeKeywords: [' react ', ''], user_id: 'user-2' }),
    ).resolves.toEqual({ ok: true, data: savedFilters })
    expect(upsertOpportunityFilters).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', savedFilters)
  })

  it('refuses to disable every source without querying the database', async () => {
    await expect(
      saveOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, disabledSources: ['free-work', 'collective'] }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Garde au moins une source active' })
    expect(upsertOpportunityFilters).not.toHaveBeenCalled()
  })
})
