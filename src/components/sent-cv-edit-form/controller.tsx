import { useRef, useState } from 'react'
import { type ActionResult, guardActionCall } from '@/domain/action-result'
import {
  CV_FORM_FIELD_NAMES,
  buildDefaultTailoredCvLabel,
  CV_MESSAGES,
  validateCvLabel,
  validateCvPdfFile,
} from '@/domain/cv-library'
import type { SentCvEditFormProps, SentCvSource } from './interfaces'

export const useController = ({
  jobApplicationId,
  jobApplicationTitle,
  cvOptions,
  attachLibraryCvToJobApplication,
  uploadTailoredCvForJobApplication,
  detachSentCvFromJobApplication,
  onDataChanged,
  onClose,
}: Omit<SentCvEditFormProps, 'sentCv'>) => {
  const [source, setSourceState] = useState<SentCvSource>(cvOptions.length > 0 ? 'library' : 'tailored')
  const [selectedCvId, setSelectedCvId] = useState('')
  const [tailoredLabel, setTailoredLabel] = useState(() => buildDefaultTailoredCvLabel(jobApplicationTitle))
  const [tailoredPdfFile, setTailoredPdfFile] = useState<File | null>(null)
  const [isAddedToLibrary, setIsAddedToLibrary] = useState(false)
  const [libraryNoticeMessage, setLibraryNoticeMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isRequestInFlightRef = useRef(false)

  const setSource = (nextSource: SentCvSource) => {
    setSourceState(nextSource)
    setErrorMessage(null)
  }

  const selectTailoredPdfFile = (selectedFile: File | null) => {
    const pdfFileValidation = validateCvPdfFile(selectedFile)
    if (!pdfFileValidation.ok) {
      setTailoredPdfFile(null)
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    setTailoredPdfFile(selectedFile)
    setErrorMessage(null)
  }

  const runRequest = async <Data,>(sendRequest: () => Promise<ActionResult<Data>>): Promise<ActionResult<Data> | null> => {
    if (isRequestInFlightRef.current) return null
    isRequestInFlightRef.current = true
    setIsSaving(true)
    setErrorMessage(null)
    const requestResult = await guardActionCall(sendRequest)
    isRequestInFlightRef.current = false
    setIsSaving(false)
    if (!requestResult.ok) setErrorMessage(requestResult.errorMessage)
    return requestResult
  }

  const finishAndClose = () => {
    onDataChanged()
    onClose()
  }

  const saveLibraryCv = async () => {
    if (selectedCvId === '') {
      setErrorMessage(CV_MESSAGES.missingLibraryChoice)
      return
    }
    const attachmentResult = await runRequest(() => attachLibraryCvToJobApplication(jobApplicationId, selectedCvId))
    if (attachmentResult?.ok) finishAndClose()
  }

  const saveTailoredCv = async () => {
    const labelValidation = validateCvLabel(tailoredLabel)
    if (!labelValidation.ok) {
      setErrorMessage(labelValidation.errorMessage)
      return
    }
    const pdfFileValidation = validateCvPdfFile(tailoredPdfFile)
    if (!pdfFileValidation.ok) {
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    const formData = new FormData()
    formData.append(CV_FORM_FIELD_NAMES.label, labelValidation.data)
    formData.append(CV_FORM_FIELD_NAMES.pdf, pdfFileValidation.data)
    formData.append(CV_FORM_FIELD_NAMES.addToLibrary, String(isAddedToLibrary))
    const uploadResult = await runRequest(() => uploadTailoredCvForJobApplication(jobApplicationId, formData))
    if (!uploadResult?.ok) return
    if (uploadResult.data.libraryErrorMessage === null) {
      finishAndClose()
      return
    }
    setLibraryNoticeMessage(uploadResult.data.libraryErrorMessage)
    onDataChanged()
  }

  const save = () => (source === 'library' ? saveLibraryCv() : saveTailoredCv())

  const detach = async () => {
    const detachmentResult = await runRequest(() => detachSentCvFromJobApplication(jobApplicationId))
    if (detachmentResult?.ok) finishAndClose()
  }

  return {
    source,
    setSource,
    selectedCvId,
    setSelectedCvId,
    tailoredLabel,
    setTailoredLabel,
    tailoredPdfFile,
    selectTailoredPdfFile,
    isAddedToLibrary,
    setIsAddedToLibrary,
    libraryNoticeMessage,
    errorMessage,
    isSaving,
    save,
    detach,
  }
}
