import {
  type Opportunity,
  REMOTE_MODE_LABELS,
  buildJobApplicationInputFromOpportunity,
  formatOpportunityRate,
  isOpportunityFeedStale,
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

  it('falls back to the low end of the range for the posted daily rate', () => {
    expect(buildJobApplicationInputFromOpportunity({ ...bareOpportunity, rateMin: 480 }, today).postedDailyRate).toBe(480)
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
