/** @jest-environment node */
import {
  purgeOpportunitiesPublishedBefore,
  upsertOpportunities,
} from '@/server/repositories/opportunities-repository'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POST, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/create-service-role-supabase-client', () => ({
  createServiceRoleSupabaseClient: jest.fn(),
}))
jest.mock('@/server/repositories/opportunities-repository', () => ({
  upsertOpportunities: jest.fn(),
  purgeOpportunitiesPublishedBefore: jest.fn(),
}))

const INGEST_TOKEN = 'jeton-de-reception-de-test'
const INGEST_INSTANT = new Date('2026-10-18T10:00:00Z')
const fakeServiceRoleClient = { from: jest.fn() } as unknown as FreeclutchSupabaseClient

const buildWatcherMission = (externalId: string) => ({
  source: 'free-work',
  id: externalId,
  title: 'Développeur React senior',
  url: `https://www.free-work.com/fr/tech-it/job-mission/developpeur-react/${externalId}`,
  company: 'Agence X',
  description: 'Description confidentielle de la mission',
  rateMin: 450,
  rateMax: 550,
  rateLabel: '450-550 €/j',
  currency: 'EUR',
  remoteMode: '',
  locationLabel: 'Paris',
  region: 'Île-de-France',
  country: 'France',
  durationMonths: 6,
  publishedAt: '2026-10-17T09:00:00+02:00',
  skills: ['React'],
})

const requestIngest = (body: string, authorizationHeader: string | null = `Bearer ${INGEST_TOKEN}`) =>
  POST(
    new Request('http://localhost:3000/api/opportunities/ingest', {
      method: 'POST',
      headers: authorizationHeader === null ? {} : { authorization: authorizationHeader },
      body,
    }),
  )

const validBody = JSON.stringify({ missions: [buildWatcherMission('1'), buildWatcherMission('2'), { id: '3' }] })

describe('POST /api/opportunities/ingest', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: INGEST_INSTANT, doNotFake: ['nextTick', 'setImmediate'] })
    process.env.OPPORTUNITIES_INGEST_TOKEN = INGEST_TOKEN
    jest.mocked(createServiceRoleSupabaseClient).mockReturnValue(fakeServiceRoleClient)
    jest.mocked(upsertOpportunities).mockResolvedValue(2)
    jest.mocked(purgeOpportunitiesPublishedBefore).mockResolvedValue(4)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    jest.clearAllMocks()
    delete process.env.OPPORTUNITIES_INGEST_TOKEN
  })

  it('lets the ingest run for up to one minute', () => {
    expect(maxDuration).toBe(60)
  })

  it.each([
    ['without an authorization header', null],
    ['with a wrong token', 'Bearer mauvais-jeton'],
    ['with the token but no bearer scheme', INGEST_TOKEN],
  ])('answers 401 and writes nothing %s', async (_caseName, authorizationHeader) => {
    const ingestResponse = await requestIngest(validBody, authorizationHeader)

    expect(ingestResponse.status).toBe(401)
    expect(await ingestResponse.json()).toEqual({ error: 'Unauthorized' })
    expect(createServiceRoleSupabaseClient).not.toHaveBeenCalled()
    expect(upsertOpportunities).not.toHaveBeenCalled()
    expect(purgeOpportunitiesPublishedBefore).not.toHaveBeenCalled()
  })

  it('answers 401 and reports the misconfiguration when no ingest token is configured', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    delete process.env.OPPORTUNITIES_INGEST_TOKEN

    const ingestResponse = await requestIngest(validBody, 'Bearer undefined')

    expect(ingestResponse.status).toBe(401)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Opportunities ingest rejected because OPPORTUNITIES_INGEST_TOKEN is not configured',
    )
    expect(upsertOpportunities).not.toHaveBeenCalled()
  })

  it('answers 400 when the body is not valid json', async () => {
    const ingestResponse = await requestIngest('{ pas du json')

    expect(ingestResponse.status).toBe(400)
    expect(await ingestResponse.json()).toEqual({ error: expect.any(String) })
    expect(upsertOpportunities).not.toHaveBeenCalled()
    expect(purgeOpportunitiesPublishedBefore).not.toHaveBeenCalled()
  })

  it('answers 400 when the batch holds more than one hundred missions', async () => {
    const tooManyMissions = Array.from({ length: 101 }, (_unused, missionIndex) => buildWatcherMission(String(missionIndex)))

    const ingestResponse = await requestIngest(JSON.stringify({ missions: tooManyMissions }))

    expect(ingestResponse.status).toBe(400)
    expect(await ingestResponse.json()).toEqual({ error: expect.any(String) })
    expect(upsertOpportunities).not.toHaveBeenCalled()
  })

  it('upserts the valid missions with the service role client and answers the counters', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ingestResponse = await requestIngest(validBody)

    expect(ingestResponse.status).toBe(200)
    expect(await ingestResponse.json()).toEqual({ received: 3, upserted: 2, skippedInvalid: 1, purged: 4 })
    expect(upsertOpportunities).toHaveBeenCalledTimes(1)
    const [serviceClient, upsertedMissions] = jest.mocked(upsertOpportunities).mock.calls[0]
    expect(serviceClient).toBe(fakeServiceRoleClient)
    expect(upsertedMissions.map((mission) => [mission.source, mission.id, mission.remoteMode])).toEqual([
      ['free-work', '1', null],
      ['free-work', '2', null],
    ])
  })

  it('purges the opportunities published more than thirty days ago', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    await requestIngest(validBody)

    expect(purgeOpportunitiesPublishedBefore).toHaveBeenCalledWith(
      fakeServiceRoleClient,
      new Date('2026-09-18T10:00:00Z'),
    )
  })

  it('warns with the number of invalid missions when some are skipped', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const ingestResponse = await requestIngest(validBody)

    expect(ingestResponse.status).toBe(200)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith('Opportunities ingest skipped invalid missions', { skippedInvalid: 1 })
  })

  it('does not warn when every mission is valid', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await requestIngest(JSON.stringify({ missions: [buildWatcherMission('1')] }))

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('answers 422 and writes nothing when every mission of a non-empty batch is invalid', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const ingestResponse = await requestIngest(JSON.stringify({ missions: [{ id: 'sans-titre' }, { id: 'sans-url' }] }))

    expect(ingestResponse.status).toBe(422)
    expect(await ingestResponse.json()).toEqual({ error: expect.any(String), received: 2, skippedInvalid: 2 })
    expect(consoleWarnSpy).toHaveBeenCalledWith('Opportunities ingest skipped invalid missions', { skippedInvalid: 2 })
    expect(createServiceRoleSupabaseClient).not.toHaveBeenCalled()
    expect(upsertOpportunities).not.toHaveBeenCalled()
    expect(purgeOpportunitiesPublishedBefore).not.toHaveBeenCalled()
  })

  it('still purges when the batch is empty', async () => {
    jest.mocked(upsertOpportunities).mockResolvedValue(0)

    const ingestResponse = await requestIngest(JSON.stringify({ missions: [] }))

    expect(ingestResponse.status).toBe(200)
    expect(await ingestResponse.json()).toEqual({ received: 0, upserted: 0, skippedInvalid: 0, purged: 4 })
    expect(purgeOpportunitiesPublishedBefore).toHaveBeenCalledTimes(1)
  })

  it('still answers 200 with purged 0 and logs the error when the purge fails after the upsert', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest
      .mocked(purgeOpportunitiesPublishedBefore)
      .mockRejectedValue(new Error('Repository operation purgeOpportunitiesPublishedBefore failed with code 57014'))

    const ingestResponse = await requestIngest(validBody)

    expect(ingestResponse.status).toBe(200)
    expect(await ingestResponse.json()).toEqual({ received: 3, upserted: 2, skippedInvalid: 1, purged: 0 })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Opportunities purge failed', {
      errorMessage: 'Repository operation purgeOpportunitiesPublishedBefore failed with code 57014',
    })
  })

  it('answers 500 and logs only the error message when the write fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.mocked(upsertOpportunities).mockRejectedValue(new Error('Repository operation upsertOpportunities failed with code 23505'))

    const ingestResponse = await requestIngest(validBody)

    expect(ingestResponse.status).toBe(500)
    expect(await ingestResponse.json()).toEqual({ error: 'Ingest failed' })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Opportunities ingest failed', {
      errorMessage: 'Repository operation upsertOpportunities failed with code 23505',
    })
    const loggedText = JSON.stringify(consoleErrorSpy.mock.calls)
    expect(loggedText).not.toContain(INGEST_TOKEN)
    expect(loggedText).not.toContain('Description confidentielle')
  })
})
