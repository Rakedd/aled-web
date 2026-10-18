import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpportunityListing, OpportunityTab } from '@/domain/opportunities'
import { EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from '@/domain/opportunity-filters'
import {
  applyToOpportunity,
  countOpportunitiesToProcess,
  dismissOpportunity,
  getOpportunityFilters,
  listKnownOpportunityRegions,
  listOpportunities,
  markOpportunitiesViewed,
  restoreOpportunity,
  saveOpportunityFilters,
} from '@/server/actions/opportunity-actions'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

type SeededOpportunity = { title: string; daysAgo?: number; region?: string | null }

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`opportunity-actions-${randomUUID()}@test.local`)

const actAs = (user: TestUser): void => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const buildUniqueKeyword = (): string => `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`

const seedOpportunityOrFail = async ({ title, daysAgo = 0, region = null }: SeededOpportunity): Promise<string> => {
  const externalId = randomUUID()
  const { data, error } = await createServiceRoleTestClient()
    .from('opportunities')
    .insert({
      source: 'free-work',
      external_id: externalId,
      url: `https://www.free-work.com/fr/tech-it/job-mission/${externalId}`,
      title,
      title_normalized: title.toLowerCase(),
      company: 'Agence X',
      description: 'Mission longue',
      rate_max: 550,
      remote_mode: 'partial',
      location_label: region,
      region,
      duration_months: 6,
      skills: ['React'],
      published_at: new Date(Date.now() - daysAgo * MILLISECONDS_PER_DAY - 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const filtersWith = (overrides: Partial<OpportunityFilters>): OpportunityFilters => ({
  ...EMPTY_OPPORTUNITY_FILTERS,
  ...overrides,
})

const saveFiltersOrFail = async (filters: OpportunityFilters): Promise<void> => {
  const saveResult = await saveOpportunityFilters('free-work', filters)
  if (!saveResult.ok) throw new Error(saveResult.errorMessage)
}

const listOrFail = async (tab: OpportunityTab, page = 1): Promise<OpportunityListing> => {
  const listingResult = await listOpportunities(tab, page)
  if (!listingResult.ok) throw new Error(listingResult.errorMessage)
  return listingResult.data
}

const listEveryItemOrFail = async (tab: OpportunityTab, page = 1): Promise<OpportunityListing['items']> => {
  const listing = await listOrFail(tab, page)
  return listing.hasMore ? [...listing.items, ...(await listEveryItemOrFail(tab, page + 1))] : listing.items
}

const listIdsOrFail = async (tab: OpportunityTab): Promise<string[]> =>
  (await listOrFail(tab)).items.map((listItem) => listItem.id)

const listJobApplicationRowsOfUser = async (userId: string) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('job_applications')
    .select('id, title, status, source')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listOpportunities', () => {
  it('only lists the opportunities of the last 7 days matching the include keywords in « À traiter »', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const recentReactId = await seedOpportunityOrFail({ title: `Développeur React ${keyword}`, daysAgo: 1 })
    const javaId = await seedOpportunityOrFail({ title: `Développeur Java ${keyword}`, daysAgo: 1 })
    const olderReactId = await seedOpportunityOrFail({ title: `Lead React ${keyword}`, daysAgo: 10 })
    await saveFiltersOrFail(filtersWith({ includeKeywords: ['react'] }))

    const toProcessItems = await listEveryItemOrFail('to_process')

    const listedIds = toProcessItems.map((listItem) => listItem.id)
    expect(listedIds).toContain(recentReactId)
    expect(listedIds).not.toContain(javaId)
    expect(listedIds).not.toContain(olderReactId)
    expect(toProcessItems.every((listItem) => /\breact\b/i.test(listItem.title))).toBe(true)
    expect(toProcessItems.find((listItem) => listItem.id === recentReactId)).toMatchObject({
      title: `Développeur React ${keyword}`,
      company: 'Agence X',
      rateMax: 550,
      remoteMode: 'partial',
      skills: ['React'],
      decision: null,
      jobApplicationId: null,
    })
  })

  it('sorts by publication date, paginates by 50 and counts the three tabs', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const olderId = await seedOpportunityOrFail({ title: `Mission ${keyword} ancienne`, daysAgo: 3 })
    const newerId = await seedOpportunityOrFail({ title: `Mission ${keyword} récente`, daysAgo: 1 })
    await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

    const listing = await listOrFail('to_process')

    expect(listing.items.map((listItem) => listItem.id)).toEqual([newerId, olderId])
    expect(listing.hasMore).toBe(false)
    expect(listing.counts).toEqual({ to_process: 2, applied: 0, dismissed: 0 })
    expect(listing.lastReceivedAt).toBeInstanceOf(Date)
    expect(listing.lastViewedAt).toBeNull()
    await expect(listOrFail('to_process', 2)).resolves.toMatchObject({ items: [], hasMore: false })
    await expect(countOpportunitiesToProcess()).resolves.toEqual({ ok: true, data: 2 })
  })

  it('rejects an unknown tab or a page below 1', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(listOpportunities('archived' as OpportunityTab, 1)).resolves.toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
    await expect(listOpportunities('to_process', 0)).resolves.toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
  })
})

describe('applyToOpportunity', () => {
  it('creates a single Free-Work job application when called twice and returns the same id', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${keyword}` })
    await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

    const firstApplication = await applyToOpportunity(opportunityId)
    const secondApplication = await applyToOpportunity(opportunityId)

    expect(firstApplication.ok).toBe(true)
    expect(secondApplication).toEqual(firstApplication)
    const jobApplicationRows = await listJobApplicationRowsOfUser(user.userId)
    expect(jobApplicationRows).toEqual([
      {
        id: firstApplication.ok ? firstApplication.data.jobApplicationId : '',
        title: `Développeur React ${keyword}`,
        status: 'applied',
        source: 'Free-Work',
      },
    ])
    const appliedListing = await listOrFail('applied')
    expect(appliedListing.items).toEqual([
      expect.objectContaining({
        id: opportunityId,
        decision: 'applied',
        jobApplicationId: firstApplication.ok ? firstApplication.data.jobApplicationId : '',
      }),
    ])
    expect(appliedListing.counts).toEqual({ to_process: 0, applied: 1, dismissed: 0 })
  })

  it('creates a new job application when the previous one was deleted', async () => {
    const user = await createTestUser()
    actAs(user)
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${buildUniqueKeyword()}` })
    const firstApplication = await applyToOpportunity(opportunityId)
    if (!firstApplication.ok) throw new Error(firstApplication.errorMessage)
    await user.client.from('job_applications').delete().eq('id', firstApplication.data.jobApplicationId)

    const secondApplication = await applyToOpportunity(opportunityId)

    expect(secondApplication.ok && secondApplication.data.jobApplicationId).not.toBe(
      firstApplication.data.jobApplicationId,
    )
    expect(await listJobApplicationRowsOfUser(user.userId)).toHaveLength(1)
  })

  it('answers « Opportunité introuvable » for an unknown opportunity', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(applyToOpportunity(randomUUID())).resolves.toEqual({
      ok: false,
      errorMessage: 'Opportunité introuvable',
    })
    await expect(dismissOpportunity(randomUUID())).resolves.toEqual({
      ok: false,
      errorMessage: 'Opportunité introuvable',
    })
    expect(await listJobApplicationRowsOfUser(user.userId)).toEqual([])
  })
})

describe('dismissOpportunity and restoreOpportunity', () => {
  it('moves a dismissed opportunity to « Ignorées » and restores it to « À traiter »', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${keyword}` })
    await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })

    expect(await listIdsOrFail('to_process')).toEqual([])
    const dismissedListing = await listOrFail('dismissed')
    expect(dismissedListing.items).toEqual([expect.objectContaining({ id: opportunityId, decision: 'dismissed' })])
    expect(dismissedListing.counts).toEqual({ to_process: 0, applied: 0, dismissed: 1 })

    await expect(restoreOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })

    expect(await listIdsOrFail('to_process')).toEqual([opportunityId])
    expect(await listIdsOrFail('dismissed')).toEqual([])
  })
})

describe('user isolation', () => {
  it('keeps the decisions and filters of A away from B, and applies for B only', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const keyword = buildUniqueKeyword()
    const dismissedByAId = await seedOpportunityOrFail({ title: `Développeur React ${keyword}` })
    const appliedByBothId = await seedOpportunityOrFail({ title: `Lead React ${keyword}` })
    actAs(userA)
    await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword], rateFloorHybrid: 600 }))
    await dismissOpportunity(dismissedByAId)
    const applicationOfA = await applyToOpportunity(appliedByBothId)

    actAs(userB)
    await expect(getOpportunityFilters('free-work')).resolves.toEqual({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
    expect(await listIdsOrFail('dismissed')).toEqual([])
    expect(await listIdsOrFail('applied')).toEqual([])
    const applicationOfB = await applyToOpportunity(appliedByBothId)

    expect(applicationOfB.ok && applicationOfA.ok).toBe(true)
    expect(applicationOfB).not.toEqual(applicationOfA)
    expect(await listJobApplicationRowsOfUser(userB.userId)).toEqual([
      expect.objectContaining({ id: applicationOfB.ok ? applicationOfB.data.jobApplicationId : '' }),
    ])
    expect(await listJobApplicationRowsOfUser(userA.userId)).toEqual([
      expect.objectContaining({ id: applicationOfA.ok ? applicationOfA.data.jobApplicationId : '' }),
    ])
    actAs(userA)
    expect(await listIdsOrFail('dismissed')).toEqual([dismissedByAId])
    await expect(getOpportunityFilters('free-work')).resolves.toEqual({
      ok: true,
      data: filtersWith({ includeKeywords: [keyword], rateFloorHybrid: 600 }),
    })
  })
})

describe('opportunity filters', () => {
  it('returns empty filters before the first save and the saved filters afterwards', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(getOpportunityFilters('free-work')).resolves.toEqual({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })

    const savedFilters = filtersWith({
      includeKeywords: ['React', 'Next.js'],
      alwaysExcludeKeywords: ['stage'],
      rescuableExcludeKeywords: ['java'],
      rescueKeywords: ['react'],
      rateFloorFullRemote: 500,
      rateFloorOnsite: 650,
      regions: ['Île-de-France'],
    })
    const unnormalizedFilters = { ...savedFilters, includeKeywords: [' React ', 'react', 'Next.js'] }
    await expect(saveOpportunityFilters('free-work', unnormalizedFilters)).resolves.toEqual({ ok: true, data: savedFilters })
    await expect(saveOpportunityFilters('free-work', savedFilters)).resolves.toEqual({ ok: true, data: savedFilters })
    await expect(getOpportunityFilters('free-work')).resolves.toEqual({ ok: true, data: savedFilters })
  })
})

describe('markOpportunitiesViewed', () => {
  it('records the last visit returned by the listing', async () => {
    const user = await createTestUser()
    actAs(user)
    const beforeVisit = Date.now()

    await expect(markOpportunitiesViewed()).resolves.toEqual({ ok: true, data: null })

    const { lastViewedAt } = await listOrFail('to_process')
    expect(lastViewedAt?.getTime()).toBeGreaterThanOrEqual(beforeVisit - 5_000)
  })
})

describe('listKnownOpportunityRegions', () => {
  it('lists the distinct regions of the last 30 days, sorted', async () => {
    const user = await createTestUser()
    actAs(user)
    const recentRegion = `Région ${buildUniqueKeyword()}`
    const expiredRegion = `Région ${buildUniqueKeyword()}`
    await seedOpportunityOrFail({ title: 'Développeur React', region: recentRegion, daysAgo: 2 })
    await seedOpportunityOrFail({ title: 'Développeur React', region: recentRegion, daysAgo: 5 })
    await seedOpportunityOrFail({ title: 'Développeur React', region: expiredRegion, daysAgo: 31 })

    const regionsResult = await listKnownOpportunityRegions()

    if (!regionsResult.ok) throw new Error(regionsResult.errorMessage)
    expect(regionsResult.data.filter((region) => region === recentRegion)).toEqual([recentRegion])
    expect(regionsResult.data).not.toContain(expiredRegion)
    expect(regionsResult.data).not.toContain('')
    expect(regionsResult.data).toEqual(
      [...regionsResult.data].sort((firstRegion, secondRegion) => firstRegion.localeCompare(secondRegion, 'fr')),
    )
  })
})
