import { useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import { validateIntermediaryKind } from '@/domain/entities'
import type { IntermediaryHeaderControllerParameters } from './interfaces'

export const useController = ({
  intermediaryId,
  updateIntermediaryKind,
  onDataChanged,
}: IntermediaryHeaderControllerParameters) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const changeKind = async (kindCandidate: string) => {
    const kindValidation = validateIntermediaryKind(kindCandidate)
    if (!kindValidation.ok) {
      setErrorMessage(kindValidation.errorMessage)
      return
    }
    setErrorMessage(null)
    setIsSaving(true)
    try {
      const updateResult = await updateIntermediaryKind(intermediaryId, kindValidation.data)
      if (updateResult.ok) onDataChanged()
      else setErrorMessage(updateResult.errorMessage)
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      setIsSaving(false)
    }
  }

  return { errorMessage, isSaving, changeKind }
}
