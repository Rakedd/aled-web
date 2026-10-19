import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { JOB_APPLICATION_DELETED_ROUTE } from '@/domain/routes'
import type { DeleteJobApplicationButtonControllerParameters } from './interfaces'

const CONFIRM_LABEL = 'Supprimer'
const DELETING_LABEL = 'Suppression…'

export const useController = ({
  jobApplicationId,
  deleteJobApplication,
  navigate,
}: DeleteJobApplicationButtonControllerParameters) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isDeletionInFlightRef = useRef(false)

  const openConfirmation = () => {
    setErrorMessage(null)
    setIsConfirmationOpen(true)
  }

  const closeConfirmation = () => {
    if (isDeletionInFlightRef.current) return
    setIsConfirmationOpen(false)
  }

  const confirmDeletion = async () => {
    if (isDeletionInFlightRef.current) return
    isDeletionInFlightRef.current = true
    setIsDeleting(true)
    setErrorMessage(null)
    const deletionResult = await guardActionCall(() => deleteJobApplication(jobApplicationId))
    if (deletionResult.ok) {
      navigate(JOB_APPLICATION_DELETED_ROUTE)
      return
    }
    isDeletionInFlightRef.current = false
    setIsDeleting(false)
    setErrorMessage(deletionResult.errorMessage)
  }

  return {
    isConfirmationOpen,
    openConfirmation,
    closeConfirmation,
    confirmDeletion,
    isDeleting,
    confirmLabel: isDeleting ? DELETING_LABEL : CONFIRM_LABEL,
    errorMessage,
  }
}
