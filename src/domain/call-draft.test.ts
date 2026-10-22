import { buildCallDraft, matchCvOptionId, rankCallContactCandidates } from './call-draft'
import type { CallDraftInput, CallNoteExtraction } from './call-log'
import type { ContactListItem } from './contacts'

const buildContact = (overrides: Partial<ContactListItem> & Pick<ContactListItem, 'id'>): ContactListItem => ({
  fullName: 'Autre Personne',
  intermediaryId: null,
  intermediaryName: null,
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
  ...overrides,
})

const emptyCriteria = { phone: null, contactName: null, intermediaryName: null }

const emptyExtraction: CallNoteExtraction = {
  contactName: null,
  intermediaryName: null,
  contactPhone: null,
  contactEmail: null,
  summary: '',
  missionProposed: false,
  missionTitle: null,
  endClientName: null,
  dailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  stack: [],
  outcome: 'discussed',
  cvLabel: null,
}

const callInput: CallDraftInput = {
  text: 'Appel avec Jean-Marc',
  phone: null,
  contactId: null,
  occurredAt: new Date('2026-10-22T09:30:00.000Z'),
}

describe('rankCallContactCandidates', () => {
  it('suggests the contact whose normalized phone equals the typed number', () => {
    const contacts = [
      buildContact({ id: 'other', phone: '06 99 99 99 99' }),
      buildContact({ id: 'match', phone: '06 12 34 56 78' }),
    ]
    const result = rankCallContactCandidates(contacts, { ...emptyCriteria, phone: '+33 6 12 34 56 78' })
    expect(result.suggestedContactId).toBe('match')
    expect(result.candidates.map(({ id }) => id)).toEqual(['match'])
  })

  it('never suggests a contact from a phone fragment', () => {
    const contacts = [buildContact({ id: 'match', phone: '06 12 34 56 78' })]
    const result = rankCallContactCandidates(contacts, { ...emptyCriteria, phone: '12 34 56 78' })
    expect(result).toEqual({ candidates: [], suggestedContactId: null })
  })

  it('suggests the contact with the same normalized name and breaks ties with the agency', () => {
    const contacts = [
      buildContact({ id: 'randstad', fullName: 'Jean-Marc Dupont', intermediaryName: 'Randstad', lastExchangeAt: new Date('2026-10-01') }),
      buildContact({ id: 'hays', fullName: 'Jean-Marc Dupont', intermediaryName: 'Hays', lastExchangeAt: new Date('2026-01-01') }),
    ]
    const result = rankCallContactCandidates(contacts, {
      ...emptyCriteria,
      contactName: 'jean-marc  DUPONT',
      intermediaryName: 'HAYS',
    })
    expect(result.suggestedContactId).toBe('hays')
    expect(result.candidates.map(({ id }) => id)).toEqual(['hays', 'randstad'])
  })

  it('lists a first-name match as a candidate without suggesting it', () => {
    const contacts = [buildContact({ id: 'jean-marc', fullName: 'Jean-Marc Dupont' })]
    const result = rankCallContactCandidates(contacts, { ...emptyCriteria, contactName: 'Jean-Marc' })
    expect(result.candidates.map(({ id }) => id)).toEqual(['jean-marc'])
    expect(result.suggestedContactId).toBeNull()
  })

  it('returns at most three candidates, best first', () => {
    const contacts = [
      buildContact({ id: 'oldest', fullName: 'Sophie Martin', lastExchangeAt: new Date('2026-01-01') }),
      buildContact({ id: 'newest', fullName: 'Sophie Durand', lastExchangeAt: new Date('2026-09-01') }),
      buildContact({ id: 'middle', fullName: 'Sophie Petit', lastExchangeAt: new Date('2026-05-01') }),
      buildContact({ id: 'never', fullName: 'Sophie Roux', lastExchangeAt: null }),
    ]
    const result = rankCallContactCandidates(contacts, { ...emptyCriteria, contactName: 'Sophie' })
    expect(result.candidates.map(({ id }) => id)).toEqual(['newest', 'middle', 'oldest'])
  })
})

describe('matchCvOptionId', () => {
  const cvOptions = [
    { id: 'devops', label: 'CV DevOps' },
    { id: 'react', label: 'CV React' },
  ]

  it('matches the cv mentioned by normalized label', () => {
    expect(matchCvOptionId(cvOptions, 'cv  devops')).toBe('devops')
    expect(matchCvOptionId(cvOptions, 'mon CV DevOps')).toBe('devops')
  })

  it('returns no cv when the label is ambiguous or unknown', () => {
    expect(matchCvOptionId(cvOptions, 'CV')).toBeNull()
    expect(matchCvOptionId(cvOptions, 'CV Java')).toBeNull()
    expect(matchCvOptionId(cvOptions, null)).toBeNull()
  })
})

describe('buildCallDraft', () => {
  const missionExtraction: CallNoteExtraction = {
    ...emptyExtraction,
    missionProposed: true,
    missionTitle: 'Développeur React',
    outcome: 'declined',
  }

  it('maps a declined call to a KO après échange job application', () => {
    const draft = buildCallDraft({ input: callInput, extraction: missionExtraction, contacts: [], cvOptions: [] })
    expect(draft.jobApplication).toMatchObject({ title: 'Développeur React', status: 'ko_after_contact' })
  })

  it('returns no job application when no mission was proposed, even with mission fields', () => {
    const draft = buildCallDraft({
      input: callInput,
      extraction: { ...missionExtraction, missionProposed: false, dailyRate: 600, endClientName: 'BNP' },
      contacts: [],
      cvOptions: [],
    })
    expect(draft.jobApplication).toBeNull()
  })

  it('prefers the typed phone over the extracted one', () => {
    const draft = buildCallDraft({
      input: { ...callInput, phone: '06 11 11 11 11' },
      extraction: { ...emptyExtraction, contactPhone: '06 22 22 22 22' },
      contacts: [],
      cvOptions: [],
    })
    expect(draft.contact.phone).toBe('06 11 11 11 11')
  })

  it('keeps the preselected contact as the only candidate and the suggestion', () => {
    const contacts = [
      buildContact({ id: 'chosen', fullName: 'Paul Roux' }),
      buildContact({ id: 'namesake', fullName: 'Jean-Marc Dupont' }),
    ]
    const draft = buildCallDraft({
      input: { ...callInput, contactId: 'chosen' },
      extraction: { ...emptyExtraction, contactName: 'Jean-Marc Dupont' },
      contacts,
      cvOptions: [],
    })
    expect(draft.contact.candidates.map(({ id }) => id)).toEqual(['chosen'])
    expect(draft.contact.suggestedContactId).toBe('chosen')
  })

  it('falls back to the call note when the summary is empty', () => {
    const draft = buildCallDraft({
      input: callInput,
      extraction: { ...emptyExtraction, summary: '   ' },
      contacts: [],
      cvOptions: [],
    })
    expect(draft.exchange).toEqual({ summary: 'Appel avec Jean-Marc', occurredAt: '2026-10-22T09:30:00.000Z' })
  })

  it('cuts the fallback summary to the exchange summary limit', () => {
    const draft = buildCallDraft({
      input: { ...callInput, text: 'a'.repeat(3000) },
      extraction: { ...emptyExtraction, summary: '' },
      contacts: [],
      cvOptions: [],
    })
    expect(draft.exchange.summary).toHaveLength(2000)
  })

  it('rounds the daily rate and drops an out of range one', () => {
    const buildRate = (dailyRate: number) =>
      buildCallDraft({
        input: callInput,
        extraction: { ...missionExtraction, dailyRate },
        contacts: [],
        cvOptions: [],
      }).jobApplication?.postedDailyRate
    expect(buildRate(612.6)).toBe(613)
    expect(buildRate(250_000)).toBeNull()
    expect(buildRate(-5)).toBeNull()
  })

  it('takes the agency of the suggested contact when the AI found none', () => {
    const contacts = [buildContact({ id: 'jm', fullName: 'Jean-Marc Dupont', intermediaryName: 'Hays' })]
    const draft = buildCallDraft({
      input: callInput,
      extraction: { ...missionExtraction, contactName: 'Jean-Marc Dupont' },
      contacts,
      cvOptions: [],
    })
    expect(draft.contact.suggestedContactId).toBe('jm')
    expect(draft.jobApplication?.intermediaryName).toBe('Hays')
  })
})
