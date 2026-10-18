import { randomUUID } from 'node:crypto'
import { POST } from '@/app/api/opportunities/ingest/route'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))

const INGEST_TOKEN = `jeton-${randomUUID()}`
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const daysAgo = (dayCount: number): string => new Date(Date.now() - dayCount * MILLISECONDS_PER_DAY).toISOString()

const buildWatcherMission = (externalId: string, override: Record<string, unknown> = {}) => ({
  id: externalId,
  title: 'Développeur·se React Senior',
  url: `https://www.free-work.com/fr/tech-it/job-mission/developpeur-react/${externalId}`,
  company: 'Agence X',
  description: 'Mission React / Next.js',
  rateMin: 450,
  rateMax: 550,
  rateLabel: '450-550 €/j',
  currency: 'EUR',
  remoteMode: 'partial',
  locationLabel: 'Paris',
  region: 'Île-de-France',
  country: 'France',
  durationMonths: 6,
  publishedAt: daysAgo(1),
  skills: ['React', 'TypeScript'],
  ...override,
})

const ingestMissions = async (missions: unknown[]) => {
  const ingestResponse = await POST(
    new Request('http://localhost:3000/api/opportunities/ingest', {
      method: 'POST',
      headers: { authorization: `Bearer ${INGEST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ missions }),
    }),
  )
  return { status: ingestResponse.status, counters: await ingestResponse.json() }
}

const readOpportunityRows = async (externalIds: string[]) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('opportunities')
    .select('id, external_id, source, title, title_normalized, rate_max, remote_mode, skills, received_at, published_at')
    .eq('source', 'free-work')
    .in('external_id', externalIds)
    .order('external_id')
  if (error) throw error
  return data
}

describe('POST /api/opportunities/ingest against local supabase', () => {
  beforeEach(() => {
    process.env.OPPORTUNITIES_INGEST_TOKEN = INGEST_TOKEN
  })

  afterEach(() => {
    delete process.env.OPPORTUNITIES_INGEST_TOKEN
  })

  it('stores a single row per mission when the same batch is sent twice', async () => {
    const externalIds = [randomUUID(), randomUUID()].sort()
    const batch = externalIds.map((externalId) => buildWatcherMission(externalId))

    const firstIngest = await ingestMissions(batch)
    const secondIngest = await ingestMissions(batch)

    expect(firstIngest).toEqual({
      status: 200,
      counters: { received: 2, upserted: 2, skippedInvalid: 0, purged: expect.any(Number) },
    })
    expect(secondIngest.counters).toMatchObject({ received: 2, upserted: 2, skippedInvalid: 0 })
    const storedRows = await readOpportunityRows(externalIds)
    expect(storedRows.map((storedRow) => storedRow.external_id)).toEqual(externalIds)
    expect(storedRows[0]).toMatchObject({
      source: 'free-work',
      title: 'Développeur·se React Senior',
      title_normalized: 'developpeur·se react senior',
      remote_mode: 'partial',
      skills: ['React', 'TypeScript'],
    })
  })

  it('stores a mission sent twice in the same batch once, with its last version', async () => {
    const externalId = randomUUID()

    const ingest = await ingestMissions([
      buildWatcherMission(externalId, { rateMax: 500 }),
      buildWatcherMission(externalId, { rateMax: 600 }),
    ])

    expect(ingest).toEqual({
      status: 200,
      counters: { received: 2, upserted: 1, skippedInvalid: 0, purged: expect.any(Number) },
    })
    expect((await readOpportunityRows([externalId])).map((storedRow) => storedRow.rate_max)).toEqual([600])
  })

  it('updates the rate of a resent mission without touching received_at nor the existing decision', async () => {
    const externalId = randomUUID()
    const user = await createSignedInTestClient(`ingest-${randomUUID()}@test.local`)
    await ingestMissions([buildWatcherMission(externalId, { rateMax: 550 })])
    const [rowBeforeResend] = await readOpportunityRows([externalId])
    const { error: decisionError } = await user.client
      .from('opportunity_decisions')
      .insert({ user_id: user.userId, opportunity_id: rowBeforeResend.id, decision: 'dismissed' })
    expect(decisionError).toBeNull()

    const resend = await ingestMissions([buildWatcherMission(externalId, { rateMax: 700, remoteMode: '' })])

    expect(resend.counters).toMatchObject({ received: 1, upserted: 1, skippedInvalid: 0 })
    const [rowAfterResend] = await readOpportunityRows([externalId])
    expect(rowAfterResend).toMatchObject({
      id: rowBeforeResend.id,
      rate_max: 700,
      remote_mode: null,
      received_at: rowBeforeResend.received_at,
    })
    const { data: decisionsAfterResend } = await user.client
      .from('opportunity_decisions')
      .select('decision')
      .eq('opportunity_id', rowBeforeResend.id)
    expect(decisionsAfterResend).toEqual([{ decision: 'dismissed' }])
  })

  it('counts the invalid missions and stores the valid ones', async () => {
    const validExternalId = randomUUID()
    const blankTitleExternalId = randomUUID()

    const ingest = await ingestMissions([
      buildWatcherMission(validExternalId),
      buildWatcherMission(blankTitleExternalId, { title: '  ' }),
      buildWatcherMission(randomUUID(), { url: 'javascript:alert(1)' }),
    ])

    expect(ingest.counters).toMatchObject({ received: 3, upserted: 1, skippedInvalid: 2 })
    expect((await readOpportunityRows([validExternalId, blankTitleExternalId])).map((storedRow) => storedRow.external_id)).toEqual([
      validExternalId,
    ])
  })

  it('answers 422 and stores nothing when every mission of the batch is invalid', async () => {
    const blankTitleExternalId = randomUUID()

    const ingest = await ingestMissions([buildWatcherMission(blankTitleExternalId, { title: '  ' })])

    expect(ingest).toEqual({
      status: 422,
      counters: { error: expect.any(String), received: 1, skippedInvalid: 1 },
    })
    expect(await readOpportunityRows([blankTitleExternalId])).toEqual([])
  })

  it('stores a mission whose texts hold null characters or lone surrogates once cleaned', async () => {
    const malformedExternalId = randomUUID()

    const ingest = await ingestMissions([
      buildWatcherMission(malformedExternalId, {
        title: 'Développeur\u0000 React \uD800Senior',
        description: 'Mission\u0000 React',
        skills: ['React\u0000', '\uDC00Next.js'],
      }),
    ])

    expect(ingest).toMatchObject({ status: 200, counters: { received: 1, upserted: 1, skippedInvalid: 0 } })
    expect(await readOpportunityRows([malformedExternalId])).toEqual([
      expect.objectContaining({ title: 'Développeur React \uFFFDSenior', skills: ['React', '\uFFFDNext.js'] }),
    ])
  })

  it('purges the missions published more than thirty days ago with their decisions and keeps the recent ones', async () => {
    const serviceRoleClient = createServiceRoleTestClient()
    const user = await createSignedInTestClient(`ingest-purge-${randomUUID()}@test.local`)
    const staleExternalId = randomUUID()
    const recentExternalId = randomUUID()
    const { data: staleOpportunity, error: staleInsertionError } = await serviceRoleClient
      .from('opportunities')
      .insert({
        source: 'free-work',
        external_id: staleExternalId,
        url: `https://www.free-work.com/fr/tech-it/job-mission/developpeur-react/${staleExternalId}`,
        title: 'Mission ancienne',
        title_normalized: 'mission ancienne',
        published_at: daysAgo(31),
      })
      .select('id')
      .single()
    expect(staleInsertionError).toBeNull()
    const { error: decisionError } = await user.client
      .from('opportunity_decisions')
      .insert({ user_id: user.userId, opportunity_id: staleOpportunity!.id, decision: 'dismissed' })
    expect(decisionError).toBeNull()

    const ingest = await ingestMissions([buildWatcherMission(recentExternalId, { publishedAt: daysAgo(29) })])

    expect(ingest.status).toBe(200)
    expect(ingest.counters.purged).toBeGreaterThanOrEqual(1)
    expect((await readOpportunityRows([staleExternalId, recentExternalId])).map((storedRow) => storedRow.external_id)).toEqual([
      recentExternalId,
    ])
    const { data: remainingDecisions } = await serviceRoleClient
      .from('opportunity_decisions')
      .select('id')
      .eq('opportunity_id', staleOpportunity!.id)
    expect(remainingDecisions).toEqual([])
  })
})
