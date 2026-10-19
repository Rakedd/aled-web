import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HighlightedOpportunities } from '@/domain/opportunities'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import {
  dismissOpportunity,
  listHighlightedOpportunities,
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

type SeededMission = { title: string; hoursAgo: number; rateMax: number | null }

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

const actAs = (user: TestUser): void => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const seedMissionOrFail = async ({ title, hoursAgo, rateMax }: SeededMission): Promise<string> => {
  const externalId = randomUUID()
  const row: TablesInsert<'opportunities'> = {
    source: 'free-work',
    external_id: externalId,
    url: `https://www.free-work.com/fr/tech-it/job-mission/${externalId}`,
    title,
    title_normalized: title.toLowerCase(),
    rate_max: rateMax,
    skills: [],
    published_at: new Date(Date.now() - hoursAgo * MILLISECONDS_PER_HOUR).toISOString(),
  }
  const { data, error } = await createServiceRoleTestClient().from('opportunities').insert(row).select('id').single()
  if (error) throw error
  return data.id
}

const listHighlightedOrFail = async (): Promise<HighlightedOpportunities> => {
  const highlightedResult = await listHighlightedOpportunities()
  if (!highlightedResult.ok) throw new Error(highlightedResult.errorMessage)
  return highlightedResult.data
}

const listHighlightedTitlesOrFail = async (): Promise<string[]> =>
  (await listHighlightedOrFail()).opportunities.map(({ title }) => title)

describe('listHighlightedOpportunities', () => {
  it('keeps the missions published within 48 hours and ranks them by rate, undisclosed rates last', async () => {
    const user = await createSignedInTestClient(`highlighted-${randomUUID()}@test.local`)
    actAs(user)
    const keyword = `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await seedMissionOrFail({ title: `Old ${keyword}`, hoursAgo: 72, rateMax: 700 })
    await seedMissionOrFail({ title: `Mid ${keyword}`, hoursAgo: 10, rateMax: 600 })
    await seedMissionOrFail({ title: `Unknown ${keyword}`, hoursAgo: 5, rateMax: null })
    await seedMissionOrFail({ title: `Top ${keyword}`, hoursAgo: 20, rateMax: 650 })
    await saveOpportunityFilters('free-work', { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: [keyword] })

    const highlighted = await listHighlightedOrFail()

    expect(highlighted.opportunities.map(({ title }) => title)).toEqual([`Top ${keyword}`, `Mid ${keyword}`])
    expect(highlighted.recentOpportunityCount).toBe(3)
  })

  it('breaks rate ties with the most recent publication and puts undisclosed rates after known ones', async () => {
    const user = await createSignedInTestClient(`highlighted-${randomUUID()}@test.local`)
    actAs(user)
    const keyword = `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await seedMissionOrFail({ title: `Unknown ${keyword}`, hoursAgo: 1, rateMax: null })
    await seedMissionOrFail({ title: `Older ${keyword}`, hoursAgo: 30, rateMax: 500 })
    await seedMissionOrFail({ title: `Newer ${keyword}`, hoursAgo: 3, rateMax: 500 })
    await saveOpportunityFilters('free-work', { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: [keyword] })

    expect(await listHighlightedTitlesOrFail()).toEqual([`Newer ${keyword}`, `Older ${keyword}`])
  })

  it('leaves out the missions already decided on', async () => {
    const user = await createSignedInTestClient(`highlighted-${randomUUID()}@test.local`)
    actAs(user)
    const keyword = `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`
    const dismissedId = await seedMissionOrFail({ title: `Dismissed ${keyword}`, hoursAgo: 2, rateMax: 900 })
    await seedMissionOrFail({ title: `Kept ${keyword}`, hoursAgo: 2, rateMax: 400 })
    await saveOpportunityFilters('free-work', { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: [keyword] })
    await dismissOpportunity(dismissedId)

    expect(await listHighlightedTitlesOrFail()).toEqual([`Kept ${keyword}`])
  })

  it('applies the exclude keywords of the user', async () => {
    const user = await createSignedInTestClient(`highlighted-${randomUUID()}@test.local`)
    actAs(user)
    const keyword = `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await seedMissionOrFail({ title: `Java ${keyword}`, hoursAgo: 2, rateMax: 900 })
    await seedMissionOrFail({ title: `React ${keyword}`, hoursAgo: 2, rateMax: 400 })
    await saveOpportunityFilters('free-work', {
      ...EMPTY_OPPORTUNITY_FILTERS,
      includeKeywords: [keyword],
      alwaysExcludeKeywords: ['java'],
    })

    expect(await listHighlightedTitlesOrFail()).toEqual([`React ${keyword}`])
  })

  it('returns at most two missions but counts every recent one', async () => {
    const user = await createSignedInTestClient(`highlighted-${randomUUID()}@test.local`)
    actAs(user)
    const keyword = `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await Promise.all([1, 2, 3].map((index) => seedMissionOrFail({ title: `M${index} ${keyword}`, hoursAgo: index, rateMax: 500 + index })))
    await saveOpportunityFilters('free-work', { ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: [keyword] })

    const highlighted = await listHighlightedOrFail()

    expect(highlighted.opportunities).toHaveLength(2)
    expect(highlighted.recentOpportunityCount).toBe(3)
  })
})
