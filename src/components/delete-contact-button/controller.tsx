import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { CONTACTS_ROUTE } from '@/domain/routes'
import type { DeleteContactButtonControllerParameters } from './interfaces'

const CONFIRM_LABEL = 'Supprimer'
const DELETING_LABEL = 'Suppression…'

export const useController = ({ contactId, deleteContact, navigate }: DeleteContactButtonControllerParameters) => {
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
    const deletionResult = await guardActionCall(() => deleteContact(contactId))
    if (deletionResult.ok) {
      navigate(CONTACTS_ROUTE)
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
