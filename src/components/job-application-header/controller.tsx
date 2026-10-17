import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  getNextPipelineStatus,
  getSuggestedKoStatuses,
  isTerminalStatus,
  type JobApplicationStatus,
} from '@/domain/job-application-status'
import type { JobApplicationHeaderControllerParameters } from './interfaces'

export const UNKNOWN_END_CLIENT_LABEL = 'Client inconnu'

export const useController = ({
  jobApplication,
  changeJobApplicationStatus,
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
    isChangingStatus,
    errorMessage,
    advance,
    changeStatus,
  }
}
