import { useRef, useState } from 'react'
import { type ActionResult, guardActionCall } from '@/domain/action-result'
import { CV_FORM_FIELD_NAMES, validateCvLabel, validateCvPdfFile } from '@/domain/cv-library'
import type { CvCardControllerParameters } from './interfaces'

export const useController = ({ cv, replaceCvFile, renameCv, deleteCv, onDataChanged }: CvCardControllerParameters) => {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftLabel, setDraftLabel] = useState(cv.label)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isActionInFlightRef = useRef(false)

  const runAction = async (actionCall: () => Promise<ActionResult<null>>): Promise<boolean> => {
    if (isActionInFlightRef.current) return false
    isActionInFlightRef.current = true
    setIsPending(true)
    setErrorMessage(null)
    const actionResult = await guardActionCall(actionCall)
    isActionInFlightRef.current = false
    setIsPending(false)
    if (!actionResult.ok) {
      setErrorMessage(actionResult.errorMessage)
      return false
    }
    onDataChanged()
    return true
  }

  const startRenaming = () => {
    setDraftLabel(cv.label)
    setErrorMessage(null)
    setIsRenaming(true)
  }

  const cancelRenaming = () => {
    setErrorMessage(null)
    setIsRenaming(false)
  }

  const saveLabel = async () => {
    const labelValidation = validateCvLabel(draftLabel)
    if (!labelValidation.ok) {
      setErrorMessage(labelValidation.errorMessage)
      return
    }
    const hasSucceeded = await runAction(() => renameCv(cv.id, labelValidation.data))
    if (hasSucceeded) setIsRenaming(false)
  }

  const replaceWithFile = async (selectedFile: File | null) => {
    const pdfFileValidation = validateCvPdfFile(selectedFile)
    if (!pdfFileValidation.ok) {
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    const formData = new FormData()
    formData.append(CV_FORM_FIELD_NAMES.pdf, pdfFileValidation.data)
    await runAction(() => replaceCvFile(cv.id, formData))
  }

  const confirmDeletion = async () => {
    await runAction(() => deleteCv(cv.id))
    setIsDeleteDialogOpen(false)
  }

  return {
    isRenaming,
    startRenaming,
    cancelRenaming,
    draftLabel,
    setDraftLabel,
    saveLabel,
    replaceWithFile,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    confirmDeletion,
    isPending,
    errorMessage,
  }
}
