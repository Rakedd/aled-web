import 'server-only'
import { randomUUID } from 'node:crypto'
import type { ActionResult } from '@/domain/action-result'
import {
  buildCvStoragePath,
  CV_MESSAGES,
  CV_PDF_MIME_TYPE,
  CVS_BUCKET,
  type CvLibraryItem,
  type CvPreviousSentVersion,
} from '@/domain/cv-library'
import { rejectWith } from '@/domain/input-validation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

type CvsOverviewRow = Tables<'cvs_overview'>
type CvVersionsOverviewRow = Tables<'cv_versions_overview'>

export type StoredCvVersionInput = { cvId: string | null; label: string; pdfBytes: Uint8Array; fileName: string }

const POSTGRES_CHECK_VIOLATION_CODE = '23514'
const SIGNED_URL_VALIDITY_IN_SECONDS = 5 * 60

const requireOverviewValue = <OverviewValue>(overviewValue: OverviewValue | null, columnName: string): OverviewValue => {
  if (overviewValue === null) throw new Error(`Cv overview row is missing ${columnName}`)
  return overviewValue
}

const toCvPreviousSentVersion = (versionRow: CvVersionsOverviewRow): CvPreviousSentVersion => ({
  id: requireOverviewValue(versionRow.id, 'id'),
  uploadedAt: new Date(requireOverviewValue(versionRow.uploaded_at, 'uploaded_at')),
  sentCount: requireOverviewValue(versionRow.sent_count, 'sent_count'),
})

const toCvLibraryItem = (cvRow: CvsOverviewRow, previousSentVersions: CvPreviousSentVersion[]): CvLibraryItem => ({
  id: requireOverviewValue(cvRow.id, 'id'),
  label: requireOverviewValue(cvRow.label, 'label'),
  reviewedAt: new Date(requireOverviewValue(cvRow.reviewed_at, 'reviewed_at')),
  currentVersion:
    cvRow.current_version_id === null
      ? null
      : {
          id: cvRow.current_version_id,
          uploadedAt: new Date(requireOverviewValue(cvRow.current_version_uploaded_at, 'current_version_uploaded_at')),
          fileName: requireOverviewValue(cvRow.current_version_file_name, 'current_version_file_name'),
        },
  sentCount: requireOverviewValue(cvRow.sent_count, 'sent_count'),
  previousSentVersions,
})

const removeCvFiles = async (supabase: FreeclutchSupabaseClient, storagePaths: string[]): Promise<void> => {
  const { error } = await supabase.storage.from(CVS_BUCKET).remove(storagePaths)
  if (error) console.error('Cv file removal failed', { httpStatus: error.status ?? null })
}

const listPreviousSentVersionRows = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvIds: string[],
): Promise<CvVersionsOverviewRow[]> => {
  if (cvIds.length === 0) return []
  const { data, error } = await supabase
    .from('cv_versions_overview')
    .select('*')
    .eq('user_id', userId)
    .in('cv_id', cvIds)
    .gt('sent_count', 0)
    .order('uploaded_at', { ascending: false })
  if (error) throw toRepositoryError('listPreviousSentVersionRows', error)
  return data
}

export const listCvLibraryItems = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<CvLibraryItem[]> => {
  const { data, error } = await supabase
    .from('cvs_overview')
    .select('*')
    .eq('user_id', userId)
    .order('current_version_uploaded_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw toRepositoryError('listCvLibraryItems', error)
  const versionRows = await listPreviousSentVersionRows(
    supabase,
    userId,
    data.map((cvRow) => requireOverviewValue(cvRow.id, 'id')),
  )
  return data.map((cvRow) =>
    toCvLibraryItem(
      cvRow,
      versionRows
        .filter((versionRow) => versionRow.cv_id === cvRow.id && versionRow.id !== cvRow.current_version_id)
        .map(toCvPreviousSentVersion),
    ),
  )
}

export const countCvs = async (supabase: FreeclutchSupabaseClient, userId: string): Promise<number> => {
  const { count, error } = await supabase.from('cvs').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw toRepositoryError('countCvs', error)
  return count ?? 0
}

export const findCvRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
): Promise<ActionResult<{ label: string; currentVersionId: string | null }>> => {
  const { data, error } = await supabase
    .from('cvs')
    .select('label, current_version_id')
    .eq('id', cvId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findCvRow', error)
  if (data === null) return rejectWith(CV_MESSAGES.cvNotFound)
  return { ok: true, data: { label: data.label, currentVersionId: data.current_version_id } }
}

export const storeCvVersion = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  version: StoredCvVersionInput,
): Promise<string> => {
  const versionId = randomUUID()
  const storagePath = buildCvStoragePath(userId, versionId)
  const { error: uploadError } = await supabase.storage
    .from(CVS_BUCKET)
    .upload(storagePath, version.pdfBytes, { contentType: CV_PDF_MIME_TYPE, upsert: false })
  if (uploadError) throw new Error(`Storage operation storeCvVersion failed with status ${uploadError.status ?? 'unknown'}`)
  const { error: insertError } = await supabase.from('cv_versions').insert({
    id: versionId,
    user_id: userId,
    cv_id: version.cvId,
    label: version.label,
    storage_path: storagePath,
    file_name: version.fileName,
    byte_size: version.pdfBytes.byteLength,
  })
  if (insertError) {
    await removeCvFiles(supabase, [storagePath])
    throw toRepositoryError('storeCvVersion', insertError)
  }
  return versionId
}

export const createCvFromVersion = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  label: string,
  versionId: string,
): Promise<ActionResult<{ id: string }>> => {
  const { data, error } = await supabase
    .from('cvs')
    .insert({ user_id: userId, label, current_version_id: versionId })
    .select('id')
    .single()
  if (error?.code === POSTGRES_CHECK_VIOLATION_CODE) return rejectWith(CV_MESSAGES.libraryFull)
  if (error) throw toRepositoryError('createCvFromVersion', error)
  const { error: attachError } = await supabase
    .from('cv_versions')
    .update({ cv_id: data.id })
    .eq('id', versionId)
    .eq('user_id', userId)
  if (attachError) throw toRepositoryError('createCvFromVersion', attachError)
  return { ok: true, data: { id: data.id } }
}

export const replaceCvCurrentVersion = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
  versionId: string,
): Promise<ActionResult<{ previousVersionId: string | null }>> => {
  const cvRowResult = await findCvRow(supabase, userId, cvId)
  if (!cvRowResult.ok) return cvRowResult
  const { error } = await supabase
    .from('cvs')
    .update({ current_version_id: versionId, reviewed_at: new Date().toISOString() })
    .eq('id', cvId)
    .eq('user_id', userId)
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(CV_MESSAGES.cvVersionNotFound)
  if (error) throw toRepositoryError('replaceCvCurrentVersion', error)
  return { ok: true, data: { previousVersionId: cvRowResult.data.currentVersionId } }
}

export const renameCvRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
  label: string,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('cvs')
    .update({ label })
    .eq('id', cvId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('renameCvRow', error)
  if (data === null) return rejectWith(CV_MESSAGES.cvNotFound)
  const { data: unsentVersionRows, error: unsentVersionsError } = await supabase
    .from('cv_versions_overview')
    .select('id')
    .eq('user_id', userId)
    .eq('cv_id', cvId)
    .eq('sent_count', 0)
  if (unsentVersionsError) throw toRepositoryError('renameCvRow', unsentVersionsError)
  const unsentVersionIds = unsentVersionRows.map((versionRow) => requireOverviewValue(versionRow.id, 'id'))
  if (unsentVersionIds.length === 0) return { ok: true, data: null }
  const { error: versionLabelError } = await supabase
    .from('cv_versions')
    .update({ label })
    .eq('user_id', userId)
    .in('id', unsentVersionIds)
  if (versionLabelError) throw toRepositoryError('renameCvRow', versionLabelError)
  return { ok: true, data: null }
}

export const deleteCvRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
): Promise<ActionResult<{ versionIds: string[] }>> => {
  const { data: versionRows, error: versionsError } = await supabase
    .from('cv_versions')
    .select('id')
    .eq('user_id', userId)
    .eq('cv_id', cvId)
  if (versionsError) throw toRepositoryError('deleteCvRow', versionsError)
  const { data, error } = await supabase
    .from('cvs')
    .delete()
    .eq('id', cvId)
    .eq('user_id', userId)
    .select('id, current_version_id')
    .maybeSingle()
  if (error) throw toRepositoryError('deleteCvRow', error)
  if (data === null) return rejectWith(CV_MESSAGES.cvNotFound)
  const releasedVersionIds = new Set(versionRows.map((versionRow) => versionRow.id))
  if (data.current_version_id !== null) releasedVersionIds.add(data.current_version_id)
  return { ok: true, data: { versionIds: [...releasedVersionIds] } }
}

export const markCvReviewed = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  cvId: string,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('cvs')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', cvId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('markCvReviewed', error)
  if (data === null) return rejectWith(CV_MESSAGES.cvNotFound)
  return { ok: true, data: null }
}

export const findSentCvVersionId = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('job_applications')
    .select('sent_cv_version_id')
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findSentCvVersionId', error)
  return data?.sent_cv_version_id ?? null
}

export const setSentCvVersion = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  versionId: string | null,
): Promise<ActionResult<{ previousVersionId: string | null }>> => {
  const { data: previousRow, error: previousError } = await supabase
    .from('job_applications')
    .select('sent_cv_version_id')
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (previousError) throw toRepositoryError('setSentCvVersion', previousError)
  if (previousRow === null) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  const { error } = await supabase
    .from('job_applications')
    .update({ sent_cv_version_id: versionId })
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(CV_MESSAGES.cvVersionNotFound)
  if (error) throw toRepositoryError('setSentCvVersion', error)
  return { ok: true, data: { previousVersionId: previousRow.sent_cv_version_id } }
}

export const releaseCvVersions = async (
  supabase: FreeclutchSupabaseClient,
  candidateVersionIds: (string | null)[],
): Promise<void> => {
  const uniqueVersionIds = [...new Set(candidateVersionIds.filter((versionId) => versionId !== null))]
  if (uniqueVersionIds.length === 0) return
  const { data: deletedStoragePaths, error } = await supabase.rpc('delete_unreferenced_cv_versions', {
    candidate_version_ids: uniqueVersionIds,
  })
  if (error) throw toRepositoryError('releaseCvVersions', error)
  if (deletedStoragePaths.length > 0) await removeCvFiles(supabase, deletedStoragePaths)
}

export const createCvVersionDownloadUrl = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  versionId: string,
): Promise<ActionResult<string>> => {
  const { data, error } = await supabase
    .from('cv_versions')
    .select('storage_path')
    .eq('id', versionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('createCvVersionDownloadUrl', error)
  if (data === null) return rejectWith(CV_MESSAGES.cvVersionNotFound)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(CVS_BUCKET)
    .createSignedUrl(data.storage_path, SIGNED_URL_VALIDITY_IN_SECONDS)
  if (signedUrlError) {
    throw new Error(`Storage operation createCvVersionDownloadUrl failed with status ${signedUrlError.status ?? 'unknown'}`)
  }
  return { ok: true, data: signedUrlData.signedUrl }
}
