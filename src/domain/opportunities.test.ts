import { MAXIMUM_STACK_ITEM_COUNT, validateJobApplicationInput } from './job-application'
import {
  NO_OPPORTUNITY_QUICK_FILTERS,
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_SOURCES,
  type Opportunity,
  type OpportunityListingPosition,
  REMOTE_MODE_LABELS,
  buildJobApplicationInputFromOpportunity,
  compareOpportunityListingPositions,
  formatOpportunityRate,
  isOpportunityFeedStale,
  isOpportunitySource,
  isRemoteMode,
  matchesRemoteModeQuickFilter,
  mergeStackItems,
  toOpportunityListingPosition,
  validateOpportunityId,
  validateOpportunityListingRequest,
} from './opportunities'

const today = new Date('2026-10-17T22:00:00Z')

const completeOpportunity: Opportunity = {
  id: '6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60',
  source: 'free-work',
  externalId: '123456',
  url: 'https://www.free-work.com/fr/tech-it/developpeur-react/job-mission/dev-react-senior',
  title: 'Dev React senior',
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
  publishedAt: new Date('2026-10-16T08:00:00Z'),
  skills: ['React', ' TypeScript ', 'react', 'Next.js', '  '],
  receivedAt: new Date('2026-10-16T09:00:00Z'),
}

const bareOpportunity: Opportunity = {
  ...completeOpportunity,
  company: null,
  description: null,
  rateMin: null,
  rateMax: null,
  rateLabel: null,
  currency: null,
  remoteMode: null,
  locationLabel: null,
  region: null,
  country: null,
  durationMonths: null,
  skills: [],
}

describe('OPPORTUNITY_SOURCES', () => {
  it('lists Free-Work then Collective with their display names', () => {
    expect(OPPORTUNITY_SOURCES).toEqual(['free-work', 'collective'])
    expect(OPPORTUNITY_SOURCE_LABELS).toEqual({ 'free-work': 'Free-Work', collective: 'Collective' })
  })

  it('knows collective and nothing beyond the listed sources', () => {
    expect(isOpportunitySource('collective')).toBe(true)
    expect(isOpportunitySource('linkedin')).toBe(false)
  })
})

describe('REMOTE_MODE_LABELS', () => {
  it('labels every remote mode in French', () => {
    expect(REMOTE_MODE_LABELS).toEqual({ full: 'Full remote', partial: 'Hybride', none: 'Sur site' })
  })
})

describe('buildJobApplicationInputFromOpportunity', () => {
  it('names the Collective platform as the source of an application', () => {
    expect(buildJobApplicationInputFromOpportunity({ ...completeOpportunity, source: 'collective' }, today).source).toBe(
      'Collective',
    )
  })

  it('copies every known field of a complete opportunity', () => {
    expect(buildJobApplicationInputFromOpportunity(completeOpportunity, today)).toEqual({
      title: 'Dev React senior',
      source: 'Free-Work',
      postingUrl: 'https://www.free-work.com/fr/tech-it/developpeur-react/job-mission/dev-react-senior',
      postingRawText: 'Mission React / Next.js pour un grand compte.',
      status: 'applied',
      postedDailyRate: 550,
      requestedDailyRate: null,
      location: 'Paris, Île-de-France',
      remotePolicy: 'Hybride',
      desiredStart: null,
      duration: '6 mois',
      appliedOn: today,
      notes: null,
      actualStartDate: null,
      stack: [
        { name: 'React', category: 'other', origin: 'posting' },
        { name: 'TypeScript', category: 'other', origin: 'posting' },
        { name: 'Next.js', category: 'other', origin: 'posting' },
      ],
      intermediaryName: 'Agence X',
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      endClientName: null,
      endClientParentName: null,
    })
  })

  it('leaves every optional field empty for an opportunity without optional data', () => {
    expect(buildJobApplicationInputFromOpportunity(bareOpportunity, today)).toEqual({
      title: 'Dev React senior',
      source: 'Free-Work',
      postingUrl: 'https://www.free-work.com/fr/tech-it/developpeur-react/job-mission/dev-react-senior',
      postingRawText: null,
      status: 'applied',
      postedDailyRate: null,
      requestedDailyRate: null,
      location: null,
      remotePolicy: null,
      desiredStart: null,
      duration: null,
      appliedOn: today,
      notes: null,
      actualStartDate: null,
      stack: [],
      intermediaryName: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      endClientName: null,
      endClientParentName: null,
    })
  })

  it('leaves the duration empty when the number of months is not positive', () => {
    expect(buildJobApplicationInputFromOpportunity({ ...bareOpportunity, durationMonths: 0 }, today).duration).toBeNull()
    expect(buildJobApplicationInputFromOpportunity({ ...bareOpportunity, durationMonths: -2 }, today).duration).toBeNull()
  })

  it('always produces an input that job application validation accepts, even from oversized data', () => {
    const messyOpportunity: Opportunity = {
      ...completeOpportunity,
      title: 'T'.repeat(300),
      description: 'D'.repeat(60_000),
      company: 'C'.repeat(250),
      locationLabel: 'L'.repeat(250),
      skills: [...Array.from({ length: 150 }, (_, index) => `Skill ${index}`), 'S'.repeat(120)],
    }
    const jobApplicationInput = buildJobApplicationInputFromOpportunity(messyOpportunity, today)
    expect(validateJobApplicationInput(jobApplicationInput).ok).toBe(true)
    expect(jobApplicationInput.title).toBe('T'.repeat(200))
    expect(jobApplicationInput.postingRawText).toBe('D'.repeat(50_000))
    expect(jobApplicationInput.intermediaryName).toBe('C'.repeat(200))
    expect(jobApplicationInput.location).toBe('L'.repeat(200))
    expect(jobApplicationInput.stack).toHaveLength(100)
  })

  it('shortens an overlong skill name instead of dropping it', () => {
    const jobApplicationInput = buildJobApplicationInputFromOpportunity({ ...bareOpportunity, skills: ['S'.repeat(120)] }, today)
    expect(jobApplicationInput.stack).toEqual([{ name: 'S'.repeat(100), category: 'other', origin: 'posting' }])
  })

  it('falls back to the low end of the range for the posted daily rate', () => {
    expect(buildJobApplicationInputFromOpportunity({ ...bareOpportunity, rateMin: 480 }, today).postedDailyRate).toBe(480)
  })
})

describe('mergeStackItems', () => {
  it('appends the extra items that are not already in the base, keeping the base order', () => {
    expect(
      mergeStackItems(
        [{ name: 'React', category: 'framework', origin: 'posting' }],
        [
          { name: 'react', category: 'tool', origin: 'posting' },
          { name: 'TypeScript', category: 'language', origin: 'posting' },
        ],
      ),
    ).toEqual([
      { name: 'React', category: 'framework', origin: 'posting' },
      { name: 'TypeScript', category: 'language', origin: 'posting' },
    ])
  })

  it('treats names that differ only by accents or spacing as duplicates', () => {
    expect(
      mergeStackItems(
        [{ name: 'Modélisation  UML', category: 'method', origin: 'posting' }],
        [{ name: ' modelisation uml ', category: 'method', origin: 'posting' }],
      ),
    ).toEqual([{ name: 'Modélisation  UML', category: 'method', origin: 'posting' }])
  })

  it('upgrades the other category of a base item with the category of its extra duplicate', () => {
    expect(
      mergeStackItems(
        [
          { name: 'React', category: 'other', origin: 'posting' },
          { name: 'Scrum', category: 'method', origin: 'posting' },
        ],
        [
          { name: 'react', category: 'framework', origin: 'posting' },
          { name: 'scrum', category: 'tool', origin: 'posting' },
          { name: 'Kafka', category: 'other', origin: 'posting' },
          { name: 'kafka', category: 'other', origin: 'posting' },
        ],
      ),
    ).toEqual([
      { name: 'React', category: 'framework', origin: 'posting' },
      { name: 'Scrum', category: 'method', origin: 'posting' },
      { name: 'Kafka', category: 'other', origin: 'posting' },
    ])
  })

  it('caps the merged stack at the maximum item count', () => {
    const extraItems = Array.from({ length: 150 }, (_, index) => ({
      name: `Skill ${index}`,
      category: 'other' as const,
      origin: 'posting' as const,
    }))
    const mergedStack = mergeStackItems([], extraItems)
    expect(mergedStack).toHaveLength(MAXIMUM_STACK_ITEM_COUNT)
    expect(mergedStack[0].name).toBe('Skill 0')
  })

  it('shortens overlong names and drops blank ones', () => {
    expect(
      mergeStackItems(
        [{ name: '   ', category: 'other', origin: 'posting' }],
        [{ name: 'S'.repeat(120), category: 'tool', origin: 'posting' }],
      ),
    ).toEqual([{ name: 'S'.repeat(100), category: 'tool', origin: 'posting' }])
  })
})

describe('isOpportunityFeedStale', () => {
  it('is stale at 3 pm Paris when the last reception was at 10:30 am', () => {
    expect(isOpportunityFeedStale(new Date('2026-10-18T08:30:00Z'), new Date('2026-10-18T13:00:00Z'))).toBe(true)
  })
  it('is fresh at 3 pm Paris when the last reception was at noon', () => {
    expect(isOpportunityFeedStale(new Date('2026-10-18T10:00:00Z'), new Date('2026-10-18T13:00:00Z'))).toBe(false)
  })
  it('is never stale at 11:30 pm Paris', () => {
    expect(isOpportunityFeedStale(new Date('2026-10-18T08:00:00Z'), new Date('2026-10-18T21:30:00Z'))).toBe(false)
  })
  it('is stale at 10 am Paris when nothing was ever received', () => {
    expect(isOpportunityFeedStale(null, new Date('2026-10-18T08:00:00Z'))).toBe(true)
  })
  it('is fresh when the last reception is exactly 4 hours old', () => {
    expect(isOpportunityFeedStale(new Date('2026-10-18T09:00:00Z'), new Date('2026-10-18T13:00:00Z'))).toBe(false)
  })
  it('watches from 9 am to 10 pm Paris, in winter time too', () => {
    expect(isOpportunityFeedStale(null, new Date('2026-12-01T07:59:00Z'))).toBe(false)
    expect(isOpportunityFeedStale(null, new Date('2026-12-01T08:00:00Z'))).toBe(true)
    expect(isOpportunityFeedStale(null, new Date('2026-12-01T20:59:00Z'))).toBe(true)
    expect(isOpportunityFeedStale(null, new Date('2026-12-01T21:00:00Z'))).toBe(false)
  })
})

describe('formatOpportunityRate', () => {
  const unknownRate = { rateLabel: null, rateMin: null, rateMax: null }

  it('prefers the label published by the source', () => {
    expect(formatOpportunityRate({ rateLabel: '500 €/j', rateMin: 400, rateMax: 450 })).toBe('500 €/j')
  })
  it('ignores a blank label', () => {
    expect(formatOpportunityRate({ rateLabel: '   ', rateMin: 400, rateMax: 500 })).toBe('400-500 €/j')
    expect(formatOpportunityRate({ ...unknownRate, rateLabel: '   ' })).toBe('Non communiqué')
  })
  it('shows the range when both ends are known', () => {
    expect(formatOpportunityRate({ ...unknownRate, rateMin: 400, rateMax: 500 })).toBe('400-500 €/j')
  })
  it('shows the single known rate', () => {
    expect(formatOpportunityRate({ ...unknownRate, rateMin: 400 })).toBe('400 €/j')
    expect(formatOpportunityRate({ ...unknownRate, rateMax: 500 })).toBe('500 €/j')
    expect(formatOpportunityRate({ ...unknownRate, rateMin: 500, rateMax: 500 })).toBe('500 €/j')
  })
  it('says the rate is not disclosed otherwise', () => {
    expect(formatOpportunityRate(unknownRate)).toBe('Non communiqué')
  })
})

describe('validateOpportunityId', () => {
  it('accepts a uuid', () => {
    expect(validateOpportunityId('6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60')).toEqual({
      ok: true,
      data: '6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60',
    })
  })

  it('answers « Opportunité introuvable » for anything else', () => {
    expect(validateOpportunityId('42')).toEqual({ ok: false, errorMessage: 'Opportunité introuvable' })
    expect(validateOpportunityId(undefined)).toEqual({ ok: false, errorMessage: 'Opportunité introuvable' })
  })
})

describe('isRemoteMode', () => {
  it('recognises the three stored remote modes only', () => {
    expect(['full', 'partial', 'none', 'toString', null].map(isRemoteMode)).toEqual([true, true, true, false, false])
  })
})

describe('validateOpportunityListingRequest', () => {
  const cursorId = '6f1f4f7e-2f8c-4c55-9f0e-1b2c3d4e5f60'

  it('accepts a known tab without cursor', () => {
    expect(validateOpportunityListingRequest('dismissed', null, '', NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: true,
      data: { tab: 'dismissed', after: null, search: '', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
    })
  })

  it('accepts a known tab with the position of the last loaded item', () => {
    expect(
      validateOpportunityListingRequest(
        'applied',
        { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId, rate: 650 },
        '',
        NO_OPPORTUNITY_QUICK_FILTERS,
      ),
    ).toEqual({
      ok: true,
      data: {
        tab: 'applied',
        after: { publishedAt: new Date('2026-10-17T09:00:00.000Z'), id: cursorId, rate: 650 },
        search: '',
        quickFilters: NO_OPPORTUNITY_QUICK_FILTERS,
      },
    })
  })

  it.each([
    ['an unknown tab', 'archived', null],
    ['a page number instead of a cursor', 'to_process', 2],
    ['a cursor without id', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z' }],
    ['a cursor with an id that is not a uuid', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: '42' }],
    ['a cursor with an invalid date', 'applied', { publishedAt: 'hier', id: cursorId }],
    ['a cursor with a date given as number', 'applied', { publishedAt: 1760691600000, id: cursorId }],
    ['a cursor with a rate given as text', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId, rate: '650' }],
    ['a cursor with a negative rate', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId, rate: -1 }],
    ['a cursor with a rate that is not a number', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId, rate: NaN }],
    ['a cursor with an infinite rate', 'to_process', { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId, rate: Infinity }],
  ])('rejects %s', (_caseName, tab, cursor) => {
    expect(validateOpportunityListingRequest(tab, cursor, '', NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
  })

  it('rejects a search that is not a string', () => {
    expect(validateOpportunityListingRequest('to_process', null, 42, NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
  })

  it('trims the search', () => {
    expect(validateOpportunityListingRequest('to_process', null, '  react  ', NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search: 'react', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
    })
  })

  it('treats a whitespace-only search as no search', () => {
    expect(validateOpportunityListingRequest('to_process', null, '   ', NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search: '', quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
    })
  })

  it('accepts a search of exactly 100 characters', () => {
    const search = 'a'.repeat(100)
    expect(validateOpportunityListingRequest('to_process', null, search, NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search, quickFilters: NO_OPPORTUNITY_QUICK_FILTERS },
    })
  })

  it('rejects a search longer than 100 characters', () => {
    expect(validateOpportunityListingRequest('to_process', null, 'a'.repeat(101), NO_OPPORTUNITY_QUICK_FILTERS)).toEqual({
      ok: false,
      errorMessage: 'La recherche ne peut pas dépasser 100 caractères',
    })
  })

  it('accepts a cursor without rate as a cursor with an undisclosed rate', () => {
    expect(
      validateOpportunityListingRequest(
        'to_process',
        { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId },
        '',
        NO_OPPORTUNITY_QUICK_FILTERS,
      ),
    ).toEqual({
      ok: true,
      data: {
        tab: 'to_process',
        after: { publishedAt: new Date('2026-10-17T09:00:00.000Z'), id: cursorId, rate: null },
        search: '',
        quickFilters: NO_OPPORTUNITY_QUICK_FILTERS,
      },
    })
  })

  it('deduplicates the remote modes and orders them like the stored remote modes', () => {
    expect(
      validateOpportunityListingRequest('to_process', null, '', { sortByRate: true, remoteModes: ['none', 'full', 'full'] }),
    ).toEqual({
      ok: true,
      data: {
        tab: 'to_process',
        after: null,
        search: '',
        quickFilters: { sortByRate: true, remoteModes: ['full', 'none'] },
      },
    })
  })

  it.each([
    ['an unknown remote mode', { sortByRate: false, remoteModes: ['moon'] }],
    ['a rate sort that is not a boolean', { sortByRate: 'yes', remoteModes: [] }],
    ['remote modes that are not a list', { sortByRate: false, remoteModes: 'full' }],
    ['missing quick filters', undefined],
  ])('rejects %s', (_caseName, quickFilters) => {
    expect(validateOpportunityListingRequest('to_process', null, '', quickFilters)).toEqual({
      ok: false,
      errorMessage: 'Filtres rapides invalides',
    })
  })
})

describe('compareOpportunityListingPositions', () => {
  const buildPosition = (id: string, rate: number | null, publishedAt: string): OpportunityListingPosition => ({
    id,
    rate,
    publishedAt: new Date(publishedAt),
  })

  it('ranks by rate descending with undisclosed rates last, then by publication descending', () => {
    const positions = [
      buildPosition('undisclosed-old', null, '2026-10-15T09:00:00Z'),
      buildPosition('rate-500', 500, '2026-10-17T09:00:00Z'),
      buildPosition('rate-700-old', 700, '2026-10-15T09:00:00Z'),
      buildPosition('undisclosed-recent', null, '2026-10-17T09:00:00Z'),
      buildPosition('rate-650', 650, '2026-10-16T09:00:00Z'),
      buildPosition('rate-700-recent', 700, '2026-10-17T09:00:00Z'),
    ]

    expect([...positions].sort(compareOpportunityListingPositions('rate')).map(({ id }) => id)).toEqual([
      'rate-700-recent',
      'rate-700-old',
      'rate-650',
      'rate-500',
      'undisclosed-recent',
      'undisclosed-old',
    ])
  })

  it('breaks complete ties by id descending', () => {
    const positions = [
      buildPosition('a-first', 700, '2026-10-17T09:00:00Z'),
      buildPosition('c-third', 700, '2026-10-17T09:00:00Z'),
      buildPosition('b-second', 700, '2026-10-17T09:00:00Z'),
    ]

    expect([...positions].sort(compareOpportunityListingPositions('rate')).map(({ id }) => id)).toEqual([
      'c-third',
      'b-second',
      'a-first',
    ])
  })

  it('keeps the publication order without looking at the rate', () => {
    const positions = [
      buildPosition('old-700', 700, '2026-10-15T09:00:00Z'),
      buildPosition('recent-500', 500, '2026-10-17T09:00:00Z'),
    ]

    expect([...positions].sort(compareOpportunityListingPositions('publication')).map(({ id }) => id)).toEqual([
      'recent-500',
      'old-700',
    ])
  })
})

describe('toOpportunityListingPosition', () => {
  it('keeps the id and the publication date and carries the effective rate', () => {
    expect(toOpportunityListingPosition(completeOpportunity)).toEqual({
      id: completeOpportunity.id,
      publishedAt: completeOpportunity.publishedAt,
      rate: 550,
    })
    expect(toOpportunityListingPosition(bareOpportunity).rate).toBeNull()
  })
})

describe('NO_OPPORTUNITY_QUICK_FILTERS', () => {
  it('cannot be mutated from one request to another', () => {
    expect(Object.isFrozen(NO_OPPORTUNITY_QUICK_FILTERS)).toBe(true)
    expect(Object.isFrozen(NO_OPPORTUNITY_QUICK_FILTERS.remoteModes)).toBe(true)
  })
})

describe('matchesRemoteModeQuickFilter', () => {
  it('accepts every mission, even without known remote mode, when no remote mode is selected', () => {
    expect(matchesRemoteModeQuickFilter(null, [])).toBe(true)
    expect(matchesRemoteModeQuickFilter('partial', [])).toBe(true)
  })

  it('only accepts the selected remote modes otherwise', () => {
    expect(matchesRemoteModeQuickFilter(null, ['full'])).toBe(false)
    expect(matchesRemoteModeQuickFilter('none', ['full', 'none'])).toBe(true)
    expect(matchesRemoteModeQuickFilter('partial', ['full', 'none'])).toBe(false)
  })
})
