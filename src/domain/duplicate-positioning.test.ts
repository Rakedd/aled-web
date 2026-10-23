import {
  DUPLICATE_POSITIONING_MESSAGES,
  DUPLICATE_POSITIONING_WINDOW_DAYS,
  describeDuplicatePositioning,
  findDuplicatePositioningRisks,
  normalizeOrganisationName,
  type PositionedJobApplication,
  type PositioningCandidate,
} from './duplicate-positioning'

const buildCandidate = (overrides: Partial<PositioningCandidate> = {}): PositioningCandidate => ({
  jobApplicationId: null,
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Agence A',
  appliedOn: new Date('2026-10-20T10:00:00Z'),
  ...overrides,
})

const buildJobApplication = (overrides: Partial<PositionedJobApplication> = {}): PositionedJobApplication => ({
  id: 'existing-1',
  title: 'Développeur React',
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Agence B',
  appliedOn: new Date('2026-10-10T10:00:00Z'),
  ...overrides,
})

describe('constants', () => {
  it('exposes the window and the messages', () => {
    expect(DUPLICATE_POSITIONING_WINDOW_DAYS).toBe(30)
    expect(DUPLICATE_POSITIONING_MESSAGES.warning).toBe('Ce positionnement risque de faire doublon, attention.')
    expect(DUPLICATE_POSITIONING_MESSAGES.detail).toBe(
      "Ce client a déjà reçu ton CV il y a moins d'un mois par une autre agence. Si deux agences le présentent, la mission est souvent perdue.",
    )
  })
})

describe('normalizeOrganisationName', () => {
  it('lowercases, removes accents and punctuation, and collapses spaces', () => {
    expect(normalizeOrganisationName('  Société-Générale ')).toBe('societe generale')
  })

  it('removes one trailing legal form', () => {
    expect(normalizeOrganisationName('Société Générale SA')).toBe('societe generale')
    expect(normalizeOrganisationName('Acme GmbH')).toBe('acme')
    expect(normalizeOrganisationName('Acme SAS SA')).toBe('acme sas')
  })

  it('never reduces a name to an empty string', () => {
    expect(normalizeOrganisationName('SA')).toBe('sa')
    expect(normalizeOrganisationName('SAS')).toBe('sas')
  })

  it('returns an empty string for null or blank names', () => {
    expect(normalizeOrganisationName(null)).toBe('')
    expect(normalizeOrganisationName('  - ')).toBe('')
  })
})

describe('findDuplicatePositioningRisks', () => {
  it('matches the same company with and without its legal form', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate({ endClientName: 'Société Générale SA' }), [
      buildJobApplication(),
    ])
    expect(risks).toHaveLength(1)
  })

  it('recognises the same end client written differently', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate(), [
      buildJobApplication({ endClientName: '  societe   generale ' }),
    ])
    expect(risks).toHaveLength(1)
  })

  it('never flags the job application being edited', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate({ jobApplicationId: 'existing-1' }), [
      buildJobApplication(),
    ])
    expect(risks).toEqual([])
  })

  it('does not warn when the agency is the same', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate({ intermediaryName: 'agence a' }), [
      buildJobApplication({ intermediaryName: 'Agence  A' }),
    ])
    expect(risks).toEqual([])
  })

  it('warns when one of the agencies is unknown', () => {
    expect(
      findDuplicatePositioningRisks(buildCandidate({ intermediaryName: null }), [buildJobApplication()]),
    ).toHaveLength(1)
    expect(
      findDuplicatePositioningRisks(buildCandidate(), [buildJobApplication({ intermediaryName: null })]),
    ).toHaveLength(1)
  })

  it('keeps an existing application exactly 30 Paris calendar days away and drops one at 31', () => {
    const candidate = buildCandidate({ appliedOn: new Date('2026-10-31T10:00:00Z') })
    const atLimit = buildJobApplication({ id: 'at-limit', appliedOn: new Date('2026-10-01T10:00:00Z') })
    const beyondLimit = buildJobApplication({ id: 'beyond', appliedOn: new Date('2026-09-30T10:00:00Z') })
    const risks = findDuplicatePositioningRisks(candidate, [atLimit, beyondLimit])
    expect(risks.map((risk) => risk.id)).toEqual(['at-limit'])
  })

  it('counts days in Paris time around midnight', () => {
    const candidate = buildCandidate({ appliedOn: new Date('2026-10-31T00:30:00+01:00') })
    const existing = buildJobApplication({ appliedOn: new Date('2026-09-30T21:30:00Z') })
    expect(findDuplicatePositioningRisks(candidate, [existing])).toEqual([])
  })

  it('counts an existing application dated after the candidate', () => {
    const candidate = buildCandidate({ appliedOn: new Date('2026-10-01T10:00:00Z') })
    const later = buildJobApplication({ id: 'later', appliedOn: new Date('2026-10-31T10:00:00Z') })
    const tooLate = buildJobApplication({ id: 'too-late', appliedOn: new Date('2026-11-01T10:00:00Z') })
    const risks = findDuplicatePositioningRisks(candidate, [later, tooLate])
    expect(risks.map((risk) => risk.id)).toEqual(['later'])
  })

  it('matches when the candidate parent equals the existing client', () => {
    const risks = findDuplicatePositioningRisks(
      buildCandidate({ endClientName: 'SG Filiale', endClientParentName: 'Société Générale' }),
      [buildJobApplication()],
    )
    expect(risks).toHaveLength(1)
  })

  it('matches when both share the same parent', () => {
    const risks = findDuplicatePositioningRisks(
      buildCandidate({ endClientName: 'Filiale 1', endClientParentName: 'Groupe X' }),
      [buildJobApplication({ endClientName: 'Filiale 2', endClientParentName: 'groupe x' })],
    )
    expect(risks).toHaveLength(1)
  })

  it('returns nothing without an end client', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate({ endClientName: null }), [
      buildJobApplication({ endClientName: null }),
    ])
    expect(risks).toEqual([])
  })

  it('matches job applications whatever their stage, since the list carries no status', () => {
    const risks = findDuplicatePositioningRisks(buildCandidate(), [
      buildJobApplication({ id: 'a' }),
      buildJobApplication({ id: 'b' }),
    ])
    expect(risks).toHaveLength(2)
  })

  it('sorts from the most recent to the oldest', () => {
    const older = buildJobApplication({ id: 'older', appliedOn: new Date('2026-10-01T10:00:00Z') })
    const newer = buildJobApplication({ id: 'newer', appliedOn: new Date('2026-10-15T10:00:00Z') })
    const risks = findDuplicatePositioningRisks(buildCandidate(), [older, newer])
    expect(risks.map((risk) => risk.id)).toEqual(['newer', 'older'])
  })
})

describe('describeDuplicatePositioning', () => {
  it('joins title, agency and Paris date', () => {
    expect(describeDuplicatePositioning(buildJobApplication())).toBe('Développeur React · Agence B · 10/10/2026')
  })

  it('falls back to an unknown agency', () => {
    expect(describeDuplicatePositioning(buildJobApplication({ intermediaryName: null }))).toBe(
      'Développeur React · agence inconnue · 10/10/2026',
    )
  })
})
