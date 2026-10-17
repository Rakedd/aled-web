import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import {
  JOB_SPEC_PDF_FORM_FIELD_NAME,
  NO_TECHNOLOGY_FOUND_MESSAGES,
  type JobSpecSaveOutcome,
  type JobSpecSourceKind,
  validateJobSpecPdfFile,
  validateJobSpecText,
} from '@/domain/job-spec'
import type { StackItem } from '@/domain/types'
import type { JobSpecSectionControllerParameters } from './interfaces'
import { openUrlInNewTab } from './open-url-in-new-tab'

export const useController = ({
  jobApplicationId,
  jobSpec,
  uploadJobSpecPdf,
  saveJobSpecText,
  confirmJobSpecStack,
  discardPendingJobSpecStack,
  getJobSpecDownloadUrl,
  onDataChanged,
}: JobSpecSectionControllerParameters) => {
  const [pastedText, setPastedText] = useState('')
  const [draftStack, setDraftStack] = useState<StackItem[] | null>(jobSpec?.pendingStack ?? null)
  const [noTechnologyFoundMessage, setNoTechnologyFoundMessage] = useState<string | null>(null)
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzingJobSpec, setIsAnalyzingJobSpec] = useState(false)
  const isRequestInFlightRef = useRef(false)

  const runExclusiveRequest = async <ResultData,>(
    request: () => Promise<ActionResult<ResultData>>,
  ): Promise<ActionResult<ResultData> | null> => {
    if (isRequestInFlightRef.current) return null
    isRequestInFlightRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      return await request()
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
    } finally {
      isRequestInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const showSaveOutcome = (sourceKind: JobSpecSourceKind, saveOutcome: JobSpecSaveOutcome) => {
    const hasFoundTechnologies = saveOutcome.pendingStack !== null && saveOutcome.pendingStack.length > 0
    setDraftStack(hasFoundTechnologies ? saveOutcome.pendingStack : null)
    setNoTechnologyFoundMessage(saveOutcome.pendingStack?.length === 0 ? NO_TECHNOLOGY_FOUND_MESSAGES[sourceKind] : null)
    setAiErrorMessage(saveOutcome.aiErrorMessage)
  }

  const submitJobSpec = async (
    sourceKind: JobSpecSourceKind,
    request: () => Promise<ActionResult<JobSpecSaveOutcome>>,
  ): Promise<boolean> => {
    setIsAnalyzingJobSpec(true)
    const saveResult = await runExclusiveRequest(request)
    setIsAnalyzingJobSpec(false)
    if (saveResult === null) return false
    if (!saveResult.ok) {
      setErrorMessage(saveResult.errorMessage)
      return false
    }
    showSaveOutcome(sourceKind, saveResult.data)
    onDataChanged()
    return true
  }

  const selectPdfFile = async (pdfFile: File | null | undefined) => {
    if (!pdfFile || isRequestInFlightRef.current) return
    const pdfFileValidation = validateJobSpecPdfFile(pdfFile)
    if (!pdfFileValidation.ok) {
      setErrorMessage(pdfFileValidation.errorMessage)
      return
    }
    const formData = new FormData()
    formData.append(JOB_SPEC_PDF_FORM_FIELD_NAME, pdfFile)
    await submitJobSpec('pdf', () => uploadJobSpecPdf(jobApplicationId, formData))
  }

  const saveText = async () => {
    if (isRequestInFlightRef.current) return
    const textValidation = validateJobSpecText(pastedText)
    if (!textValidation.ok) {
      setErrorMessage(textValidation.errorMessage)
      return
    }
    const isSaved = await submitJobSpec('text', () => saveJobSpecText(jobApplicationId, textValidation.data))
    if (isSaved) setPastedText('')
  }

  const resolveDraftStack = async (request: () => Promise<ActionResult<null>>) => {
    const resolutionResult = await runExclusiveRequest(request)
    if (resolutionResult === null) return
    if (!resolutionResult.ok) {
      setErrorMessage(resolutionResult.errorMessage)
      return
    }
    setDraftStack(null)
    onDataChanged()
  }

  const confirmDraftStack = async () => {
    if (draftStack === null) return
    await resolveDraftStack(() => confirmJobSpecStack(jobApplicationId, draftStack))
  }

  const discardDraftStack = () => resolveDraftStack(() => discardPendingJobSpecStack(jobApplicationId))

  const openPdf = async () => {
    const downloadUrlResult = await runExclusiveRequest(() => getJobSpecDownloadUrl(jobApplicationId))
    if (downloadUrlResult === null) return
    if (!downloadUrlResult.ok) {
      setErrorMessage(downloadUrlResult.errorMessage)
      return
    }
    openUrlInNewTab(downloadUrlResult.data)
  }

  return {
    pastedText,
    setPastedText,
    draftStack,
    setDraftStack,
    noTechnologyFoundMessage,
    aiErrorMessage,
    errorMessage,
    isSubmitting,
    isAnalyzingJobSpec,
    selectPdfFile,
    saveText,
    confirmDraftStack,
    discardDraftStack,
    openPdf,
  }
}
