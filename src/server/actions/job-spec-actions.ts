'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import { rejectWith } from '@/domain/input-validation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE, validateJobApplicationId, validateStack } from '@/domain/job-application'
import {
  hasPdfSignature,
  JOB_SPEC_MESSAGES,
  JOB_SPEC_PDF_FORM_FIELD_NAME,
  type JobSpec,
  type JobSpecSaveOutcome,
  validateJobSpecPdfFile,
  validateJobSpecText,
} from '@/domain/job-spec'
import type { StackItem } from '@/domain/types'
import { describeAiErrorForLogs } from '@/server/ai/ai-error'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { extractJobSpecStack, type JobSpecInput } from '@/server/ai/extract-job-spec-stack'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import {
  clearPendingJobSpecStack,
  confirmPendingJobSpecStack,
  findJobSpec,
  findJobSpecStoragePath,
  type JobSpecContent,
  saveJobSpecContent,
  storePendingJobSpecStack,
  uploadJobSpecPdfFile,
} from '@/server/repositories/job-specs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const JOB_SPEC_LOAD_FAILURE_MESSAGE = 'Impossible de charger la fiche métier pour le moment. Réessaie dans quelques minutes.'
const JOB_SPEC_SAVE_FAILURE_MESSAGE =
  "Impossible d'enregistrer la fiche métier pour le moment. Réessaie dans quelques minutes."
const STACK_UPDATE_FAILURE_MESSAGE = 'Impossible de mettre à jour la stack pour le moment. Réessaie dans quelques minutes.'

const extractPendingStack = async (userId: string, jobSpecInput: JobSpecInput): Promise<JobSpecSaveOutcome> => {
  try {
    const decryptedApiKey = await getDecryptedAnthropicApiKeyForUser(userId)
    if (decryptedApiKey === null) return { pendingStack: null, aiErrorMessage: AI_ERROR_MESSAGES.missing_api_key }
    const extractedStack = await extractJobSpecStack(createAnthropicClient(decryptedApiKey), jobSpecInput)
    return { pendingStack: extractedStack, aiErrorMessage: null }
  } catch (extractionError) {
    const aiErrorLogContext = describeAiErrorForLogs(extractionError)
    console.error('Job spec stack extraction failed', aiErrorLogContext)
    return { pendingStack: null, aiErrorMessage: AI_ERROR_MESSAGES[aiErrorLogContext.aiErrorKind] }
  }
}

const storePendingStackWithoutFailingTheSave = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  pendingStack: StackItem[],
): Promise<void> => {
  try {
    await storePendingJobSpecStack(supabase, userId, jobApplicationId, pendingStack)
  } catch (storageError) {
    console.error('Job spec pending stack storage failed', {
      errorMessage: storageError instanceof Error ? storageError.message : typeof storageError,
    })
  }
}

const saveJobSpecThenExtractStack = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  savedJobSpec: { content: JobSpecContent; previousStoragePath: string | null },
  jobSpecInput: JobSpecInput,
): Promise<ActionResult<JobSpecSaveOutcome>> => {
  const saveResult = await saveJobSpecContent(
    supabase,
    userId,
    jobApplicationId,
    savedJobSpec.content,
    savedJobSpec.previousStoragePath,
  )
  if (!saveResult.ok) return saveResult
  const saveOutcome = await extractPendingStack(userId, jobSpecInput)
  if (saveOutcome.pendingStack !== null && saveOutcome.pendingStack.length > 0) {
    await storePendingStackWithoutFailingTheSave(supabase, userId, jobApplicationId, saveOutcome.pendingStack)
  }
  return { ok: true, data: saveOutcome }
}

const validateUploadArguments = (
  jobApplicationId: unknown,
  formData: unknown,
): ActionResult<{ jobApplicationId: string; pdfFile: Blob }> => {
  const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  if (!(formData instanceof FormData)) return rejectWith(JOB_SPEC_MESSAGES.missingPdf)
  const pdfFileValidation = validateJobSpecPdfFile(formData.get(JOB_SPEC_PDF_FORM_FIELD_NAME))
  if (!pdfFileValidation.ok) return pdfFileValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, pdfFile: pdfFileValidation.data } }
}

const validateTextArguments = (
  jobApplicationId: unknown,
  text: unknown,
): ActionResult<{ jobApplicationId: string; text: string }> => {
  const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const textValidation = validateJobSpecText(text)
  if (!textValidation.ok) return textValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, text: textValidation.data } }
}

const validateConfirmationArguments = (
  jobApplicationId: unknown,
  stack: unknown,
): ActionResult<{ jobApplicationId: string; stack: StackItem[] }> => {
  const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const stackValidation = validateStack(stack)
  if (!stackValidation.ok) return stackValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, stack: stackValidation.data } }
}

export const getJobSpec = async (jobApplicationId: string): Promise<ActionResult<JobSpec | null>> =>
  runAuthenticatedOperation({
    operationName: 'getJobSpec',
    failureMessage: JOB_SPEC_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: async (supabase, userId, validatedJobApplicationId) => ({
      ok: true,
      data: await findJobSpec(supabase, userId, validatedJobApplicationId),
    }),
  })

export const uploadJobSpecPdf = async (
  jobApplicationId: string,
  formData: FormData,
): Promise<ActionResult<JobSpecSaveOutcome>> =>
  runAuthenticatedOperation({
    operationName: 'uploadJobSpecPdf',
    failureMessage: JOB_SPEC_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateUploadArguments(jobApplicationId, formData),
    operation: async (supabase, userId, validatedArguments) => {
      const pdfBytes = new Uint8Array(await validatedArguments.pdfFile.arrayBuffer())
      if (!hasPdfSignature(pdfBytes)) return rejectWith(JOB_SPEC_MESSAGES.pdfOnly)
      const isOwnedByUser = await isJobApplicationOwnedByUser(supabase, userId, validatedArguments.jobApplicationId)
      if (!isOwnedByUser) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
      const previousStoragePath = await findJobSpecStoragePath(supabase, userId, validatedArguments.jobApplicationId)
      const storagePath = await uploadJobSpecPdfFile(supabase, userId, validatedArguments.jobApplicationId, pdfBytes)
      return saveJobSpecThenExtractStack(
        supabase,
        userId,
        validatedArguments.jobApplicationId,
        { content: { sourceKind: 'pdf', storagePath }, previousStoragePath },
        { kind: 'pdf', base64Pdf: Buffer.from(pdfBytes).toString('base64') },
      )
    },
  })

export const saveJobSpecText = async (
  jobApplicationId: string,
  text: string,
): Promise<ActionResult<JobSpecSaveOutcome>> =>
  runAuthenticatedOperation({
    operationName: 'saveJobSpecText',
    failureMessage: JOB_SPEC_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateTextArguments(jobApplicationId, text),
    operation: async (supabase, userId, validatedArguments) => {
      const previousStoragePath = await findJobSpecStoragePath(supabase, userId, validatedArguments.jobApplicationId)
      return saveJobSpecThenExtractStack(
        supabase,
        userId,
        validatedArguments.jobApplicationId,
        { content: { sourceKind: 'text', rawText: validatedArguments.text }, previousStoragePath },
        { kind: 'text', text: validatedArguments.text },
      )
    },
  })

export const confirmJobSpecStack = async (jobApplicationId: string, stack: StackItem[]): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'confirmJobSpecStack',
    failureMessage: STACK_UPDATE_FAILURE_MESSAGE,
    validateArguments: () => validateConfirmationArguments(jobApplicationId, stack),
    operation: (supabase, userId, validatedArguments) =>
      confirmPendingJobSpecStack(supabase, userId, validatedArguments.jobApplicationId, validatedArguments.stack),
  })

export const discardPendingJobSpecStack = async (jobApplicationId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'discardPendingJobSpecStack',
    failureMessage: STACK_UPDATE_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: (supabase, userId, validatedJobApplicationId) =>
      clearPendingJobSpecStack(supabase, userId, validatedJobApplicationId),
  })
