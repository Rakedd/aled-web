import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  getNextPipelineStatus,
  getSuggestedKoStatuses,
  isTerminalStatus,
  type JobApplicationStatus,
} from '@/domain/job-application-status'
import { formatParisDate, formatRelativeDaysAgo } from '@/domain/paris-time'
import type { JobApplicationHeaderControllerParameters } from './interfaces'

export const UNKNOWN_END_CLIENT_LABEL = 'Client inconnu'
export const MISSING_VALUE_LABEL = '—'

export const useController = ({
  jobApplication,
  changeJobApplicationStatus,
  now,
  onDataChanged,
}: JobApplicationHeaderControllerParameters) => {
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isChangeInFlightRef = useRef(false)

  const nextStatus = isTerminalStatus(jobApplication.status) ? null : getNextPipelineStatus(jobApplication.status)

  const requestStatusChange = async (newStatus: JobApplicationStatus) => {
    try {
      return await changeJobApplicationStatus(jobApplication.id, newStatus)
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE } as const
    }
  }

  const changeStatus = async (newStatus: JobApplicationStatus) => {
    if (isChangeInFlightRef.current) return
    isChangeInFlightRef.current = true
    setErrorMessage(null)
    setIsChangingStatus(true)
    const changeResult = await requestStatusChange(newStatus)
    isChangeInFlightRef.current = false
    setIsChangingStatus(false)
    if (!changeResult.ok) {
      setErrorMessage(changeResult.errorMessage)
      return
    }
    onDataChanged()
  }

  const advance = async () => {
    if (nextStatus === null) return
    await changeStatus(nextStatus)
  }

  return {
    nextStatus,
    koOptions: getSuggestedKoStatuses(jobApplication.status),
    endClientDisplayName: jobApplication.endClientLabel ?? UNKNOWN_END_CLIENT_LABEL,
    sourceDisplay: jobApplication.source ?? MISSING_VALUE_LABEL,
    appliedOnDisplay: formatParisDate(jobApplication.appliedOn),
    lastActivityDisplay:
      jobApplication.lastActivityAt === null
        ? MISSING_VALUE_LABEL
        : formatRelativeDaysAgo(jobApplication.lastActivityAt, now),
    isChangingStatus,
    errorMessage,
    advance,
    changeStatus,
  }
}
