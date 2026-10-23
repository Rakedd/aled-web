import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import type { ProfessionalStatus } from '@/domain/sign-up'
import type { ProfessionalStatusCardControllerParameters } from './interfaces'

export const useController = ({ saveProfessionalStatus }: ProfessionalStatusCardControllerParameters) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isRequestInFlightRef = useRef(false)

  const choose = async (professionalStatus: ProfessionalStatus) => {
    if (isRequestInFlightRef.current) return
    isRequestInFlightRef.current = true
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const saveResult = await saveProfessionalStatus(professionalStatus)
      if (saveResult.ok) setIsAnswered(true)
      else setErrorMessage(saveResult.errorMessage)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isRequestInFlightRef.current = false
      setIsSaving(false)
    }
  }

  return { isSaving, isAnswered, errorMessage, choose }
}
