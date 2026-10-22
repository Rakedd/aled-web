import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import { CV_FORM_FIELD_NAMES, validateCvLabel, validateCvPdfFile } from '@/domain/cv-library'
import type { AddCvFormControllerParameters } from './interfaces'

export const useController = ({ createCv, onCreated }: AddCvFormControllerParameters) => {
  const [label, setLabel] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmissionInFlightRef = useRef(false)

  const selectPdfFile = (selectedFile: File | null) => {
    const pdfFileValidation = validateCvPdfFile(selectedFile)
    if (!pdfFileValidation.ok) {
      setPdfFile(null)
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    setPdfFile(selectedFile)
    setErrorMessage(null)
  }

  const submit = async () => {
    if (isSubmissionInFlightRef.current) return
    const labelValidation = validateCvLabel(label)
    if (!labelValidation.ok) {
      setErrorMessage(labelValidation.errorMessage)
      return
    }
    const pdfFileValidation = validateCvPdfFile(pdfFile)
    if (!pdfFileValidation.ok) {
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    isSubmissionInFlightRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    const formData = new FormData()
    formData.append(CV_FORM_FIELD_NAMES.label, labelValidation.data)
    formData.append(CV_FORM_FIELD_NAMES.pdf, pdfFileValidation.data)
    const creationResult = await guardActionCall(() => createCv(formData))
    isSubmissionInFlightRef.current = false
    setIsSubmitting(false)
    if (!creationResult.ok) {
      setErrorMessage(creationResult.errorMessage)
      return
    }
    onCreated()
  }

  return { label, setLabel, pdfFile, selectPdfFile, errorMessage, isSubmitting, submit }
}
