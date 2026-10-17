import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  USER_LOGGABLE_ACTIVITY_KINDS,
  validateActivityLogEntryInput,
  type ActivityLogEntry,
  type ActivityLogEntryInput,
} from '@/domain/activity-log'
import { formatParisLocalDateTime, parisLocalDateTimeToUtc } from '@/domain/paris-time'
import type { ActivityKind } from '@/domain/types'
import type { ActivityLogControllerParameters } from './interfaces'

type ReloadedEntries = { initialEntriesAtReload: ActivityLogEntry[]; entries: ActivityLogEntry[] }

export const useController = ({
  jobApplicationId,
  initialEntries,
  addActivityLogEntry,
  listActivityLogEntries,
  now,
  onDataChanged,
}: ActivityLogControllerParameters) => {
  const [kind, setKind] = useState<ActivityKind>('call')
  const [summary, setSummary] = useState('')
  const [occurredAtLocalDateTime, setOccurredAtLocalDateTimeValue] = useState(() => formatParisLocalDateTime(now))
  const [hasEditedOccurredAt, setHasEditedOccurredAt] = useState(false)
  const [reloadedEntries, setReloadedEntries] = useState<ReloadedEntries | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isAddInFlightRef = useRef(false)

  const entries =
    reloadedEntries !== null && reloadedEntries.initialEntriesAtReload === initialEntries
      ? reloadedEntries.entries
      : initialEntries

  const setOccurredAtLocalDateTime = (editedOccurredAtLocalDateTime: string) => {
    setOccurredAtLocalDateTimeValue(editedOccurredAtLocalDateTime)
    setHasEditedOccurredAt(true)
  }

  const resetOccurredAtToNow = () => {
    setOccurredAtLocalDateTimeValue(formatParisLocalDateTime(new Date()))
    setHasEditedOccurredAt(false)
  }

  const requestAdd = async (validatedInput: ActivityLogEntryInput) => {
    try {
      return await addActivityLogEntry(jobApplicationId, validatedInput)
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE } as const
    }
  }

  const reloadEntries = async () => {
    try {
      const listResult = await listActivityLogEntries(jobApplicationId)
      if (listResult.ok) setReloadedEntries({ initialEntriesAtReload: initialEntries, entries: listResult.data })
    } catch {
      return
    }
  }

  const addEntry = async () => {
    if (isAddInFlightRef.current) return
    setErrorMessage(null)
    const validation = validateActivityLogEntryInput(
      {
        kind,
        summary,
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
    const addResult = await requestAdd(validation.data)
    if (addResult.ok) {
      setSummary('')
      resetOccurredAtToNow()
      await reloadEntries()
    } else {
      setErrorMessage(addResult.errorMessage)
    }
    isAddInFlightRef.current = false
    setIsAdding(false)
    if (addResult.ok) onDataChanged()
  }

  return {
    kind,
    setKind,
    kindOptions: USER_LOGGABLE_ACTIVITY_KINDS,
    summary,
    setSummary,
    occurredAtLocalDateTime,
    setOccurredAtLocalDateTime,
    entries,
    isAdding,
    errorMessage,
    addEntry,
  }
}
