import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { formatSkillExtractionOutcome, mergeSkillLists, OPPORTUNITY_MATCH_MESSAGES } from '@/domain/opportunity-match'
import type { CvSkillsExtractorControllerParameters } from './interfaces'

export const useController = ({
  cvOptions,
  mySkills,
  extractSkillsFromCv,
  onSkillsExtracted,
}: CvSkillsExtractorControllerParameters) => {
  const [selectedCvId, setSelectedCvId] = useState(cvOptions[0]?.id ?? '')
  const [isExtracting, setIsExtracting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const isRequestInFlightRef = useRef(false)
  const latestMySkillsRef = useRef(mySkills)

  useEffect(() => {
    latestMySkillsRef.current = mySkills
  }, [mySkills])

  const selectCv = (cvId: string) => {
    setSelectedCvId(cvId)
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const extract = async () => {
    if (isRequestInFlightRef.current) return
    setErrorMessage(null)
    setStatusMessage(null)
    if (!cvOptions.some(({ id }) => id === selectedCvId)) {
      setErrorMessage(OPPORTUNITY_MATCH_MESSAGES.invalidCv)
      return
    }
    isRequestInFlightRef.current = true
    setIsExtracting(true)
    try {
      const extractionResult = await extractSkillsFromCv(selectedCvId)
      if (!extractionResult.ok) {
        setErrorMessage(extractionResult.errorMessage)
        return
      }
      const skillListMerge = mergeSkillLists(latestMySkillsRef.current, extractionResult.data)
      onSkillsExtracted(extractionResult.data)
      setStatusMessage(formatSkillExtractionOutcome(skillListMerge))
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
      setIsExtracting(false)
    }
  }

  return { selectedCvId, selectCv, isExtracting, errorMessage, statusMessage, extract }
}
