import { MAXIMUM_STACK_ITEM_COUNT, validateJobApplicationInput } from './job-application'
import {
  type Opportunity,
  REMOTE_MODE_LABELS,
  buildJobApplicationInputFromOpportunity,
  formatOpportunityRate,
  isOpportunityFeedStale,
  isRemoteMode,
  mergeStackItems,
  validateOpportunityId,
  validateOpportunityListingRequest,
  validateOpportunitySource,
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

describe('REMOTE_MODE_LABELS', () => {
  it('labels every remote mode in French', () => {
    expect(REMOTE_MODE_LABELS).toEqual({ full: 'Full remote', partial: 'Hybride', none: 'Sur site' })
  })
})

describe('buildJobApplicationInputFromOpportunity', () => {
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

describe('validateOpportunitySource', () => {
  it('accepts free-work only', () => {
    expect(validateOpportunitySource('free-work')).toEqual({ ok: true, data: 'free-work' })
    expect(validateOpportunitySource('linkedin')).toEqual({ ok: false, errorMessage: 'Source inconnue' })
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
    expect(validateOpportunityListingRequest('dismissed', null, '')).toEqual({
      ok: true,
      data: { tab: 'dismissed', after: null, search: '' },
    })
  })

  it('accepts a known tab with the position of the last loaded item', () => {
    expect(
      validateOpportunityListingRequest('applied', { publishedAt: '2026-10-17T09:00:00.000Z', id: cursorId }, ''),
    ).toEqual({
      ok: true,
      data: {
        tab: 'applied',
        after: { publishedAt: new Date('2026-10-17T09:00:00.000Z'), id: cursorId },
        search: '',
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
  ])('rejects %s', (_caseName, tab, cursor) => {
    expect(validateOpportunityListingRequest(tab, cursor, '')).toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
  })

  it('rejects a search that is not a string', () => {
    expect(validateOpportunityListingRequest('to_process', null, 42)).toEqual({
      ok: false,
      errorMessage: 'Onglet ou page invalide',
    })
  })

  it('trims the search', () => {
    expect(validateOpportunityListingRequest('to_process', null, '  react  ')).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search: 'react' },
    })
  })

  it('treats a whitespace-only search as no search', () => {
    expect(validateOpportunityListingRequest('to_process', null, '   ')).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search: '' },
    })
  })

  it('accepts a search of exactly 100 characters', () => {
    const search = 'a'.repeat(100)
    expect(validateOpportunityListingRequest('to_process', null, search)).toEqual({
      ok: true,
      data: { tab: 'to_process', after: null, search },
    })
  })

  it('rejects a search longer than 100 characters', () => {
    expect(validateOpportunityListingRequest('to_process', null, 'a'.repeat(101))).toEqual({
      ok: false,
      errorMessage: 'La recherche ne peut pas dépasser 100 caractères',
    })
  })
})
