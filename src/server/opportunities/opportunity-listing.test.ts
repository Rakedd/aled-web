/** @jest-environment node */
import {
  NO_OPPORTUNITY_QUICK_FILTERS,
  type Opportunity,
  type OpportunityListingPosition,
  type OpportunityQuickFilters,
} from '@/domain/opportunities'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import {
  findLastOpportunityReceivedAt,
  listOpportunitiesByIds,
  listOpportunitySkillsPublishedSince,
  listOpportunitySummariesPublishedSince,
  type OpportunitySummary,
} from '@/server/repositories/opportunities-repository'
import { listOpportunityDecisions } from '@/server/repositories/opportunity-decisions-repository'
import { findOpportunityFilters } from '@/server/repositories/opportunity-filters-repository'
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
  listOpportunitySkillsPublishedSince: jest.fn(),
  listOpportunitySummariesPublishedSince: jest.fn(),
}))
jest.mock('@/server/repositories/opportunity-decisions-repository', () => ({ listOpportunityDecisions: jest.fn() }))
jest.mock('@/server/repositories/opportunity-filters-repository', () => ({ findOpportunityFilters: jest.fn() }))
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
        company: null,
        rateMin: null,
        rateMax: 550,
        remoteMode: 'partial',
        region: null,
        locationLabel: null,
        publishedAt: new Date('2026-10-17T09:00:00Z'),
      },
    ])
    jest.mocked(listOpportunityDecisions).mockResolvedValue([])
    jest.mocked(findOpportunityFilters).mockResolvedValue(EMPTY_OPPORTUNITY_FILTERS)
    jest.mocked(findLastOpportunityReceivedAt).mockResolvedValue(null)
    jest.mocked(findOpportunitiesLastViewedAt).mockResolvedValue(null)
    jest.mocked(listOpportunitiesByIds).mockResolvedValue([])
  })

  it('loads the summaries, decisions and filters once per request for the layout count and the listing', async () => {
    const [toProcessCount, listing] = await Promise.all([
      countOpportunitiesToProcessForUser(layoutClient, 'user-1', NOW),
      buildOpportunityListing(
        pageClient,
        'user-1',
        { tab: 'to_process', after: null, search: '', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
        NOW,
      ),
    ])

    expect(toProcessCount).toBe(1)
    expect(listing.counts.to_process).toBe(1)
    expect(listOpportunitySummariesPublishedSince).toHaveBeenCalledTimes(1)
    expect(listOpportunityDecisions).toHaveBeenCalledTimes(1)
    expect(findOpportunityFilters).toHaveBeenCalledTimes(1)
    expect(findOpportunityFilters).toHaveBeenCalledWith(layoutClient, 'user-1')
    expect(listOpportunitySkillsPublishedSince).not.toHaveBeenCalled()
  })

  it('leaves out of the missions to process those of a disabled source', async () => {
    jest.mocked(findOpportunityFilters).mockResolvedValue({ ...EMPTY_OPPORTUNITY_FILTERS, disabledSources: ['free-work'] })

    await expect(countOpportunitiesToProcessForUser(layoutClient, 'user-disabled-source', NOW)).resolves.toBe(0)
  })

  it('matches the search on the title of loaded summaries and keeps decided missions searchable', async () => {
    jest.mocked(listOpportunityDecisions).mockResolvedValue([
      {
        opportunityId: '7a1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f61',
        decision: 'dismissed',
        jobApplicationId: null,
        opportunityPublishedAt: new Date('2026-10-10T09:00:00Z'),
        opportunityTitle: 'Architecte Cloud',
        opportunityCompany: 'Société Générale',
        opportunityLocationLabel: null,
        opportunityRateMin: null,
        opportunityRateMax: 600,
        opportunityRemoteMode: 'full',
      },
    ])

    const listing = await buildOpportunityListing(
      pageClient,
      'user-4',
      { tab: 'dismissed', after: null, search: 'societe generale', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
      NOW,
    )

    expect(listing.counts).toEqual({ to_process: 0, applied: 0, dismissed: 1 })
  })

  it('narrows the listing and its counts to the search while the to-process count stays unfiltered', async () => {
    const listing = await buildOpportunityListing(
      pageClient,
      'user-1',
      { tab: 'to_process', after: null, search: 'java', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
      NOW,
    )
    const toProcessCount = await countOpportunitiesToProcessForUser(pageClient, 'user-1', NOW)

    expect(listing.counts.to_process).toBe(0)
    expect(toProcessCount).toBe(1)
  })

  it('narrows the listing and its counts to the selected remote modes while the to-process count stays unfiltered', async () => {
    const listing = await buildOpportunityListing(
      pageClient,
      'user-5',
      { tab: 'to_process', after: null, search: '', quickFilters: { sortOrder: 'publication', remoteModes: ['full'] } },
      NOW,
    )
    const toProcessCount = await countOpportunitiesToProcessForUser(pageClient, 'user-5', NOW)

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

describe('rate sorted pagination', () => {
  const SORTED_BY_RATE: OpportunityQuickFilters = { sortOrder: 'rate', remoteModes: [] }

  const buildSummary = (id: string, rateMax: number | null, publishedAt: string): OpportunitySummary => ({
    id,
    source: 'free-work',
    title: `Mission ${id}`,
    company: null,
    rateMin: null,
    rateMax,
    remoteMode: 'partial',
    region: null,
    locationLabel: null,
    publishedAt: new Date(publishedAt),
  })

  const rateSortedSummaries = [
    buildSummary('undisclosed-older', null, '2026-10-16T05:00:00Z'),
    buildSummary('rate-650-tie-b', 650, '2026-10-17T09:00:00Z'),
    buildSummary('rate-500', 500, '2026-10-17T07:00:00Z'),
    buildSummary('rate-700', 700, '2026-10-16T09:00:00Z'),
    buildSummary('rate-650-older', 650, '2026-10-16T08:00:00Z'),
    buildSummary('undisclosed-newer', null, '2026-10-17T09:30:00Z'),
    buildSummary('rate-650-tie-c', 650, '2026-10-17T09:00:00Z'),
  ]

  const toCursorPosition = ({ id, publishedAt, rateMax }: OpportunitySummary): OpportunityListingPosition => ({
    id,
    publishedAt,
    rate: rateMax,
    matchPercent: null,
  })

  const findSummary = (id: string): OpportunitySummary => {
    const summary = rateSortedSummaries.find((candidate) => candidate.id === id)
    if (summary === undefined) throw new Error(`Unknown summary ${id}`)
    return summary
  }

  const toOpportunity = (summary: OpportunitySummary): Opportunity => ({
    ...summary,
    externalId: summary.id,
    url: `https://www.free-work.com/fr/tech-it/job-mission/${summary.id}`,
    description: null,
    rateLabel: null,
    currency: null,
    country: null,
    durationMonths: null,
    skills: [],
    receivedAt: summary.publishedAt,
  })

  const listIdsAfter = async (userId: string, after: OpportunityListingPosition | null): Promise<string[]> => {
    const listing = await buildOpportunityListing(
      pageClient,
      userId,
      { tab: 'to_process', after, search: '', quickFilters: SORTED_BY_RATE },
      NOW,
    )
    return listing.items.map(({ id }) => id)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(listOpportunitySummariesPublishedSince).mockResolvedValue(rateSortedSummaries)
    jest.mocked(listOpportunityDecisions).mockResolvedValue([])
    jest.mocked(findOpportunityFilters).mockResolvedValue(EMPTY_OPPORTUNITY_FILTERS)
    jest.mocked(findLastOpportunityReceivedAt).mockResolvedValue(null)
    jest.mocked(findOpportunitiesLastViewedAt).mockResolvedValue(null)
    jest.mocked(listOpportunitiesByIds).mockImplementation(async (_supabase, opportunityIds) =>
      opportunityIds.map((opportunityId) => toOpportunity(findSummary(opportunityId))),
    )
  })

  it('lists every mission by rate, ties by publication then id, undisclosed rates last', async () => {
    await expect(listIdsAfter('user-rate-1', null)).resolves.toEqual([
      'rate-700',
      'rate-650-tie-c',
      'rate-650-tie-b',
      'rate-650-older',
      'rate-500',
      'undisclosed-newer',
      'undisclosed-older',
    ])
  })

  it('continues right after a rated cursor inside a rate tie, without duplicate nor skip', async () => {
    await expect(listIdsAfter('user-rate-2', toCursorPosition(findSummary('rate-650-tie-c')))).resolves.toEqual([
      'rate-650-tie-b',
      'rate-650-older',
      'rate-500',
      'undisclosed-newer',
      'undisclosed-older',
    ])
  })

  it('continues with the first undisclosed rate after a cursor on the last rated mission', async () => {
    await expect(listIdsAfter('user-rate-3', toCursorPosition(findSummary('rate-500')))).resolves.toEqual([
      'undisclosed-newer',
      'undisclosed-older',
    ])
  })
})

describe('match sorted listing', () => {
  const SORTED_BY_MATCH: OpportunityQuickFilters = { sortOrder: 'match', remoteModes: [] }
  const SORTED_BY_RATE: OpportunityQuickFilters = { sortOrder: 'rate', remoteModes: [] }
  const MY_SKILLS = ['React', 'TypeScript']

  const buildSummary = (id: string, publishedAt: string): OpportunitySummary => ({
    id,
    source: 'free-work',
    title: `Mission ${id}`,
    company: null,
    rateMin: null,
    rateMax: 500,
    remoteMode: 'partial',
    region: null,
    locationLabel: null,
    publishedAt: new Date(publishedAt),
  })

  const matchSortedSummaries = [
    buildSummary('no-skill-newest', '2026-10-17T09:30:00Z'),
    buildSummary('match-50', '2026-10-17T09:00:00Z'),
    buildSummary('match-100-older', '2026-10-16T09:00:00Z'),
    buildSummary('match-100-tie-c', '2026-10-17T08:00:00Z'),
    buildSummary('match-0', '2026-10-17T07:00:00Z'),
    buildSummary('match-100-tie-b', '2026-10-17T08:00:00Z'),
    buildSummary('no-skill-older', '2026-10-15T09:00:00Z'),
  ]

  const SKILLS_BY_OPPORTUNITY_ID = new Map<string, string[]>([
    ['no-skill-newest', []],
    ['match-50', ['React', 'Java']],
    ['match-100-older', ['React.js', 'TS']],
    ['match-100-tie-c', ['TypeScript']],
    ['match-0', ['Java']],
    ['match-100-tie-b', ['reactjs']],
    ['no-skill-older', []],
  ])

  const findSummary = (id: string): OpportunitySummary => {
    const summary = matchSortedSummaries.find((candidate) => candidate.id === id)
    if (summary === undefined) throw new Error(`Unknown summary ${id}`)
    return summary
  }

  const toOpportunity = (summary: OpportunitySummary): Opportunity => ({
    ...summary,
    externalId: summary.id,
    url: `https://www.free-work.com/fr/tech-it/job-mission/${summary.id}`,
    description: null,
    rateLabel: null,
    currency: null,
    country: null,
    durationMonths: null,
    skills: SKILLS_BY_OPPORTUNITY_ID.get(summary.id) ?? [],
    receivedAt: summary.publishedAt,
  })

  const listAfter = async (
    userId: string,
    after: OpportunityListingPosition | null,
    quickFilters: OpportunityQuickFilters = SORTED_BY_MATCH,
  ) =>
    (
      await buildOpportunityListing(
        pageClient,
        userId,
        { tab: 'to_process', after, search: '', quickFilters },
        NOW,
      )
    ).items

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(listOpportunitySummariesPublishedSince).mockResolvedValue(matchSortedSummaries)
    jest.mocked(listOpportunitySkillsPublishedSince).mockResolvedValue(SKILLS_BY_OPPORTUNITY_ID)
    jest.mocked(listOpportunityDecisions).mockResolvedValue([])
    jest.mocked(findOpportunityFilters).mockResolvedValue({ ...EMPTY_OPPORTUNITY_FILTERS, mySkills: MY_SKILLS })
    jest.mocked(findLastOpportunityReceivedAt).mockResolvedValue(null)
    jest.mocked(findOpportunitiesLastViewedAt).mockResolvedValue(null)
    jest.mocked(listOpportunitiesByIds).mockImplementation(async (_supabase, opportunityIds) =>
      opportunityIds.map((opportunityId) => toOpportunity(findSummary(opportunityId))),
    )
  })

  it('lists by match percent, ties by publication then id, unknown matches last, and carries the percent', async () => {
    const items = await listAfter('user-match-1', null)

    expect(items.map(({ id, sortMatchPercent }) => [id, sortMatchPercent])).toEqual([
      ['match-100-tie-c', 100],
      ['match-100-tie-b', 100],
      ['match-100-older', 100],
      ['match-50', 50],
      ['match-0', 0],
      ['no-skill-newest', null],
      ['no-skill-older', null],
    ])
    expect(listOpportunitySkillsPublishedSince).toHaveBeenCalledTimes(1)
    const [, summariesPublishedSince] = jest.mocked(listOpportunitySummariesPublishedSince).mock.calls[0]
    expect(listOpportunitySkillsPublishedSince).toHaveBeenCalledWith(pageClient, summariesPublishedSince)
  })

  it('continues right after a cursor inside a match tie, without duplicate nor skip', async () => {
    const tieCursor: OpportunityListingPosition = {
      id: 'match-100-tie-c',
      publishedAt: new Date('2026-10-17T08:00:00Z'),
      rate: 500,
      matchPercent: 100,
    }

    expect((await listAfter('user-match-2', tieCursor)).map(({ id }) => id)).toEqual([
      'match-100-tie-b',
      'match-100-older',
      'match-50',
      'match-0',
      'no-skill-newest',
      'no-skill-older',
    ])
  })

  it('continues with the unknown matches after a cursor on the last known match', async () => {
    const lastKnownMatchCursor: OpportunityListingPosition = {
      id: 'match-0',
      publishedAt: new Date('2026-10-17T07:00:00Z'),
      rate: 500,
      matchPercent: 0,
    }

    expect((await listAfter('user-match-3', lastKnownMatchCursor)).map(({ id }) => id)).toEqual([
      'no-skill-newest',
      'no-skill-older',
    ])
  })

  it.each([
    ['publication', NO_OPPORTUNITY_QUICK_FILTERS],
    ['rate', SORTED_BY_RATE],
  ])('never loads the skills when sorting by %s, and carries no match percent', async (_sortName, quickFilters) => {
    const items = await listAfter('user-match-4', null, quickFilters)

    expect(items.map(({ sortMatchPercent }) => sortMatchPercent)).toEqual(Array(7).fill(null))
    expect(listOpportunitySkillsPublishedSince).not.toHaveBeenCalled()
  })

  it('never loads the skills for the layout count', async () => {
    await expect(countOpportunitiesToProcessForUser(layoutClient, 'user-match-6', NOW)).resolves.toBe(7)
    expect(listOpportunitySkillsPublishedSince).not.toHaveBeenCalled()
  })

  it('never loads the skills when I have no skill', async () => {
    jest.mocked(findOpportunityFilters).mockResolvedValue(EMPTY_OPPORTUNITY_FILTERS)

    const items = await listAfter('user-match-7', null)

    expect(items.map(({ id }) => id)).toEqual([
      'no-skill-newest',
      'match-50',
      'match-100-tie-c',
      'match-100-tie-b',
      'match-0',
      'match-100-older',
      'no-skill-older',
    ])
    expect(listOpportunitySkillsPublishedSince).not.toHaveBeenCalled()
  })

  it('gives no match percent to the decided missions, whose snapshots have no skills, without loading skills', async () => {
    jest.mocked(listOpportunityDecisions).mockResolvedValue([
      {
        opportunityId: 'match-100-older',
        decision: 'applied',
        jobApplicationId: '8b1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f62',
        opportunityPublishedAt: new Date('2026-10-16T09:00:00Z'),
        opportunityTitle: 'Mission match-100-older',
        opportunityCompany: null,
        opportunityLocationLabel: null,
        opportunityRateMin: null,
        opportunityRateMax: 500,
        opportunityRemoteMode: 'partial',
      },
      {
        opportunityId: 'match-0',
        decision: 'applied',
        jobApplicationId: '9c1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f63',
        opportunityPublishedAt: new Date('2026-10-17T07:00:00Z'),
        opportunityTitle: 'Mission match-0',
        opportunityCompany: null,
        opportunityLocationLabel: null,
        opportunityRateMin: null,
        opportunityRateMax: 500,
        opportunityRemoteMode: 'partial',
      },
    ])

    const listing = await buildOpportunityListing(
      pageClient,
      'user-match-5',
      { tab: 'applied', after: null, search: '', quickFilters: SORTED_BY_MATCH },
      NOW,
    )

    expect(listing.items.map(({ id, sortMatchPercent }) => [id, sortMatchPercent])).toEqual([
      ['match-0', null],
      ['match-100-older', null],
    ])
    expect(listOpportunitySkillsPublishedSince).not.toHaveBeenCalled()
  })
})
