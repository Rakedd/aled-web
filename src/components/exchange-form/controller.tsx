import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { USER_LOGGABLE_ACTIVITY_KINDS } from '@/domain/activity-log'
import { validateContactExchangeInput } from '@/domain/contacts'
import { formatParisLocalDateTime, parisLocalDateTimeToUtc } from '@/domain/paris-time'
import type { ActivityKind } from '@/domain/types'
import type { ExchangeFormControllerParameters } from './interfaces'

export const useController = ({
  contactId,
  addContactExchange,
  now,
  onDataChanged,
}: ExchangeFormControllerParameters) => {
  const [kind, setKind] = useState<ActivityKind>('call')
  const [summary, setSummary] = useState('')
  const [jobApplicationId, setJobApplicationId] = useState('')
  const [occurredAtLocalDateTime, setOccurredAtLocalDateTimeValue] = useState(() => formatParisLocalDateTime(now))
  const [hasEditedOccurredAt, setHasEditedOccurredAt] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isAddInFlightRef = useRef(false)

  const setOccurredAtLocalDateTime = (editedOccurredAtLocalDateTime: string) => {
    setOccurredAtLocalDateTimeValue(editedOccurredAtLocalDateTime)
    setHasEditedOccurredAt(true)
  }

  const resetForm = () => {
    setKind('call')
    setSummary('')
    setJobApplicationId('')
    setOccurredAtLocalDateTimeValue(formatParisLocalDateTime(new Date()))
    setHasEditedOccurredAt(false)
  }

  const addExchange = async () => {
    if (isAddInFlightRef.current) return
    setErrorMessage(null)
    const validation = validateContactExchangeInput(
      {
        kind,
        summary,
        jobApplicationId: jobApplicationId === '' ? null : jobApplicationId,
        ...(hasEditedOccurredAt ? { occurredAt: parisLocalDateTimeToUtc(occurredAtLocalDateTime) } : {}),
      },
      new Date(),
    )
    if (!validation.ok) {
      setErrorMessage(validation.errorMessage)
      return
    }
    isAddInFlightRef.current = true
    setIsAdding(true)
    const addResult = await guardActionCall(() => addContactExchange(contactId, validation.data))
    isAddInFlightRef.current = false
    setIsAdding(false)
    if (!addResult.ok) {
      setErrorMessage(addResult.errorMessage)
      return
    }
    resetForm()
    onDataChanged()
  }

  return {
    kind,
    setKind,
    kindOptions: USER_LOGGABLE_ACTIVITY_KINDS,
    summary,
    setSummary,
    jobApplicationId,
    setJobApplicationId,
    occurredAtLocalDateTime,
    setOccurredAtLocalDateTime,
    isAdding,
    errorMessage,
    addExchange,
  }
}
