'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  CV_FORM_FIELD_NAMES,
  CV_MESSAGES,
  type CvLibraryItem,
  isCvLibraryFull,
  readCvFileName,
  type TailoredCvUploadOutcome,
  validateCvLabel,
  validateCvPdfFile,
} from '@/domain/cv-library'
import { rejectWith, validateUuid } from '@/domain/input-validation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE, validateJobApplicationId } from '@/domain/job-application'
import { hasPdfSignature } from '@/domain/job-spec'
import {
  countCvs,
  createCvFromVersion,
  deleteCvRow,
  findCvRow,
  listCvLibraryItems,
  markCvReviewed,
  renameCvRow,
  replaceCvCurrentVersion,
  setSentCvVersion,
  storeCvVersion,
} from '@/server/repositories/cvs-repository'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { releaseCvVersionsWithoutFailing } from './release-cv-versions-without-failing'
import { NO_ARGUMENTS, runAuthenticatedOperation } from './run-authenticated-operation'

const CV_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes CV pour le moment. Réessaie dans quelques minutes.'
const CV_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer le CV pour le moment. Réessaie dans quelques minutes."
const CV_DELETE_FAILURE_MESSAGE = 'Impossible de supprimer le CV pour le moment. Réessaie dans quelques minutes.'

type ValidatedCvUpload = { label: string; pdfFile: Blob }

const validateCvPdfFromFormData = (formData: unknown): ActionResult<Blob> => {
  if (!(formData instanceof FormData)) return rejectWith(CV_MESSAGES.missingPdf)
  return validateCvPdfFile(formData.get(CV_FORM_FIELD_NAMES.pdf))
}

const validateCvUploadFormData = (formData: unknown): ActionResult<ValidatedCvUpload> => {
  if (!(formData instanceof FormData)) return rejectWith(CV_MESSAGES.missingPdf)
  const labelValidation = validateCvLabel(formData.get(CV_FORM_FIELD_NAMES.label))
  if (!labelValidation.ok) return labelValidation
  const pdfFileValidation = validateCvPdfFile(formData.get(CV_FORM_FIELD_NAMES.pdf))
  if (!pdfFileValidation.ok) return pdfFileValidation
  return { ok: true, data: { label: labelValidation.data, pdfFile: pdfFileValidation.data } }
}

const readPdfBytes = async (pdfFile: Blob): Promise<ActionResult<Uint8Array>> => {
  const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer())
  if (!hasPdfSignature(pdfBytes)) return rejectWith(CV_MESSAGES.invalidPdf)
  return { ok: true, data: pdfBytes }
}

const runStepOrReleaseStoredVersion = async <StepData>(
  supabase: FreeclutchSupabaseClient,
  storedVersionId: string,
  step: () => Promise<ActionResult<StepData>>,
): Promise<ActionResult<StepData>> => {
  try {
    const stepResult = await step()
    if (!stepResult.ok) {
      await releaseCvVersionsWithoutFailing(supabase, [storedVersionId], 'Cv version release failed after a refused step')
    }
    return stepResult
  } catch (stepError) {
    await releaseCvVersionsWithoutFailing(supabase, [storedVersionId], 'Cv version release failed after a failed step')
    throw stepError
  }
}

const createCvFromPdf = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvUpload: ValidatedCvUpload,
): Promise<ActionResult<{ id: string }>> => {
  const pdfBytesResult = await readPdfBytes(cvUpload.pdfFile)
  if (!pdfBytesResult.ok) return pdfBytesResult
  const cvCount = await countCvs(supabase, userId)
  if (isCvLibraryFull(cvCount)) return rejectWith(CV_MESSAGES.libraryFull)
  const storedVersionId = await storeCvVersion(supabase, userId, {
    cvId: null,
    label: cvUpload.label,
    pdfBytes: pdfBytesResult.data,
    fileName: readCvFileName(cvUpload.pdfFile),
  })
  return runStepOrReleaseStoredVersion(supabase, storedVersionId, () =>
    createCvFromVersion(supabase, userId, cvUpload.label, storedVersionId),
  )
}

const replaceCvPdf = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
  pdfFile: Blob,
): Promise<ActionResult<null>> => {
  const pdfBytesResult = await readPdfBytes(pdfFile)
  if (!pdfBytesResult.ok) return pdfBytesResult
  const cvRowResult = await findCvRow(supabase, userId, cvId)
  if (!cvRowResult.ok) return cvRowResult
  const storedVersionId = await storeCvVersion(supabase, userId, {
    cvId,
    label: cvRowResult.data.label,
    pdfBytes: pdfBytesResult.data,
    fileName: readCvFileName(pdfFile),
  })
  const replacementResult = await runStepOrReleaseStoredVersion(supabase, storedVersionId, () =>
    replaceCvCurrentVersion(supabase, userId, cvId, storedVersionId),
  )
  if (!replacementResult.ok) return replacementResult
  await releaseCvVersionsWithoutFailing(
    supabase,
    [replacementResult.data.previousVersionId],
    'Cv version release failed after cv replacement',
  )
  return { ok: true, data: null }
}

const changeSentCvVersion = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  versionId: string | null,
): Promise<ActionResult<null>> => {
  const changeResult = await setSentCvVersion(supabase, userId, jobApplicationId, versionId)
  if (!changeResult.ok) return changeResult
  await releaseCvVersionsWithoutFailing(
    supabase,
    [changeResult.data.previousVersionId],
    'Cv version release failed after sent cv change',
  )
  return { ok: true, data: null }
}

const addTailoredCvToLibrary = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvUpload: ValidatedCvUpload,
  storedVersionId: string,
): Promise<TailoredCvUploadOutcome> => {
  try {
    const cvCount = await countCvs(supabase, userId)
    if (isCvLibraryFull(cvCount)) return { libraryErrorMessage: CV_MESSAGES.libraryFullAfterTailoredUpload }
    const creationResult = await createCvFromVersion(supabase, userId, cvUpload.label, storedVersionId)
    return { libraryErrorMessage: creationResult.ok ? null : CV_MESSAGES.libraryFullAfterTailoredUpload }
  } catch (creationError) {
    console.error('Library cv creation failed after tailored cv upload', {
      errorMessage: creationError instanceof Error ? creationError.message : typeof creationError,
    })
    return { libraryErrorMessage: CV_SAVE_FAILURE_MESSAGE }
  }
}

const uploadTailoredCv = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  validatedArguments: { jobApplicationId: string; cvUpload: ValidatedCvUpload; addToLibrary: boolean },
): Promise<ActionResult<TailoredCvUploadOutcome>> => {
  const { jobApplicationId, cvUpload, addToLibrary } = validatedArguments
  const pdfBytesResult = await readPdfBytes(cvUpload.pdfFile)
  if (!pdfBytesResult.ok) return pdfBytesResult
  const isOwnedByUser = await isJobApplicationOwnedByUser(supabase, userId, jobApplicationId)
  if (!isOwnedByUser) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  const storedVersionId = await storeCvVersion(supabase, userId, {
    cvId: null,
    label: cvUpload.label,
    pdfBytes: pdfBytesResult.data,
    fileName: readCvFileName(cvUpload.pdfFile),
  })
  const attachmentResult = await runStepOrReleaseStoredVersion(supabase, storedVersionId, () =>
    setSentCvVersion(supabase, userId, jobApplicationId, storedVersionId),
  )
  if (!attachmentResult.ok) return attachmentResult
  await releaseCvVersionsWithoutFailing(
    supabase,
    [attachmentResult.data.previousVersionId],
    'Cv version release failed after sent cv change',
  )
  if (!addToLibrary) return { ok: true, data: { libraryErrorMessage: null } }
  return { ok: true, data: await addTailoredCvToLibrary(supabase, userId, cvUpload, storedVersionId) }
}

const attachLibraryCv = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  cvId: string,
): Promise<ActionResult<null>> => {
  const cvRowResult = await findCvRow(supabase, userId, cvId)
  if (!cvRowResult.ok) return cvRowResult
  if (cvRowResult.data.currentVersionId === null) return rejectWith(CV_MESSAGES.cvNotFound)
  return changeSentCvVersion(supabase, userId, jobApplicationId, cvRowResult.data.currentVersionId)
}

export const listCvs = async (): Promise<ActionResult<CvLibraryItem[]>> =>
  runAuthenticatedOperation({
    operationName: 'listCvs',
    failureMessage: CV_LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({ ok: true, data: await listCvLibraryItems(supabase, userId) }),
  })

export const createCv = async (formData: FormData): Promise<ActionResult<{ id: string }>> =>
  runAuthenticatedOperation({
    operationName: 'createCv',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateCvUploadFormData(formData),
    operation: createCvFromPdf,
  })

export const replaceCvFile = async (cvId: string, formData: FormData): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'replaceCvFile',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ cvId: string; pdfFile: Blob }> => {
      const cvIdValidation = validateUuid(cvId, CV_MESSAGES.cvNotFound)
      if (!cvIdValidation.ok) return cvIdValidation
      const pdfFileValidation = validateCvPdfFromFormData(formData)
      if (!pdfFileValidation.ok) return pdfFileValidation
      return { ok: true, data: { cvId: cvIdValidation.data, pdfFile: pdfFileValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      replaceCvPdf(supabase, userId, validatedArguments.cvId, validatedArguments.pdfFile),
  })

export const renameCv = async (cvId: string, label: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'renameCv',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ cvId: string; label: string }> => {
      const cvIdValidation = validateUuid(cvId, CV_MESSAGES.cvNotFound)
      if (!cvIdValidation.ok) return cvIdValidation
      const labelValidation = validateCvLabel(label)
      if (!labelValidation.ok) return labelValidation
      return { ok: true, data: { cvId: cvIdValidation.data, label: labelValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      renameCvRow(supabase, userId, validatedArguments.cvId, validatedArguments.label),
  })

export const deleteCv = async (cvId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'deleteCv',
    failureMessage: CV_DELETE_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(cvId, CV_MESSAGES.cvNotFound),
    operation: async (supabase, userId, validatedCvId) => {
      const deletionResult = await deleteCvRow(supabase, userId, validatedCvId)
      if (!deletionResult.ok) return deletionResult
      await releaseCvVersionsWithoutFailing(supabase, deletionResult.data.versionIds, 'Cv version release failed after cv deletion')
      return { ok: true, data: null }
    },
  })

export const confirmCvStillGood = async (cvId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'confirmCvStillGood',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateUuid(cvId, CV_MESSAGES.cvNotFound),
    operation: (supabase, userId, validatedCvId) => markCvReviewed(supabase, userId, validatedCvId),
  })

export const attachLibraryCvToJobApplication = async (
  jobApplicationId: string,
  cvId: string,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'attachLibraryCvToJobApplication',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ jobApplicationId: string; cvId: string }> => {
      const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
      if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
      const cvIdValidation = validateUuid(cvId, CV_MESSAGES.cvNotFound)
      if (!cvIdValidation.ok) return cvIdValidation
      return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, cvId: cvIdValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      attachLibraryCv(supabase, userId, validatedArguments.jobApplicationId, validatedArguments.cvId),
  })

export const uploadTailoredCvForJobApplication = async (
  jobApplicationId: string,
  formData: FormData,
): Promise<ActionResult<TailoredCvUploadOutcome>> =>
  runAuthenticatedOperation({
    operationName: 'uploadTailoredCvForJobApplication',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ jobApplicationId: string; cvUpload: ValidatedCvUpload; addToLibrary: boolean }> => {
      const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
      if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
      const cvUploadValidation = validateCvUploadFormData(formData)
      if (!cvUploadValidation.ok) return cvUploadValidation
      return {
        ok: true,
        data: {
          jobApplicationId: jobApplicationIdValidation.data,
          cvUpload: cvUploadValidation.data,
          addToLibrary: formData.get(CV_FORM_FIELD_NAMES.addToLibrary) === 'true',
        },
      }
    },
    operation: uploadTailoredCv,
  })

export const detachSentCvFromJobApplication = async (jobApplicationId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'detachSentCvFromJobApplication',
    failureMessage: CV_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: (supabase, userId, validatedJobApplicationId) =>
      changeSentCvVersion(supabase, userId, validatedJobApplicationId, null),
  })
