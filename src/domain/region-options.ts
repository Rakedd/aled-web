import { normalizeForKeywordMatch } from './opportunity-filters'

export const METROPOLITAN_FRENCH_REGIONS: readonly string[] = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
]

export const buildRegionOptions = (knownRegions: string[], selectedRegions: string[]): string[] => {
  const regionsByNormalizedName = new Map<string, string>()
  for (const region of [...METROPOLITAN_FRENCH_REGIONS, ...knownRegions, ...selectedRegions]) {
    const normalizedRegion = normalizeForKeywordMatch(region)
    if (normalizedRegion !== '' && !regionsByNormalizedName.has(normalizedRegion)) {
      regionsByNormalizedName.set(normalizedRegion, region)
    }
  }
  return [...regionsByNormalizedName.values()].sort((firstRegion, secondRegion) =>
    firstRegion.localeCompare(secondRegion, 'fr'),
  )
}
