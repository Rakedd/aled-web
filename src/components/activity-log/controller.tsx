import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  USER_LOGGABLE_ACTIVITY_KINDS,
  validateActivityLogEntryInput,
  type ActivityLogEntry,
} from '@/domain/activity-log'
import type { ActivityKind } from '@/domain/types'
import type { ActivityLogControllerParameters } from './interfaces'

type ReloadedEntries = { initialEntriesAtReload: ActivityLogEntry[]; entries: ActivityLogEntry[] }

export const useController = ({
  jobApplicationId,
  initialEntries,
  addActivityLogEntry,
  listActivityLogEntries,
  onDataChanged,
}: ActivityLogControllerParameters) => {
  const [kind, setKind] = useState<ActivityKind>('call')
  const [summary, setSummary] = useState('')
  const [reloadedEntries, setReloadedEntries] = useState<ReloadedEntries | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isAddInFlightRef = useRef(false)

  const entries =
    reloadedEntries !== null && reloadedEntries.initialEntriesAtReload === initialEntries
      ? reloadedEntries.entries
      : initialEntries

  const requestAdd = async (validatedKind: ActivityKind, validatedSummary: string) => {
    try {
      return await addActivityLogEntry(jobApplicationId, { kind: validatedKind, summary: validatedSummary })
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
    const validation = validateActivityLogEntryInput({ kind, summary })
    if (!validation.ok) {
      setErrorMessage(validation.errorMessage)
      return
    }
    isAddInFlightRef.current = true
    setIsAdding(true)
    const addResult = await requestAdd(validation.data.kind, validation.data.summary)
    if (addResult.ok) {
      setSummary('')
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
    entries,
    isAdding,
    errorMessage,
    addEntry,
  }
}
