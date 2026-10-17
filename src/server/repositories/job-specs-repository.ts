import 'server-only'
import { randomUUID } from 'node:crypto'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import { isStackItem, JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { JOB_SPEC_MESSAGES, JOB_SPEC_PDF_MIME_TYPE, type JobSpec } from '@/domain/job-spec'
import type { StackItem } from '@/domain/types'
import type { Json } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

export type JobSpecContent = { sourceKind: 'pdf'; storagePath: string } | { sourceKind: 'text'; rawText: string }

type StorageFailure = { status?: number }

const JOB_SPECS_BUCKET = 'job-specs'
const SIGNED_URL_VALIDITY_IN_SECONDS = 5 * 60

const toStorageRepositoryError = (operationName: string, storageFailure: StorageFailure): Error =>
  new Error(`Storage operation ${operationName} failed with status ${storageFailure.status ?? 'unknown'}`)

const toPendingStack = (pendingStackJson: Json | null): StackItem[] | null =>
  Array.isArray(pendingStackJson) ? pendingStackJson.filter(isStackItem) : null

const findJobSpecStoragePath = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('job_specs')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .maybeSingle()
  if (error) throw toRepositoryError('findJobSpecStoragePath', error)
  return data?.storage_path ?? null
}

const removeJobSpecFile = async (supabase: FreeclutchSupabaseClient, storagePath: string): Promise<void> => {
  const { error } = await supabase.storage.from(JOB_SPECS_BUCKET).remove([storagePath])
  if (error) console.error('Job spec file removal failed', { httpStatus: error.status ?? null })
}

const updatePendingStackColumn = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  pendingStack: StackItem[] | null,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('job_specs')
    .update({ pending_stack: pendingStack })
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('updatePendingStackColumn', error)
  return data !== null
}

export const findJobSpec = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<JobSpec | null> => {
  const { data, error } = await supabase
    .from('job_specs')
    .select('source_kind, raw_text, pending_stack, updated_at')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .maybeSingle()
  if (error) throw toRepositoryError('findJobSpec', error)
  if (data === null) return null
  return {
    sourceKind: data.source_kind,
    rawText: data.raw_text,
    pendingStack: toPendingStack(data.pending_stack),
    updatedAt: new Date(data.updated_at),
  }
}

export const uploadJobSpecPdfFile = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  pdfBytes: Uint8Array,
): Promise<string> => {
  const storagePath = `${userId}/${jobApplicationId}/${randomUUID()}.pdf`
  const { error } = await supabase.storage
    .from(JOB_SPECS_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: JOB_SPEC_PDF_MIME_TYPE, upsert: false })
  if (error) throw toStorageRepositoryError('uploadJobSpecPdfFile', error)
  return storagePath
}

export const saveJobSpecContent = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  jobSpecContent: JobSpecContent,
): Promise<ActionResult<null>> => {
  const previousStoragePath = await findJobSpecStoragePath(supabase, userId, jobApplicationId)
  const { error } = await supabase.from('job_specs').upsert(
    {
      user_id: userId,
      job_application_id: jobApplicationId,
      source_kind: jobSpecContent.sourceKind,
      storage_path: jobSpecContent.sourceKind === 'pdf' ? jobSpecContent.storagePath : null,
      raw_text: jobSpecContent.sourceKind === 'text' ? jobSpecContent.rawText : null,
      pending_stack: null,
    },
    { onConflict: 'user_id,job_application_id' },
  )
  if (error) {
    if (jobSpecContent.sourceKind === 'pdf') await removeJobSpecFile(supabase, jobSpecContent.storagePath)
    if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
    throw toRepositoryError('saveJobSpecContent', error)
  }
  if (previousStoragePath !== null) await removeJobSpecFile(supabase, previousStoragePath)
  return { ok: true, data: null }
}

export const storePendingJobSpecStack = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  pendingStack: StackItem[],
): Promise<void> => {
  await updatePendingStackColumn(supabase, userId, jobApplicationId, pendingStack)
}

export const clearPendingJobSpecStack = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<null>> => {
  const isJobSpecFound = await updatePendingStackColumn(supabase, userId, jobApplicationId, null)
  return isJobSpecFound ? { ok: true, data: null } : rejectWith(JOB_SPEC_MESSAGES.notFound)
}

export const confirmPendingJobSpecStack = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  confirmedStack: StackItem[],
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('job_applications')
    .update({ stack: confirmedStack })
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('confirmPendingJobSpecStack', error)
  if (data === null) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  await updatePendingStackColumn(supabase, userId, jobApplicationId, null)
  return { ok: true, data: null }
}

export const createJobSpecDownloadUrl = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<string>> => {
  const storagePath = await findJobSpecStoragePath(supabase, userId, jobApplicationId)
  if (storagePath === null) return rejectWith(JOB_SPEC_MESSAGES.noPdfToShow)
  const { data, error } = await supabase.storage
    .from(JOB_SPECS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_VALIDITY_IN_SECONDS)
  if (error) throw toStorageRepositoryError('createJobSpecDownloadUrl', error)
  return { ok: true, data: data.signedUrl }
}
