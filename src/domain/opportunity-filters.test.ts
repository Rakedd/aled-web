import {
  EMPTY_OPPORTUNITY_FILTERS,
  OPPORTUNITY_FILTERS_VALIDATION_MESSAGES,
  type OpportunityFilters,
  type OpportunityMatchCandidate,
  buildKeywordMatcher,
  createOpportunityMatcher,
  hasActiveOpportunityFilters,
  normalizeForKeywordMatch,
  normalizeRegionName,
  validateOpportunityFilters,
} from './opportunity-filters'

const filters = (override: Partial<OpportunityFilters>): OpportunityFilters => ({ ...EMPTY_OPPORTUNITY_FILTERS, ...override })
const candidate = (override: Partial<OpportunityMatchCandidate>): OpportunityMatchCandidate => ({ title: 'Dev React', rateMin: null, rateMax: null, remoteMode: 'partial', region: 'Île-de-France', locationLabel: 'Paris, Île-de-France', ...override })

describe('normalizeForKeywordMatch', () => {
  it('lowercases, strips accents and collapses spaces', () => {
    expect(normalizeForKeywordMatch('  Développeur   ÉLECTRONIQUE ')).toBe('developpeur electronique')
  })
})

describe('normalizeRegionName', () => {
  it('folds curly apostrophes into the straight one', () => {
    expect(normalizeRegionName('Provence-Alpes-Côte d’Azur')).toBe(normalizeRegionName("Provence-Alpes-Côte d'Azur"))
    expect(normalizeRegionName('Côte d‘Azur')).toBe(normalizeRegionName("Côte d'Azur"))
    expect(normalizeRegionName('Côte dʼAzur')).toBe(normalizeRegionName("Côte d'Azur"))
  })

  it('treats hyphens and spaces as the same separator', () => {
    expect(normalizeRegionName('Pays-de-la-Loire')).toBe(normalizeRegionName('Pays de la Loire'))
    expect(normalizeRegionName(' Île - de -  France ')).toBe('ile de france')
  })

  it('keeps accent and case folding from keyword normalization', () => {
    expect(normalizeRegionName('ÎLE-DE-FRANCE')).toBe(normalizeRegionName('ile-de-france'))
  })

  it('leaves keyword normalization unchanged', () => {
    expect(normalizeForKeywordMatch('Front-end d’Azur')).toBe('front-end d’azur')
  })
})

describe('buildKeywordMatcher', () => {
  it('returns the first matching keyword as typed, or an empty string', () => {
    const matcher = buildKeywordMatcher(['Vue', 'React'])
    expect(matcher(normalizeForKeywordMatch('Dev React senior'))).toBe('React')
    expect(matcher(normalizeForKeywordMatch('Dev Angular'))).toBe('')
  })
  it('ignores blank keywords instead of matching everything', () => {
    const matcher = buildKeywordMatcher(['', '   '])
    expect(matcher(normalizeForKeywordMatch('Dev React'))).toBe('')
  })
  it('never matches inside a word, even one that had accents', () => {
    expect(buildKeywordMatcher(['velopp'])(normalizeForKeywordMatch('Développeur'))).toBe('')
  })
})

describe('createOpportunityMatcher', () => {
  it('shows everything when no filter is set', () => {
    expect(createOpportunityMatcher(EMPTY_OPPORTUNITY_FILTERS)(candidate({ title: 'Plombier' }))).toBe(true)
  })
  it('matches whole words only, accents and case ignored', () => {
    const matcher = createOpportunityMatcher(filters({ includeKeywords: ['java', 'IA'] }))
    expect(matcher(candidate({ title: 'Dev JavaScript' }))).toBe(false)
    expect(matcher(candidate({ title: 'Spécialiste data' }))).toBe(false)
    expect(matcher(candidate({ title: 'Ingénieur ia générative' }))).toBe(true)
  })
  it.each([['c#', 'Dev C# senior'], ['.net', 'Lead .NET Core'], ['node.js', 'Backend Node.js'], ['c++', 'Dev C++ embarqué']])('matches %s literally', (keyword, title) => {
    expect(createOpportunityMatcher(filters({ includeKeywords: [keyword] }))(candidate({ title }))).toBe(true)
  })
  it('does not treat keyword metacharacters as regular expression syntax', () => {
    expect(createOpportunityMatcher(filters({ includeKeywords: ['node.js'] }))(candidate({ title: 'Backend nodexjs' }))).toBe(false)
  })
  it('keeps the inclusive middle dot as a word boundary, unlike the watcher which strips it', () => {
    expect(createOpportunityMatcher(filters({ includeKeywords: ['developpeur'] }))(candidate({ title: 'Développeur·se React' }))).toBe(true)
  })
  it('ignores an include list made only of blank keywords', () => {
    expect(createOpportunityMatcher(filters({ includeKeywords: ['  '] }))(candidate({ title: 'Plombier' }))).toBe(true)
  })
  it('rescues a rescuable exclusion but never a hard exclusion', () => {
    const matcher = createOpportunityMatcher(filters({ rescuableExcludeKeywords: ['java'], rescueKeywords: ['react'], alwaysExcludeKeywords: ['stage'] }))
    expect(matcher(candidate({ title: 'Dev Fullstack React / Java' }))).toBe(true)
    expect(matcher(candidate({ title: 'Dev Java Spring' }))).toBe(false)
    expect(matcher(candidate({ title: 'Stage React' }))).toBe(false)
  })
  it('applies the rate floor of the remote mode, unknown mode takes the strictest, unknown rate passes', () => {
    const matcher = createOpportunityMatcher(filters({ rateFloorFullRemote: 400, rateFloorHybrid: 450, rateFloorOnsite: 500 }))
    expect(matcher(candidate({ remoteMode: 'full', rateMax: 420 }))).toBe(true)
    expect(matcher(candidate({ remoteMode: 'partial', rateMin: 300, rateMax: 440 }))).toBe(false)
    expect(matcher(candidate({ remoteMode: null, rateMax: 480 }))).toBe(false)
    expect(matcher(candidate({ remoteMode: 'none', rateMin: null, rateMax: null }))).toBe(true)
  })
  it('uses the low end of the range when the high end is unknown', () => {
    const matcher = createOpportunityMatcher(filters({ rateFloorOnsite: 500 }))
    expect(matcher(candidate({ remoteMode: 'none', rateMin: 450, rateMax: null }))).toBe(false)
    expect(matcher(candidate({ remoteMode: 'none', rateMin: 550, rateMax: null }))).toBe(true)
  })
  it('skips the rate rule for a mode without floor, and for an unknown mode without any floor', () => {
    expect(createOpportunityMatcher(filters({ rateFloorOnsite: 500 }))(candidate({ remoteMode: 'full', rateMax: 100 }))).toBe(true)
    expect(createOpportunityMatcher(EMPTY_OPPORTUNITY_FILTERS)(candidate({ remoteMode: null, rateMax: 100 }))).toBe(true)
  })
  it('lets an unknown mode use the strictest of the floors that are set', () => {
    const matcher = createOpportunityMatcher(filters({ rateFloorFullRemote: 400 }))
    expect(matcher(candidate({ remoteMode: null, rateMax: 420 }))).toBe(true)
    expect(matcher(candidate({ remoteMode: null, rateMax: 380 }))).toBe(false)
  })
  it('matches regions on region or location label, full remote always passes', () => {
    const matcher = createOpportunityMatcher(filters({ regions: ['paris'] }))
    expect(matcher(candidate({ region: 'Île-de-France', locationLabel: 'Paris 8e' }))).toBe(true)
    expect(matcher(candidate({ region: 'Auvergne-Rhône-Alpes', locationLabel: 'Lyon' }))).toBe(false)
    expect(matcher(candidate({ region: 'Bretagne', locationLabel: 'Rennes', remoteMode: 'full' }))).toBe(true)
    expect(matcher(candidate({ region: null, locationLabel: null }))).toBe(true)
    expect(createOpportunityMatcher(filters({ regions: ['ile-de-france'] }))(candidate({ region: 'Île-de-France', locationLabel: null }))).toBe(true)
  })
  it('matches a region across apostrophe and hyphen variants, on region and location label', () => {
    const matcher = createOpportunityMatcher(filters({ regions: ["Provence-Alpes-Côte d'Azur", 'Pays-de-la-Loire'] }))
    expect(matcher(candidate({ region: 'Provence-Alpes-Côte d’Azur', locationLabel: null }))).toBe(true)
    expect(matcher(candidate({ region: null, locationLabel: 'Marseille, Provence Alpes Côte d’Azur' }))).toBe(true)
    expect(matcher(candidate({ region: 'Pays de la Loire', locationLabel: 'Nantes' }))).toBe(true)
    expect(matcher(candidate({ region: 'Occitanie', locationLabel: 'Toulouse' }))).toBe(false)
  })
  it('keeps keyword matching strict about hyphens', () => {
    const matcher = createOpportunityMatcher(filters({ includeKeywords: ['front end'] }))
    expect(matcher(candidate({ title: 'Développeur Front-end' }))).toBe(false)
    expect(matcher(candidate({ title: 'Développeur Front end' }))).toBe(true)
  })
  it('ignores blank regions instead of matching every location', () => {
    expect(createOpportunityMatcher(filters({ regions: ['bretagne', ' '] }))(candidate({ region: 'Occitanie', locationLabel: 'Toulouse' }))).toBe(false)
  })
})

describe('validateOpportunityFilters', () => {
  it('drops blank and duplicate keywords on validation', () => {
    const result = validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: ['  React ', 'react', '   ', ''] })
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ includeKeywords: ['React'] }) })
  })
  it('returns every cleaned field', () => {
    const result = validateOpportunityFilters({
      includeKeywords: ['react'],
      alwaysExcludeKeywords: [' stage '],
      rescuableExcludeKeywords: ['java', 'JAVA'],
      rescueKeywords: ['next.js'],
      rateFloorFullRemote: 400,
      rateFloorHybrid: null,
      rateFloorOnsite: 5000,
      regions: [' Île-de-France ', 'île-de-france', 'Bretagne'],
    })
    expect(result).toEqual({
      ok: true,
      data: {
        includeKeywords: ['react'],
        alwaysExcludeKeywords: ['stage'],
        rescuableExcludeKeywords: ['java'],
        rescueKeywords: ['next.js'],
        rateFloorFullRemote: 400,
        rateFloorHybrid: null,
        rateFloorOnsite: 5000,
        regions: ['Île-de-France', 'Bretagne'],
      },
    })
  })
  it.each([null, 'filters', ['react']])('rejects a malformed payload %p', (payload) => {
    expect(validateOpportunityFilters(payload)).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.malformedPayload })
  })
  it.each([undefined, 'react', [1], ['react', null]])('rejects a keyword list that is not a list of strings %p', (includeKeywords) => {
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidKeywords })
  })
  it('accepts 100 keywords per list but not 101', () => {
    const keywords = Array.from({ length: 101 }, (_, index) => `mot${index}`)
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, rescueKeywords: keywords.slice(0, 100) }).ok).toBe(true)
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, rescueKeywords: keywords })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.tooManyKeywords })
  })
  it('counts keywords after removing blanks and duplicates', () => {
    const keywords = [...Array.from({ length: 100 }, (_, index) => `mot${index}`), 'MOT0', '  ']
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, alwaysExcludeKeywords: keywords }).ok).toBe(true)
  })
  it('accepts a 60 character keyword but not 61', () => {
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: [` ${'a'.repeat(60)} `] }).ok).toBe(true)
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, includeKeywords: ['a'.repeat(61)] })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.keywordTooLong })
  })
  it.each([0, 5000, null])('accepts the rate floor %p', (rateFloorHybrid) => {
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, rateFloorHybrid }).ok).toBe(true)
  })
  it.each([-1, 5001, 450.5, '450', undefined, Number.NaN])('rejects the rate floor %p', (rateFloorFullRemote) => {
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, rateFloorFullRemote })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidRateFloor })
  })
  it('accepts 30 regions but not 31', () => {
    const regions = Array.from({ length: 31 }, (_, index) => `Région ${index}`)
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, regions: regions.slice(0, 30) }).ok).toBe(true)
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, regions })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.tooManyRegions })
  })
  it('rejects regions that are not a list of strings or too long', () => {
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, regions: [42] })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidRegions })
    expect(validateOpportunityFilters({ ...EMPTY_OPPORTUNITY_FILTERS, regions: ['a'.repeat(61)] })).toEqual({ ok: false, errorMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.regionTooLong })
  })
})

describe('hasActiveOpportunityFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveOpportunityFilters(EMPTY_OPPORTUNITY_FILTERS)).toBe(false)
  })

  it.each([
    filters({ includeKeywords: ['react'] }),
    filters({ rateFloorOnsite: 400 }),
    filters({ regions: ['Bretagne'] }),
  ])('is true when a filter is set (%p)', (activeFilters) => {
    expect(hasActiveOpportunityFilters(activeFilters)).toBe(true)
  })
})
