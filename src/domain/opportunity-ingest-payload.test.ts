import { MAXIMUM_STACK_ITEM_COUNT, MAXIMUM_STACK_ITEM_NAME_LENGTH } from './job-application'
import { type IngestMission, MAX_MISSIONS_PER_INGEST, parseIngestPayload } from './opportunity-ingest-payload'

const buildWatcherMission = (override: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: '123456',
  title: ' Développeur React senior ',
  url: 'https://www.free-work.com/fr/tech-it/job-mission/developpeur-react/dev-react-senior',
  company: 'Agence X',
  description: 'Mission React / Next.js pour un grand compte.',
  rateMin: 450,
  rateMax: 550,
  rateLabel: '450-550 €/j',
  currency: 'EUR',
  remoteMode: 'partial',
  locationLabel: 'Paris, Île-de-France',
  region: 'Île-de-France',
  country: 'France',
  durationMonths: 6,
  publishedAt: '2026-10-17T09:29:43+02:00',
  skills: ['React', 'TypeScript'],
  ...override,
})

const expectedIngestMission: IngestMission = {
  source: 'free-work',
  id: '123456',
  title: 'Développeur React senior',
  url: 'https://www.free-work.com/fr/tech-it/job-mission/developpeur-react/dev-react-senior',
  company: 'Agence X',
  description: 'Mission React / Next.js pour un grand compte.',
  rateMin: 450,
  rateMax: 550,
  rateLabel: '450-550 €/j',
  currency: 'EUR',
  remoteMode: 'partial',
  locationLabel: 'Paris, Île-de-France',
  region: 'Île-de-France',
  country: 'France',
  durationMonths: 6,
  publishedAt: new Date('2026-10-17T07:29:43Z'),
  skills: ['React', 'TypeScript'],
}

const parseSingleMission = (override: Record<string, unknown>) => parseIngestPayload({ missions: [buildWatcherMission(override)] })

describe('parseIngestPayload', () => {
  it('accepts at most one hundred missions per request', () => {
    expect(MAX_MISSIONS_PER_INGEST).toBe(100)
  })

  it('turns a watcher mission into an ingest mission from the free-work source', () => {
    expect(parseIngestPayload({ missions: [buildWatcherMission()] })).toEqual({
      missions: [expectedIngestMission],
      skippedInvalid: 0,
    })
  })

  it('accepts an empty batch', () => {
    expect(parseIngestPayload({ missions: [] })).toEqual({ missions: [], skippedInvalid: 0 })
  })

  it('accepts exactly one hundred missions', () => {
    const hundredMissions = Array.from({ length: 100 }, (_unused, missionIndex) => buildWatcherMission({ id: String(missionIndex) }))

    const parsedPayload = parseIngestPayload({ missions: hundredMissions })

    expect(parsedPayload).toEqual({ missions: expect.any(Array), skippedInvalid: 0 })
  })

  it('rejects the whole batch when it holds more than one hundred missions', () => {
    const tooManyMissions = Array.from({ length: 101 }, (_unused, missionIndex) => buildWatcherMission({ id: String(missionIndex) }))

    expect(parseIngestPayload({ missions: tooManyMissions })).toEqual({ error: expect.any(String) })
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['an object without missions', { items: [] }],
    ['missions that are not an array', { missions: 'nope' }],
  ])('rejects a body that is %s', (_caseName, body) => {
    expect(parseIngestPayload(body)).toEqual({ error: expect.any(String) })
  })

  it('counts a mission without id nor url as invalid and keeps the others', () => {
    const missionWithoutIdNorUrl = buildWatcherMission({ id: undefined, url: undefined })

    expect(parseIngestPayload({ missions: [missionWithoutIdNorUrl, buildWatcherMission(), 'not a mission'] })).toEqual({
      missions: [expectedIngestMission],
      skippedInvalid: 2,
    })
  })

  it.each([
    ['a missing id', { id: undefined }],
    ['a blank id', { id: '   ' }],
    ['a numeric id', { id: 123456 }],
    ['a blank title', { title: '   ' }],
    ['a missing title', { title: undefined }],
    ['a missing url', { url: undefined }],
    ['a javascript url', { url: 'javascript:alert(1)' }],
    ['an ftp url', { url: 'ftp://www.free-work.com/mission' }],
    ['a relative url', { url: '/fr/tech-it/job-mission/dev' }],
    ['a url longer than 2048 characters', { url: `https://www.free-work.com/${'a'.repeat(2030)}` }],
    ['an invalid publishedAt', { publishedAt: 'pas une date' }],
    ['a date-only publishedAt', { publishedAt: '2026-10-17' }],
    ['a missing publishedAt', { publishedAt: undefined }],
    ['a rate that is not a number', { rateMax: '550' }],
    ['skills that are not strings', { skills: [{ name: 'React' }] }],
  ])('counts a mission with %s as invalid', (_caseName, override) => {
    expect(parseSingleMission(override)).toEqual({ missions: [], skippedInvalid: 1 })
  })

  it('accepts a url of exactly 2048 characters', () => {
    const longestAllowedUrl = `https://www.free-work.com/${'a'.repeat(2048 - 'https://www.free-work.com/'.length)}`

    expect(parseSingleMission({ url: longestAllowedUrl })).toEqual({
      missions: [{ ...expectedIngestMission, url: longestAllowedUrl }],
      skippedInvalid: 0,
    })
  })

  it('accepts an http url', () => {
    expect(parseSingleMission({ url: 'http://www.free-work.com/mission' })).toEqual({
      missions: [{ ...expectedIngestMission, url: 'http://www.free-work.com/mission' }],
      skippedInvalid: 0,
    })
  })

  it('turns an empty remote mode into null', () => {
    expect(parseSingleMission({ remoteMode: '' })).toEqual({
      missions: [{ ...expectedIngestMission, remoteMode: null }],
      skippedInvalid: 0,
    })
  })

  it('turns an unknown remote mode into null instead of dropping the mission', () => {
    expect(parseSingleMission({ remoteMode: 'hybrid' })).toEqual({
      missions: [{ ...expectedIngestMission, remoteMode: null }],
      skippedInvalid: 0,
    })
  })

  it('turns blank or missing optional texts into null', () => {
    expect(
      parseSingleMission({
        company: '  ',
        description: '',
        rateLabel: '',
        currency: undefined,
        locationLabel: null,
        region: '',
        country: '',
      }),
    ).toEqual({
      missions: [
        {
          ...expectedIngestMission,
          company: null,
          description: null,
          rateLabel: null,
          currency: null,
          locationLabel: null,
          region: null,
          country: null,
        },
      ],
      skippedInvalid: 0,
    })
  })

  it('rounds rates and duration to whole numbers', () => {
    expect(parseSingleMission({ rateMin: 449.6, rateMax: 550.4, durationMonths: 5.5 })).toEqual({
      missions: [{ ...expectedIngestMission, rateMin: 450, rateMax: 550, durationMonths: 6 }],
      skippedInvalid: 0,
    })
  })

  it('turns negative or unrealistic rates and duration into null', () => {
    expect(parseSingleMission({ rateMin: -1, rateMax: 100_001, durationMonths: 1201 })).toEqual({
      missions: [{ ...expectedIngestMission, rateMin: null, rateMax: null, durationMonths: null }],
      skippedInvalid: 0,
    })
  })

  it('turns missing rates and duration into null', () => {
    expect(parseSingleMission({ rateMin: undefined, rateMax: null, durationMonths: undefined })).toEqual({
      missions: [{ ...expectedIngestMission, rateMin: null, rateMax: null, durationMonths: null }],
      skippedInvalid: 0,
    })
  })

  it('keeps a daily rate of exactly one hundred thousand', () => {
    expect(parseSingleMission({ rateMin: null, rateMax: 100_000 })).toEqual({
      missions: [{ ...expectedIngestMission, rateMin: null, rateMax: 100_000 }],
      skippedInvalid: 0,
    })
  })

  it('trims skills, drops blank ones and treats missing skills as none', () => {
    expect(parseSingleMission({ skills: ['  React ', '', '   ', 'Next.js'] })).toEqual({
      missions: [{ ...expectedIngestMission, skills: ['React', 'Next.js'] }],
      skippedInvalid: 0,
    })
    expect(parseSingleMission({ skills: undefined })).toEqual({
      missions: [{ ...expectedIngestMission, skills: [] }],
      skippedInvalid: 0,
    })
  })

  it('keeps at most one hundred skills cut to one hundred characters', () => {
    const tooManySkills = ['   ', ...Array.from({ length: 120 }, (_unused, skillIndex) => `skill-${skillIndex}`)]
    const tooLongSkill = `  ${'s'.repeat(150)}`

    const parsedPayload = parseSingleMission({ skills: [tooLongSkill, ...tooManySkills] })

    expect(parsedPayload).toEqual({ missions: [expect.any(Object)], skippedInvalid: 0 })
    const [parsedMission] = 'missions' in parsedPayload ? parsedPayload.missions : []
    expect(parsedMission.skills).toHaveLength(MAXIMUM_STACK_ITEM_COUNT)
    expect(parsedMission.skills[0]).toBe('s'.repeat(MAXIMUM_STACK_ITEM_NAME_LENGTH))
    expect(parsedMission.skills[1]).toBe('skill-0')
    expect(parsedMission.skills.at(-1)).toBe('skill-98')
  })
})
