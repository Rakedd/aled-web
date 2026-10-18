/** @jest-environment node */
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import {
  findLastOpportunityReceivedAt,
  listOpportunitiesByIds,
  listOpportunitySearchFieldsPublishedSince,
  listOpportunitySummariesPublishedSince,
} from '@/server/repositories/opportunities-repository'
import { listOpportunityDecisions } from '@/server/repositories/opportunity-decisions-repository'
import { findOpportunityFiltersBySource } from '@/server/repositories/opportunity-filters-repository'
import { findOpportunitiesLastViewedAt } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { buildOpportunityListing, countOpportunitiesToProcessForUser } from './opportunity-listing'

jest.mock('server-only', () => ({}))
jest.mock('react', () => {
  const requestScopedValues = new Map<() => unknown, unknown>()
  return {
    cache:
      <Value,>(createValue: () => Value) =>
      (): Value => {
        if (!requestScopedValues.has(createValue)) requestScopedValues.set(createValue, createValue())
        return requestScopedValues.get(createValue) as Value
      },
  }
})
jest.mock('@/server/repositories/opportunities-repository', () => ({
  findLastOpportunityReceivedAt: jest.fn(),
  listOpportunitiesByIds: jest.fn(),
  listOpportunitySearchFieldsPublishedSince: jest.fn(),
  listOpportunitySummariesPublishedSince: jest.fn(),
}))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({ listOpportunityDecisions: jest.fn() }))
jest.mock('@/server/repositories/opportunity-filters-repository', () => ({ findOpportunityFiltersBySource: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ findOpportunitiesLastViewedAt: jest.fn() }))

const NOW = new Date('2026-10-18T10:00:00Z')
const layoutClient = { from: jest.fn() } as unknown as FreeclutchSupabaseClient
const pageClient = { from: jest.fn() } as unknown as FreeclutchSupabaseClient

describe('to-process context loading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(listOpportunitySummariesPublishedSince).mockResolvedValue([
      {
        id: '6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60',
        source: 'free-work',
        title: 'Développeur React',
        rateMin: null,
        rateMax: 550,
        remoteMode: 'partial',
        region: null,
        locationLabel: null,
        publishedAt: new Date('2026-10-17T09:00:00Z'),
      },
    ])
    jest.mocked(listOpportunityDecisions).mockResolvedValue([])
    jest.mocked(findOpportunityFiltersBySource).mockResolvedValue(new Map([['free-work', EMPTY_OPPORTUNITY_FILTERS]]))
    jest.mocked(findLastOpportunityReceivedAt).mockResolvedValue(null)
    jest.mocked(findOpportunitiesLastViewedAt).mockResolvedValue(null)
    jest.mocked(listOpportunitiesByIds).mockResolvedValue([])
  })

  it('loads the summaries, decisions and filters once per request for the layout count and the listing', async () => {
    const [toProcessCount, listing] = await Promise.all([
      countOpportunitiesToProcessForUser(layoutClient, 'user-1', NOW),
      buildOpportunityListing(pageClient, 'user-1', { tab: 'to_process', after: null, search: '' }, NOW),
    ])

    expect(toProcessCount).toBe(1)
    expect(listing.counts.to_process).toBe(1)
    expect(listOpportunitySummariesPublishedSince).toHaveBeenCalledTimes(1)
    expect(listOpportunityDecisions).toHaveBeenCalledTimes(1)
    expect(findOpportunityFiltersBySource).toHaveBeenCalledTimes(1)
  })

  it('does not load the search fields without a search', async () => {
    await buildOpportunityListing(pageClient, 'user-1', { tab: 'to_process', after: null, search: '' }, NOW)

    expect(listOpportunitySearchFieldsPublishedSince).not.toHaveBeenCalled()
  })

  it('narrows the listing and its counts to the search while the to-process count stays unfiltered', async () => {
    jest.mocked(listOpportunitySearchFieldsPublishedSince).mockResolvedValue([
      { id: '6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60', title: 'Développeur React', company: null, locationLabel: null },
    ])

    const listing = await buildOpportunityListing(
      pageClient,
      'user-1',
      { tab: 'to_process', after: null, search: 'java' },
      NOW,
    )
    const toProcessCount = await countOpportunitiesToProcessForUser(pageClient, 'user-1', NOW)

    expect(listing.counts.to_process).toBe(0)
    expect(toProcessCount).toBe(1)
  })

  it('never shares the context of one user with another', async () => {
    await countOpportunitiesToProcessForUser(layoutClient, 'user-2', NOW)
    await countOpportunitiesToProcessForUser(layoutClient, 'user-3', NOW)

    expect(listOpportunityDecisions).toHaveBeenCalledTimes(2)
    expect(listOpportunityDecisions).toHaveBeenNthCalledWith(1, layoutClient, 'user-2')
    expect(listOpportunityDecisions).toHaveBeenNthCalledWith(2, layoutClient, 'user-3')
  })
})
