import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  normalizeRegionName,
  type OpportunityFilters,
  validateOpportunityFilters,
} from '@/domain/opportunity-filters'
import type {
  KeywordListField,
  OpportunityFiltersFormControllerParameters,
  RateFloorErrors,
  RateFloorField,
  RateFloorTexts,
} from './interfaces'

export const INVALID_AMOUNT_MESSAGE = 'Montant invalide'
export const OPPORTUNITY_FILTERS_SAVED_MESSAGE = 'Filtres enregistrés'

const WHOLE_NUMBER_PATTERN = /^\d+$/
const AMOUNT_DECORATION_PATTERN = /[\s\u00a0\u202f€]/g
const RATE_FLOOR_FIELDS: readonly RateFloorField[] = ['rateFloorFullRemote', 'rateFloorHybrid', 'rateFloorOnsite']

const toRateFloorTexts = (filters: OpportunityFilters): RateFloorTexts => ({
  rateFloorFullRemote: filters.rateFloorFullRemote === null ? '' : String(filters.rateFloorFullRemote),
  rateFloorHybrid: filters.rateFloorHybrid === null ? '' : String(filters.rateFloorHybrid),
  rateFloorOnsite: filters.rateFloorOnsite === null ? '' : String(filters.rateFloorOnsite),
})

const parseRateFloorText = (rateFloorText: string): number | null | undefined => {
  const trimmedText = rateFloorText.replace(AMOUNT_DECORATION_PATTERN, '')
  if (trimmedText === '') return null
  return WHOLE_NUMBER_PATTERN.test(trimmedText) ? Number(trimmedText) : undefined
}

export const useController = ({
  source,
  initialFilters,
  saveOpportunityFilters,
  onDataChanged,
}: OpportunityFiltersFormControllerParameters) => {
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters)
  const [rateFloorTexts, setRateFloorTexts] = useState<RateFloorTexts>(() => toRateFloorTexts(initialFilters))
  const [rateFloorErrors, setRateFloorErrors] = useState<RateFloorErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const isRequestInFlightRef = useRef(false)

  const setKeywordList = (keywordListField: KeywordListField, keywords: string[]) =>
    setFilters((currentFilters) => ({
      ...currentFilters,
      [keywordListField]: keywords,
    }))

  const toggleRegion = (region: string) =>
    setFilters((currentFilters) => {
      const normalizedRegion = normalizeRegionName(region)
      const isSelected = currentFilters.regions.some(
        (selectedRegion) => normalizeRegionName(selectedRegion) === normalizedRegion,
      )
      return {
        ...currentFilters,
        regions: isSelected
          ? currentFilters.regions.filter((selectedRegion) => normalizeRegionName(selectedRegion) !== normalizedRegion)
          : [...currentFilters.regions, region],
      }
    })

  const setRateFloorText = (rateFloorField: RateFloorField, rateFloorText: string) => {
    setRateFloorTexts((currentTexts) => ({ ...currentTexts, [rateFloorField]: rateFloorText }))
    setRateFloorErrors((currentErrors) => ({ ...currentErrors, [rateFloorField]: undefined }))
  }

  const submit = async () => {
    if (isRequestInFlightRef.current) return
    setErrorMessage(null)
    setSuccessMessage(null)
    const parsedRateFloors = RATE_FLOOR_FIELDS.map((rateFloorField) => ({
      rateFloorField,
      rateFloor: parseRateFloorText(rateFloorTexts[rateFloorField]),
    }))
    const invalidRateFloorFields = parsedRateFloors.filter(({ rateFloor }) => rateFloor === undefined)
    setRateFloorErrors(
      Object.fromEntries(invalidRateFloorFields.map(({ rateFloorField }) => [rateFloorField, INVALID_AMOUNT_MESSAGE])),
    )
    if (invalidRateFloorFields.length > 0) return
    const validationResult = validateOpportunityFilters({
      ...filters,
      ...Object.fromEntries(parsedRateFloors.map(({ rateFloorField, rateFloor }) => [rateFloorField, rateFloor])),
    })
    if (!validationResult.ok) {
      setErrorMessage(validationResult.errorMessage)
      return
    }
    isRequestInFlightRef.current = true
    setIsSubmitting(true)
    try {
      const saveResult = await saveOpportunityFilters(source, validationResult.data)
      if (!saveResult.ok) {
        setErrorMessage(saveResult.errorMessage)
        return
      }
      setFilters(saveResult.data)
      setRateFloorTexts(toRateFloorTexts(saveResult.data))
      setSuccessMessage(OPPORTUNITY_FILTERS_SAVED_MESSAGE)
      onDataChanged()
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  return {
    filters,
    setKeywordList,
    toggleRegion,
    rateFloorTexts,
    rateFloorErrors,
    setRateFloorText,
    isSubmitting,
    errorMessage,
    successMessage,
    submit,
  }
}
