import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getOpportunityEffectiveRate,
  NO_OPPORTUNITY_QUICK_FILTERS,
  type OpportunityListing,
  type OpportunityListingCursor,
  type OpportunityQuickFilters,
  type OpportunityTab,
} from '@/domain/opportunities'
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
import type { Database, TablesInsert } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

type SeededOpportunity = {
  title: string
  daysAgo?: number
  region?: string | null
  publishedAt?: Date
  company?: string
  rateMin?: number | null
  rateMax?: number | null
  remoteMode?: string | null
  skills?: string[]
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const MILLISECONDS_PER_MINUTE = 60 * 1000

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`opportunity-actions-${randomUUID()}@test.local`)

const actAs = (user: TestUser): void => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const buildUniqueKeyword = (): string => `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`

const buildOpportunityRow = ({
  title,
  daysAgo = 0,
  region = null,
  publishedAt,
  company = 'Agence X',
  rateMin = null,
  rateMax = 550,
  remoteMode = 'partial',
  skills = ['React'],
}: SeededOpportunity): TablesInsert<'opportunities'> => {
  const externalId = randomUUID()
  return {
    source: 'free-work',
    external_id: externalId,
    url: `https://www.free-work.com/fr/tech-it/job-mission/${externalId}`,
    title,
    title_normalized: title.toLowerCase(),
    company,
    description: 'Mission longue',
    rate_min: rateMin,
    rate_max: rateMax,
    remote_mode: remoteMode,
    location_label: region,
    region,
    duration_months: 6,
    skills,
    published_at: (publishedAt ?? new Date(Date.now() - daysAgo * MILLISECONDS_PER_DAY - 60_000)).toISOString(),
  }
}

const seedOpportunityOrFail = async (seededOpportunity: SeededOpportunity): Promise<string> => {
  const { data, error } = await createServiceRoleTestClient()
    .from('opportunities')
    .insert(buildOpportunityRow(seededOpportunity))
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const seedOpportunitiesOrFail = async (seededOpportunities: SeededOpportunity[]): Promise<void> => {
  const { error } = await createServiceRoleTestClient()
    .from('opportunities')
    .insert(seededOpportunities.map(buildOpportunityRow))
  if (error) throw error
}

const filtersWith = (overrides: Partial<OpportunityFilters>): OpportunityFilters => ({
  ...EMPTY_OPPORTUNITY_FILTERS,
  ...overrides,
})

const saveFiltersOrFail = async (filters: OpportunityFilters): Promise<void> => {
  const saveResult = await saveOpportunityFilters(filters)
  if (!saveResult.ok) throw new Error(saveResult.errorMessage)
}

const listOrFail = async (
  tab: OpportunityTab,
  cursor: OpportunityListingCursor | null = null,
  search = '',
  quickFilters: OpportunityQuickFilters = NO_OPPORTUNITY_QUICK_FILTERS,
): Promise<OpportunityListing> => {
  const listingResult = await listOpportunities(tab, cursor, search, quickFilters)
  if (!listingResult.ok) throw new Error(listingResult.errorMessage)
  return listingResult.data
}

const toCursor = (items: OpportunityListing['items']): OpportunityListingCursor => {
  const lastItem = items[items.length - 1]
  return {
    publishedAt: lastItem.publishedAt.toISOString(),
    id: lastItem.id,
    rate: getOpportunityEffectiveRate(lastItem),
    matchPercent: lastItem.sortMatchPercent,
  }
}

const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * MILLISECONDS_PER_MINUTE)

const toIds = (items: OpportunityListing['items']): string[] => items.map((listItem) => listItem.id)

const listEveryItemOrFail = async (
  tab: OpportunityTab,
  cursor: OpportunityListingCursor | null = null,
  search = '',
): Promise<OpportunityListing['items']> => {
  const listing = await listOrFail(tab, cursor, search)
  return listing.hasMore
    ? [...listing.items, ...(await listEveryItemOrFail(tab, toCursor(listing.items), search))]
    : listing.items
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
      sortMatchPercent: null,
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
    await expect(listOrFail('to_process', toCursor(listing.items))).resolves.toMatchObject({ items: [], hasMore: false })
    await expect(countOpportunitiesToProcess()).resolves.toEqual({ ok: true, data: 2 })
  })

  it('continues strictly after the cursor without skipping items after dismissals or same-date ties', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const sharedPublication = new Date(Date.now() - MILLISECONDS_PER_DAY)
    await seedOpportunitiesOrFail(
      Array.from({ length: 60 }, (_, index) => ({
        title: `Mission ${keyword} ${index}`,
        publishedAt: index < 20 ? sharedPublication : new Date(sharedPublication.getTime() - index * 60_000),
      })),
    )
    await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))
    const firstPage = await listOrFail('to_process')
    for (const listItem of firstPage.items.slice(0, 40)) await dismissOpportunity(listItem.id)

    const nextPage = await listOrFail('to_process', toCursor(firstPage.items))

    expect(firstPage.items).toHaveLength(50)
    expect(firstPage.hasMore).toBe(true)
    expect(nextPage.items).toHaveLength(10)
    expect(nextPage.hasMore).toBe(false)
    expect(nextPage.counts).toEqual({ to_process: 20, applied: 0, dismissed: 40 })
    const everyListedId = [...firstPage.items, ...nextPage.items].map((listItem) => listItem.id)
    expect(new Set(everyListedId).size).toBe(60)
    const tiedIds = firstPage.items.slice(0, 20).map((listItem) => listItem.id)
    expect(tiedIds).toEqual([...tiedIds].sort().reverse())
    const dismissedItems = await listEveryItemOrFail('dismissed')
    expect(dismissedItems.map((listItem) => listItem.id)).toEqual(firstPage.items.slice(0, 40).map((listItem) => listItem.id))
  })

  describe('search', () => {
    it('finds a company ignoring case and accents', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const matchingId = await seedOpportunityOrFail({ title: `Mission ${keyword}`, company: `Société Générale ${keyword}` })
      await seedOpportunityOrFail({ title: `Mission ${keyword} autre`, company: `Agence ${keyword}` })

      const listing = await listOrFail('to_process', null, `SOCIETE generale ${keyword}`)

      expect(listing.items.map((listItem) => listItem.id)).toEqual([matchingId])
    })

    it('finds a location', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const matchingId = await seedOpportunityOrFail({ title: `Mission ${keyword}`, region: `Paris ${keyword}` })
      await seedOpportunityOrFail({ title: `Mission ${keyword} autre`, region: `Lyon ${keyword}` })

      const listing = await listOrFail('to_process', null, `paris ${keyword}`)

      expect(listing.items.map((listItem) => listItem.id)).toEqual([matchingId])
    })

    it('finds a title', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const matchingId = await seedOpportunityOrFail({ title: `Ingénieur Données ${keyword}` })
      await seedOpportunityOrFail({ title: `Développeur Java ${keyword}` })

      const listing = await listOrFail('to_process', null, `  INGENIEUR donnees ${keyword}  `)

      expect(listing.items.map((listItem) => listItem.id)).toEqual([matchingId])
    })

    it('treats an empty search as no search', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await seedOpportunitiesOrFail([{ title: `Mission ${keyword} A` }, { title: `Mission ${keyword} B` }])
      await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

      const listing = await listOrFail('to_process', null, '   ')

      expect(listing.items).toHaveLength(2)
    })

    it('filters the counters of the three tabs', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const alphaId = await seedOpportunityOrFail({ title: `Alpha ${keyword}` })
      const betaId = await seedOpportunityOrFail({ title: `Beta ${keyword}` })
      const gammaId = await seedOpportunityOrFail({ title: `Gamma ${keyword}` })
      await dismissOpportunity(alphaId)
      await dismissOpportunity(betaId)
      await applyToOpportunity(gammaId)

      const alphaListing = await listOrFail('dismissed', null, `alpha ${keyword}`)
      const keywordListing = await listOrFail('dismissed', null, keyword)

      expect(alphaListing.items.map((listItem) => listItem.id)).toEqual([alphaId])
      expect(alphaListing.counts).toEqual({ to_process: 0, applied: 0, dismissed: 1 })
      expect(keywordListing.counts).toEqual({ to_process: 0, applied: 1, dismissed: 2 })
    })

    it('applies together with the Free-Work filters', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const reactId = await seedOpportunityOrFail({ title: `Dev React ${keyword}` })
      await seedOpportunityOrFail({ title: `Dev Java ${keyword}` })
      const reactWithoutSearchMatchId = await seedOpportunityOrFail({ title: 'Dev React sans rapport' })
      await saveFiltersOrFail(filtersWith({ includeKeywords: ['react'] }))

      const listing = await listOrFail('to_process', null, keyword)

      expect(listing.items.map((listItem) => listItem.id)).toEqual([reactId])
      expect(listing.items.map((listItem) => listItem.id)).not.toContain(reactWithoutSearchMatchId)
      expect(listing.counts.to_process).toBe(1)
    })

    it('paginates by cursor within the search results', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const now = Date.now()
      await seedOpportunitiesOrFail([
        ...Array.from({ length: 60 }, (_, index) => ({
          title: `Mission ${keyword} ${index}`,
          publishedAt: new Date(now - (index + 1) * 60_000),
        })),
        { title: 'Sans rapport', publishedAt: new Date(now - 30_000) },
      ])

      const firstPage = await listOrFail('to_process', null, keyword)
      const nextPage = await listOrFail('to_process', toCursor(firstPage.items), keyword)

      expect(firstPage.items).toHaveLength(50)
      expect(firstPage.hasMore).toBe(true)
      expect(nextPage.items).toHaveLength(10)
      expect(nextPage.hasMore).toBe(false)
      expect(new Set([...firstPage.items, ...nextPage.items].map((listItem) => listItem.id)).size).toBe(60)
      expect(nextPage.counts.to_process).toBe(60)
    })

    it('does not change the count of opportunities to process', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await seedOpportunitiesOrFail([{ title: `Alpha ${keyword}` }, { title: `Beta ${keyword}` }])
      await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

      await listOrFail('to_process', null, 'alpha')

      await expect(countOpportunitiesToProcess()).resolves.toEqual({ ok: true, data: 2 })
    })

    it('rejects a search longer than 100 characters', async () => {
      const user = await createTestUser()
      actAs(user)

      await expect(listOpportunities('to_process', null, 'a'.repeat(101))).resolves.toEqual({
        ok: false,
        errorMessage: 'La recherche ne peut pas dépasser 100 caractères',
      })
    })
  })

  describe('quick filters', () => {
    const SORTED_BY_RATE: OpportunityQuickFilters = { sortOrder: 'rate', remoteModes: [] }
    const SORTED_BY_MATCH: OpportunityQuickFilters = { sortOrder: 'match', remoteModes: [] }

    const remoteModesOnly = (remoteModes: OpportunityQuickFilters['remoteModes']): OpportunityQuickFilters => ({
      sortOrder: 'publication',
      remoteModes,
    })

    it('sorts by effective rate, undisclosed rates last, then by publication date', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const missionAId = await seedOpportunityOrFail({ title: `A ${keyword}`, rateMax: 500, publishedAt: minutesAgo(60) })
      const missionBId = await seedOpportunityOrFail({ title: `B ${keyword}`, rateMax: null, publishedAt: minutesAgo(10) })
      const missionCId = await seedOpportunityOrFail({ title: `C ${keyword}`, rateMax: 700, publishedAt: minutesAgo(180) })
      const missionDId = await seedOpportunityOrFail({ title: `D ${keyword}`, rateMax: 700, publishedAt: minutesAgo(120) })
      const missionEId = await seedOpportunityOrFail({
        title: `E ${keyword}`,
        rateMin: 650,
        rateMax: null,
        publishedAt: minutesAgo(240),
      })

      const listing = await listOrFail('to_process', null, keyword, SORTED_BY_RATE)

      expect(toIds(listing.items)).toEqual([missionDId, missionCId, missionEId, missionAId, missionBId])
    })

    it('keeps only the selected remote modes, and every mode when none is selected', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const fullRemoteId = await seedOpportunityOrFail({ title: `Full ${keyword}`, remoteMode: 'full', publishedAt: minutesAgo(10) })
      const hybridId = await seedOpportunityOrFail({ title: `Hybride ${keyword}`, remoteMode: 'partial', publishedAt: minutesAgo(20) })
      const onsiteId = await seedOpportunityOrFail({ title: `Site ${keyword}`, remoteMode: 'none', publishedAt: minutesAgo(30) })
      const unknownModeId = await seedOpportunityOrFail({ title: `Inconnu ${keyword}`, remoteMode: null, publishedAt: minutesAgo(40) })

      const fullOrOnsiteListing = await listOrFail('to_process', null, keyword, remoteModesOnly(['full', 'none']))
      const everyModeListing = await listOrFail('to_process', null, keyword, remoteModesOnly([]))

      expect(toIds(fullOrOnsiteListing.items)).toEqual([fullRemoteId, onsiteId])
      expect(toIds(everyModeListing.items)).toEqual([fullRemoteId, hybridId, onsiteId, unknownModeId])
    })

    it('narrows the counters of the three tabs to the selected remote modes', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await seedOpportunitiesOrFail([
        { title: `Full ${keyword}`, remoteMode: 'full' },
        { title: `Hybride ${keyword}`, remoteMode: 'partial' },
        { title: `Inconnu ${keyword}`, remoteMode: null },
      ])
      const dismissedOnsiteId = await seedOpportunityOrFail({ title: `Site ${keyword}`, remoteMode: 'none' })
      await dismissOpportunity(dismissedOnsiteId)

      const fullRemoteListing = await listOrFail('to_process', null, keyword, remoteModesOnly(['full']))
      const unfilteredListing = await listOrFail('to_process', null, keyword)

      expect(fullRemoteListing.counts).toEqual({ to_process: 1, applied: 0, dismissed: 0 })
      expect(unfilteredListing.counts).toEqual({ to_process: 3, applied: 0, dismissed: 1 })
    })

    it('applies together with the Free-Work filters', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const reactFullRemoteId = await seedOpportunityOrFail({ title: `Dev React ${keyword}`, remoteMode: 'full' })
      await seedOpportunityOrFail({ title: `Dev Java ${keyword}`, remoteMode: 'full' })
      await seedOpportunityOrFail({ title: `Lead React ${keyword}`, remoteMode: 'partial' })
      await saveFiltersOrFail(filtersWith({ includeKeywords: ['react'] }))

      const listing = await listOrFail('to_process', null, keyword, remoteModesOnly(['full']))

      expect(toIds(listing.items)).toEqual([reactFullRemoteId])
      expect(listing.counts.to_process).toBe(1)
    })

    it('paginates by a cursor carrying the rate of the last item in the global rate order', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const missionIndexes = Array.from({ length: 60 }, (_, index) => index)
      const isUndisclosedRateIndex = (index: number): boolean => index % 3 === 0
      await seedOpportunitiesOrFail(
        missionIndexes.map((index) => ({
          title: `Mission ${keyword} ${index}`,
          rateMax: isUndisclosedRateIndex(index) ? null : 400 + index,
          publishedAt: minutesAgo(index + 1),
        })),
      )
      const expectedTitles = [
        ...missionIndexes.filter((index) => !isUndisclosedRateIndex(index)).reverse(),
        ...missionIndexes.filter(isUndisclosedRateIndex),
      ].map((index) => `Mission ${keyword} ${index}`)

      const firstPage = await listOrFail('to_process', null, keyword, SORTED_BY_RATE)
      const cursor = toCursor(firstPage.items)
      const nextPage = await listOrFail('to_process', cursor, keyword, SORTED_BY_RATE)

      expect(firstPage.items).toHaveLength(50)
      expect(firstPage.hasMore).toBe(true)
      expect(cursor).toEqual({
        publishedAt: firstPage.items[49].publishedAt.toISOString(),
        id: firstPage.items[49].id,
        rate: null,
        matchPercent: null,
      })
      expect(nextPage.items).toHaveLength(10)
      expect(nextPage.hasMore).toBe(false)
      const everyListedItem = [...firstPage.items, ...nextPage.items]
      expect(new Set(toIds(everyListedItem)).size).toBe(60)
      expect(everyListedItem.map((listItem) => listItem.title)).toEqual(expectedTitles)
    })

    it('sorts by match percent, unknown matches last, then by publication date, and keeps the rate sort apart', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await saveFiltersOrFail(filtersWith({ mySkills: ['React', 'TypeScript'] }))
      const halfMatchId = await seedOpportunityOrFail({
        title: `Moitié ${keyword}`,
        skills: ['React.js', 'Java'],
        rateMax: 900,
        publishedAt: minutesAgo(10),
      })
      const fullMatchOldId = await seedOpportunityOrFail({
        title: `Complet ancien ${keyword}`,
        skills: ['reactjs', 'TS'],
        rateMax: 400,
        publishedAt: minutesAgo(120),
      })
      const fullMatchRecentId = await seedOpportunityOrFail({
        title: `Complet récent ${keyword}`,
        skills: ['TypeScript'],
        rateMax: 300,
        publishedAt: minutesAgo(60),
      })
      const noSkillId = await seedOpportunityOrFail({ title: `Sans compétence ${keyword}`, skills: [], publishedAt: minutesAgo(5) })
      const noMatchId = await seedOpportunityOrFail({ title: `Aucune ${keyword}`, skills: ['Java'], publishedAt: minutesAgo(200) })

      const matchListing = await listOrFail('to_process', null, keyword, SORTED_BY_MATCH)
      const rateListing = await listOrFail('to_process', null, keyword, SORTED_BY_RATE)

      expect(toIds(matchListing.items)).toEqual([fullMatchRecentId, fullMatchOldId, halfMatchId, noMatchId, noSkillId])
      expect(matchListing.items.map((listItem) => listItem.sortMatchPercent)).toEqual([100, 100, 50, 0, null])
      expect(toIds(rateListing.items)).toEqual([halfMatchId, noSkillId, noMatchId, fullMatchOldId, fullMatchRecentId])
    })

    it('carries no match percent when I have no skill, whatever the sort', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const olderId = await seedOpportunityOrFail({ title: `Ancienne ${keyword}`, skills: ['React'], publishedAt: minutesAgo(60) })
      const newerId = await seedOpportunityOrFail({ title: `Récente ${keyword}`, skills: ['Java'], publishedAt: minutesAgo(10) })

      const matchListing = await listOrFail('to_process', null, keyword, SORTED_BY_MATCH)

      expect(toIds(matchListing.items)).toEqual([newerId, olderId])
      expect(matchListing.items.map((listItem) => listItem.sortMatchPercent)).toEqual([null, null])
    })

    it('paginates by a cursor carrying the match percent of the last item in the global match order', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await saveFiltersOrFail(filtersWith({ mySkills: ['React'] }))
      const missionIndexes = Array.from({ length: 60 }, (_, index) => index)
      const skillsByRemainder: string[][] = [['React'], ['React', 'Java'], ['Java'], []]
      await seedOpportunitiesOrFail(
        missionIndexes.map((index) => ({
          title: `Mission ${keyword} ${index}`,
          skills: skillsByRemainder[index % 4],
          publishedAt: minutesAgo(index + 1),
        })),
      )
      const expectedTitles = [0, 1, 2, 3]
        .flatMap((remainder) => missionIndexes.filter((index) => index % 4 === remainder))
        .map((index) => `Mission ${keyword} ${index}`)

      const firstPage = await listOrFail('to_process', null, keyword, SORTED_BY_MATCH)
      const nextPage = await listOrFail('to_process', toCursor(firstPage.items), keyword, SORTED_BY_MATCH)

      expect(firstPage.items).toHaveLength(50)
      expect(firstPage.hasMore).toBe(true)
      expect(toCursor(firstPage.items).matchPercent).toBeNull()
      expect(nextPage.items).toHaveLength(10)
      expect(nextPage.hasMore).toBe(false)
      expect([...firstPage.items, ...nextPage.items].map((listItem) => listItem.title)).toEqual(expectedTitles)
    })

    it('keeps the publication order and no match percent in the applied tab when sorting by match', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await saveFiltersOrFail(filtersWith({ mySkills: ['React'] }))
      const noMatchRecentId = await seedOpportunityOrFail({ title: `Java ${keyword}`, skills: ['Java'], publishedAt: minutesAgo(10) })
      const fullMatchOldId = await seedOpportunityOrFail({ title: `React ${keyword}`, skills: ['React'], publishedAt: minutesAgo(60) })
      await applyToOpportunity(noMatchRecentId)
      await applyToOpportunity(fullMatchOldId)

      const appliedListing = await listOrFail('applied', null, keyword, SORTED_BY_MATCH)

      expect(toIds(appliedListing.items)).toEqual([noMatchRecentId, fullMatchOldId])
      expect(appliedListing.items.map((listItem) => listItem.sortMatchPercent)).toEqual([null, null])
    })

    it('sorts the applied tab by rate', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      const rate500Id = await seedOpportunityOrFail({ title: `TJM 500 ${keyword}`, rateMax: 500, publishedAt: minutesAgo(60) })
      const rate700Id = await seedOpportunityOrFail({ title: `TJM 700 ${keyword}`, rateMax: 700, publishedAt: minutesAgo(120) })
      await applyToOpportunity(rate500Id)
      await applyToOpportunity(rate700Id)

      const appliedListing = await listOrFail('applied', null, keyword, SORTED_BY_RATE)

      expect(toIds(appliedListing.items)).toEqual([rate700Id, rate500Id])
    })

    it('does not change the count of opportunities to process', async () => {
      const user = await createTestUser()
      actAs(user)
      const keyword = buildUniqueKeyword()
      await seedOpportunitiesOrFail([
        { title: `Full ${keyword}`, remoteMode: 'full' },
        { title: `Hybride ${keyword}`, remoteMode: 'partial' },
        { title: `Site ${keyword}`, remoteMode: 'none' },
      ])
      await saveFiltersOrFail(filtersWith({ includeKeywords: [keyword] }))

      const fullRemoteListing = await listOrFail('to_process', null, '', remoteModesOnly(['full']))

      expect(fullRemoteListing.counts.to_process).toBe(1)
      await expect(countOpportunitiesToProcess()).resolves.toEqual({ ok: true, data: 3 })
    })

    it('rejects malformed quick filters', async () => {
      const user = await createTestUser()
      actAs(user)

      await expect(
        listOpportunities('to_process', null, '', { sortOrder: 'yes', remoteModes: [] } as unknown as OpportunityQuickFilters),
      ).resolves.toEqual({ ok: false, errorMessage: 'Filtres rapides invalides' })
    })
  })

  it('rejects an unknown tab or a malformed cursor', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(listOpportunities('archived' as OpportunityTab, null, '')).resolves.toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
    await expect(
      listOpportunities('to_process', { publishedAt: 'hier', id: randomUUID(), rate: null, matchPercent: null }, ''),
    ).resolves.toEqual({
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

describe('decision integrity', () => {
  it('refuses to restore an opportunity that was applied to and keeps the application', async () => {
    const user = await createTestUser()
    actAs(user)
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${buildUniqueKeyword()}` })
    const application = await applyToOpportunity(opportunityId)
    if (!application.ok) throw new Error(application.errorMessage)

    await expect(restoreOpportunity(opportunityId)).resolves.toEqual({
      ok: false,
      errorMessage: "Cette mission n'est pas ignorée",
    })

    expect((await listOrFail('applied')).items).toEqual([
      expect.objectContaining({ id: opportunityId, decision: 'applied', jobApplicationId: application.data.jobApplicationId }),
    ])
  })

  it('refuses to restore an opportunity without decision', async () => {
    const user = await createTestUser()
    actAs(user)
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${buildUniqueKeyword()}` })

    await expect(restoreOpportunity(opportunityId)).resolves.toEqual({
      ok: false,
      errorMessage: "Cette mission n'est pas ignorée",
    })
  })

  it('refuses to dismiss an opportunity that was applied to and keeps the application', async () => {
    const user = await createTestUser()
    actAs(user)
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${buildUniqueKeyword()}` })
    const application = await applyToOpportunity(opportunityId)
    if (!application.ok) throw new Error(application.errorMessage)

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Tu as déjà postulé à cette mission',
    })

    const appliedListing = await listOrFail('applied')
    expect(appliedListing.items).toEqual([
      expect.objectContaining({ id: opportunityId, decision: 'applied', jobApplicationId: application.data.jobApplicationId }),
    ])
    expect(appliedListing.counts).toMatchObject({ applied: 1, dismissed: 0 })
  })

  it('accepts dismissing the same opportunity twice', async () => {
    const user = await createTestUser()
    actAs(user)
    const opportunityId = await seedOpportunityOrFail({ title: `Développeur React ${buildUniqueKeyword()}` })

    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })
    await expect(dismissOpportunity(opportunityId)).resolves.toEqual({ ok: true, data: null })

    expect(await listIdsOrFail('dismissed')).toEqual([opportunityId])
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
    await expect(getOpportunityFilters()).resolves.toEqual({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })
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
    await expect(getOpportunityFilters()).resolves.toEqual({
      ok: true,
      data: filtersWith({ includeKeywords: [keyword], rateFloorHybrid: 600 }),
    })
  })
})

describe('opportunity filters', () => {
  it('returns empty filters before the first save and the saved filters afterwards', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(getOpportunityFilters()).resolves.toEqual({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS })

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
    await expect(saveOpportunityFilters(unnormalizedFilters)).resolves.toEqual({ ok: true, data: savedFilters })
    await expect(saveOpportunityFilters(savedFilters)).resolves.toEqual({ ok: true, data: savedFilters })
    await expect(getOpportunityFilters()).resolves.toEqual({ ok: true, data: savedFilters })
  })

  it('reads and writes my skills without letting them filter the missions', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const javaId = await seedOpportunityOrFail({ title: `Dev Java ${keyword}`, skills: ['Java'] })

    await expect(saveOpportunityFilters(filtersWith({ mySkills: [' React ', 'react', 'Node.js'] }))).resolves.toEqual({
      ok: true,
      data: filtersWith({ mySkills: ['React', 'Node.js'] }),
    })

    await expect(getOpportunityFilters()).resolves.toEqual({ ok: true, data: filtersWith({ mySkills: ['React', 'Node.js'] }) })
    expect(toIds((await listOrFail('to_process', null, keyword)).items)).toEqual([javaId])
  })

  it('keeps my skills when the mobile app upserts the filters without them', async () => {
    const user = await createTestUser()
    actAs(user)
    await saveFiltersOrFail(filtersWith({ mySkills: ['React', 'TypeScript'], includeKeywords: ['react'] }))

    const { error } = await user.client.from('opportunity_filters').upsert(
      {
        user_id: user.userId,
        include_keywords: ['java'],
        always_exclude_keywords: [],
        rescuable_exclude_keywords: [],
        rescue_keywords: [],
        rate_floor_full_remote: null,
        rate_floor_hybrid: null,
        rate_floor_onsite: null,
        regions: [],
        disabled_sources: [],
      },
      { onConflict: 'user_id' },
    )

    expect(error).toBeNull()
    await expect(getOpportunityFilters()).resolves.toEqual({
      ok: true,
      data: filtersWith({ mySkills: ['React', 'TypeScript'], includeKeywords: ['java'] }),
    })
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
