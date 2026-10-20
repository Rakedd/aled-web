import type { ActionResult } from './action-result'
import { normalizeEntityName } from './entity-names'
import { isRecord, rejectWith } from './input-validation'
import { type Opportunity, type RemoteMode, getOpportunityEffectiveRate } from './opportunities'

export type OpportunityFilters = {
  includeKeywords: string[]
  alwaysExcludeKeywords: string[]
  rescuableExcludeKeywords: string[]
  rescueKeywords: string[]
  rateFloorFullRemote: number | null
  rateFloorHybrid: number | null
  rateFloorOnsite: number | null
  regions: string[]
}

export const EMPTY_OPPORTUNITY_FILTERS: OpportunityFilters = {
  includeKeywords: [],
  alwaysExcludeKeywords: [],
  rescuableExcludeKeywords: [],
  rescueKeywords: [],
  rateFloorFullRemote: null,
  rateFloorHybrid: null,
  rateFloorOnsite: null,
  regions: [],
}

export type OpportunityMatchCandidate = Pick<
  Opportunity,
  'title' | 'rateMin' | 'rateMax' | 'remoteMode' | 'region' | 'locationLabel'
>

export const OPPORTUNITY_FILTERS_VALIDATION_MESSAGES = {
  malformedPayload: 'Filtres invalides',
  invalidKeywords: 'Mots-clés invalides',
  tooManyKeywords: '100 mots-clés maximum par liste',
  keywordTooLong: 'Un mot-clé fait plus de 60 caractères',
  invalidRateFloor: 'Le TJM minimum doit être un entier entre 0 et 5000',
  invalidRegions: 'Régions invalides',
  tooManyRegions: '30 régions maximum',
  regionTooLong: 'Une région fait plus de 60 caractères',
} as const

const MAXIMUM_KEYWORD_COUNT = 100
const MAXIMUM_REGION_COUNT = 30
const MAXIMUM_TERM_LENGTH = 60
const MAXIMUM_RATE_FLOOR = 5000
const REGULAR_EXPRESSION_METACHARACTER_PATTERN = /[.*+?^${}()|[\]\\]/g
const APOSTROPHE_VARIANT_PATTERN = /[\u2018\u2019\u02BC]/g
const REGION_SEPARATOR_SEQUENCE_PATTERN = /[\s-]+/g

type KeywordListField = 'includeKeywords' | 'alwaysExcludeKeywords' | 'rescuableExcludeKeywords' | 'rescueKeywords'
type RateFloorField = 'rateFloorFullRemote' | 'rateFloorHybrid' | 'rateFloorOnsite'

const KEYWORD_LIST_FIELDS: readonly KeywordListField[] = [
  'includeKeywords',
  'alwaysExcludeKeywords',
  'rescuableExcludeKeywords',
  'rescueKeywords',
]
const RATE_FLOOR_FIELDS: readonly RateFloorField[] = ['rateFloorFullRemote', 'rateFloorHybrid', 'rateFloorOnsite']

const RATE_FLOOR_FIELD_BY_REMOTE_MODE: Record<RemoteMode, RateFloorField> = {
  full: 'rateFloorFullRemote',
  partial: 'rateFloorHybrid',
  none: 'rateFloorOnsite',
}

type TermListRules = {
  maximumCount: number
  malformedMessage: string
  tooManyMessage: string
  tooLongMessage: string
}

const KEYWORD_LIST_RULES: TermListRules = {
  maximumCount: MAXIMUM_KEYWORD_COUNT,
  malformedMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidKeywords,
  tooManyMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.tooManyKeywords,
  tooLongMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.keywordTooLong,
}

const REGION_LIST_RULES: TermListRules = {
  maximumCount: MAXIMUM_REGION_COUNT,
  malformedMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidRegions,
  tooManyMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.tooManyRegions,
  tooLongMessage: OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.regionTooLong,
}

export const normalizeForKeywordMatch = (text: string): string => normalizeEntityName(text)

export const normalizeRegionName = (region: string): string =>
  normalizeForKeywordMatch(region)
    .replace(APOSTROPHE_VARIANT_PATTERN, "'")
    .replace(REGION_SEPARATOR_SEQUENCE_PATTERN, ' ')
    .trim()

const escapeRegularExpression = (text: string): string => text.replace(REGULAR_EXPRESSION_METACHARACTER_PATTERN, '\\$&')

const buildWholeWordPattern = (normalizedKeyword: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\d])${escapeRegularExpression(normalizedKeyword)}(?![\\p{L}\\d])`, 'u')

const hasMeaningfulKeyword = (keywords: string[]): boolean =>
  keywords.some((keyword) => normalizeForKeywordMatch(keyword) !== '')

export const buildKeywordMatcher = (keywords: string[]): ((normalizedText: string) => string) => {
  const keywordPatterns = keywords
    .map((keyword) => ({ keyword, normalizedKeyword: normalizeForKeywordMatch(keyword) }))
    .filter(({ normalizedKeyword }) => normalizedKeyword !== '')
    .map(({ keyword, normalizedKeyword }) => ({ keyword, pattern: buildWholeWordPattern(normalizedKeyword) }))
  return (normalizedText) => keywordPatterns.find(({ pattern }) => pattern.test(normalizedText))?.keyword ?? ''
}

const resolveRateFloor = (filters: OpportunityFilters, remoteMode: RemoteMode | null): number | null => {
  if (remoteMode !== null) return filters[RATE_FLOOR_FIELD_BY_REMOTE_MODE[remoteMode]]
  const definedRateFloors = RATE_FLOOR_FIELDS.map((rateFloorField) => filters[rateFloorField]).filter(
    (rateFloor): rateFloor is number => rateFloor !== null,
  )
  return definedRateFloors.length === 0 ? null : Math.max(...definedRateFloors)
}

const passesRateFloor = (candidate: OpportunityMatchCandidate, filters: OpportunityFilters): boolean => {
  const effectiveRate = getOpportunityEffectiveRate(candidate)
  const rateFloor = resolveRateFloor(filters, candidate.remoteMode)
  return effectiveRate === null || rateFloor === null || effectiveRate >= rateFloor
}

const isInWantedRegion = (candidate: OpportunityMatchCandidate, normalizedWantedRegions: string[]): boolean => {
  if (normalizedWantedRegions.length === 0 || candidate.remoteMode === 'full') return true
  const normalizedRegion = normalizeRegionName(candidate.region ?? '')
  const normalizedLocationLabel = normalizeRegionName(candidate.locationLabel ?? '')
  if (normalizedRegion === '' && normalizedLocationLabel === '') return true
  return normalizedWantedRegions.some(
    (normalizedWantedRegion) =>
      normalizedWantedRegion === normalizedRegion || normalizedLocationLabel.includes(normalizedWantedRegion),
  )
}

export const createOpportunityMatcher = (
  filters: OpportunityFilters,
): ((candidate: OpportunityMatchCandidate) => boolean) => {
  const hasIncludeKeywords = hasMeaningfulKeyword(filters.includeKeywords)
  const findIncludeKeyword = buildKeywordMatcher(filters.includeKeywords)
  const findAlwaysExcludeKeyword = buildKeywordMatcher(filters.alwaysExcludeKeywords)
  const findRescuableExcludeKeyword = buildKeywordMatcher(filters.rescuableExcludeKeywords)
  const findRescueKeyword = buildKeywordMatcher(filters.rescueKeywords)
  const normalizedWantedRegions = filters.regions
    .map(normalizeRegionName)
    .filter((normalizedWantedRegion) => normalizedWantedRegion !== '')

  return (candidate) => {
    const normalizedTitle = normalizeForKeywordMatch(candidate.title)
    if (hasIncludeKeywords && !findIncludeKeyword(normalizedTitle)) return false
    if (findAlwaysExcludeKeyword(normalizedTitle)) return false
    if (findRescuableExcludeKeyword(normalizedTitle) && !findRescueKeyword(normalizedTitle)) return false
    if (!passesRateFloor(candidate, filters)) return false
    return isInWantedRegion(candidate, normalizedWantedRegions)
  }
}

const isStringList = (candidate: unknown): candidate is string[] =>
  Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')

const removeBlankAndDuplicateTerms = (terms: string[]): string[] => {
  const seenLowercaseTerms = new Set<string>()
  const cleanedTerms: string[] = []
  for (const term of terms) {
    const trimmedTerm = term.trim()
    const lowercaseTerm = trimmedTerm.toLowerCase()
    if (trimmedTerm === '' || seenLowercaseTerms.has(lowercaseTerm)) continue
    seenLowercaseTerms.add(lowercaseTerm)
    cleanedTerms.push(trimmedTerm)
  }
  return cleanedTerms
}

const validateTermList = (candidate: unknown, termListRules: TermListRules): ActionResult<string[]> => {
  if (!isStringList(candidate)) return rejectWith(termListRules.malformedMessage)
  const cleanedTerms = removeBlankAndDuplicateTerms(candidate)
  if (cleanedTerms.length > termListRules.maximumCount) return rejectWith(termListRules.tooManyMessage)
  if (cleanedTerms.some((term) => term.length > MAXIMUM_TERM_LENGTH)) return rejectWith(termListRules.tooLongMessage)
  return { ok: true, data: cleanedTerms }
}

const isValidRateFloor = (candidate: unknown): candidate is number | null =>
  candidate === null ||
  (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0 && candidate <= MAXIMUM_RATE_FLOOR)

export const validateOpportunityFilters = (candidate: unknown): ActionResult<OpportunityFilters> => {
  if (!isRecord(candidate)) return rejectWith(OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.malformedPayload)
  const validatedFilters: OpportunityFilters = { ...EMPTY_OPPORTUNITY_FILTERS }
  for (const keywordListField of KEYWORD_LIST_FIELDS) {
    const keywordListValidation = validateTermList(candidate[keywordListField], KEYWORD_LIST_RULES)
    if (!keywordListValidation.ok) return keywordListValidation
    validatedFilters[keywordListField] = keywordListValidation.data
  }
  for (const rateFloorField of RATE_FLOOR_FIELDS) {
    const rateFloor = candidate[rateFloorField]
    if (!isValidRateFloor(rateFloor)) return rejectWith(OPPORTUNITY_FILTERS_VALIDATION_MESSAGES.invalidRateFloor)
    validatedFilters[rateFloorField] = rateFloor
  }
  const regionsValidation = validateTermList(candidate.regions, REGION_LIST_RULES)
  if (!regionsValidation.ok) return regionsValidation
  validatedFilters.regions = regionsValidation.data
  return { ok: true, data: validatedFilters }
}

export const hasActiveOpportunityFilters = (filters: OpportunityFilters): boolean =>
  filters.includeKeywords.length > 0 ||
  filters.alwaysExcludeKeywords.length > 0 ||
  filters.rescuableExcludeKeywords.length > 0 ||
  filters.rescueKeywords.length > 0 ||
  filters.rateFloorFullRemote !== null ||
  filters.rateFloorHybrid !== null ||
  filters.rateFloorOnsite !== null ||
  filters.regions.length > 0
