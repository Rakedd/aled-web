import { normalizeForKeywordMatch } from './opportunity-filters'
import { METROPOLITAN_FRENCH_REGIONS, buildRegionOptions } from './region-options'

describe('buildRegionOptions', () => {
  it('lists the 13 metropolitan regions when nothing else is known', () => {
    expect(METROPOLITAN_FRENCH_REGIONS).toHaveLength(13)
    expect(buildRegionOptions([], [])).toHaveLength(13)
  })

  it('dedupes accent and case variants against the static list', () => {
    const regionOptions = buildRegionOptions(['ile-de-france'], ['ÎLE-DE-FRANCE'])
    expect(regionOptions.filter((region) => normalizeForKeywordMatch(region) === normalizeForKeywordMatch('Île-de-France'))).toHaveLength(1)
    expect(regionOptions).toHaveLength(13)
  })

  it('dedupes apostrophe and hyphen variants against the static list', () => {
    const regionOptions = buildRegionOptions(['Provence-Alpes-Côte d’Azur', 'Pays-de-la-Loire'], ['Provence Alpes Côte d‘Azur'])
    expect(regionOptions).toHaveLength(13)
    expect(regionOptions).toContain("Provence-Alpes-Côte d'Azur")
    expect(regionOptions).toContain('Pays de la Loire')
  })

  it('keeps a selected or known region that is not in the static list', () => {
    const regionOptions = buildRegionOptions(['Belgique'], ['Suisse'])
    expect(regionOptions).toContain('Belgique')
    expect(regionOptions).toContain('Suisse')
    expect(regionOptions).toHaveLength(15)
  })

  it('sorts with the French collation', () => {
    const regionOptions = buildRegionOptions([], [])
    expect(regionOptions).toEqual([...regionOptions].sort((first, second) => first.localeCompare(second, 'fr')))
  })
})
