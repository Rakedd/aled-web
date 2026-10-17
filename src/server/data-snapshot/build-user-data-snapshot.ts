import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { toRepositoryError } from '@/server/repositories/repository-error'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export type UserDataSnapshotProfile = Omit<
  Tables<'profiles'>,
  'encrypted_anthropic_api_key' | 'anthropic_api_key_last_four'
>

export type UserDataSnapshotJobSpec = Tables<'job_specs'> & { pdfBase64: string | null }

export type UserDataSnapshot = {
  formatVersion: 1
  exportedAt: string
  userId: string
  profile: UserDataSnapshotProfile
  intermediaries: Tables<'intermediaries'>[]
  contacts: Tables<'contacts'>[]
  endClients: Tables<'end_clients'>[]
  jobApplications: Tables<'job_applications'>[]
  activityLogEntries: Tables<'activity_log_entries'>[]
  interviews: Tables<'interviews'>[]
  jobSpecs: UserDataSnapshotJobSpec[]
  alertSnoozes: Tables<'alert_snoozes'>[]
}

type RowPageResult<Row> = { data: Row[] | null; error: PostgrestError | null }

type RowPageFetcher<Row> = (firstRowIndex: number, lastRowIndex: number) => PromiseLike<RowPageResult<Row>>

const JOB_SPECS_BUCKET = 'job-specs'
const ROW_PAGE_SIZE = 1000
const SNAPSHOT_PROFILE_COLUMNS = 'id, first_name, last_name, email, links, follow_up_delay_days, created_at, updated_at'

const fetchEveryRow = async <Row>(
  operationName: string,
  fetchRowPage: RowPageFetcher<Row>,
  alreadyFetchedRows: Row[] = [],
): Promise<Row[]> => {
  const firstRowIndex = alreadyFetchedRows.length
  const { data, error } = await fetchRowPage(firstRowIndex, firstRowIndex + ROW_PAGE_SIZE - 1)
  if (error) throw toRepositoryError(operationName, error)
  if (data === null || data.length === 0) return alreadyFetchedRows
  return fetchEveryRow(operationName, fetchRowPage, [...alreadyFetchedRows, ...data])
}

const fetchSnapshotProfile = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<UserDataSnapshotProfile> => {
  const { data, error } = await supabase.from('profiles').select(SNAPSHOT_PROFILE_COLUMNS).eq('id', userId).single()
  if (error) throw toRepositoryError('fetchSnapshotProfile', error)
  return data
}

const downloadJobSpecPdfAsBase64 = async (
  supabase: FreeclutchSupabaseClient,
  storagePath: string | null,
): Promise<string | null> => {
  if (storagePath === null) return null
  const { data, error } = await supabase.storage.from(JOB_SPECS_BUCKET).download(storagePath)
  if (error) throw new Error(`Job spec pdf download failed with status ${error.status ?? 'unknown'}`)
  return Buffer.from(await data.arrayBuffer()).toString('base64')
}

const attachJobSpecPdfs = (
  supabase: FreeclutchSupabaseClient,
  jobSpecRows: Tables<'job_specs'>[],
): Promise<UserDataSnapshotJobSpec[]> =>
  Promise.all(
    jobSpecRows.map(async (jobSpecRow) => ({
      ...jobSpecRow,
      pdfBase64: await downloadJobSpecPdfAsBase64(supabase, jobSpecRow.storage_path),
    })),
  )

export const buildUserDataSnapshot = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<UserDataSnapshot> => {
  const [
    profile,
    intermediaries,
    contacts,
    endClients,
    jobApplications,
    activityLogEntries,
    interviews,
    jobSpecRows,
    alertSnoozes,
  ] = await Promise.all([
    fetchSnapshotProfile(supabase, userId),
    fetchEveryRow('fetchSnapshotIntermediaries', (firstRowIndex, lastRowIndex) =>
      supabase.from('intermediaries').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotContacts', (firstRowIndex, lastRowIndex) =>
      supabase.from('contacts').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotEndClients', (firstRowIndex, lastRowIndex) =>
      supabase.from('end_clients').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotJobApplications', (firstRowIndex, lastRowIndex) =>
      supabase
        .from('job_applications')
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotActivityLogEntries', (firstRowIndex, lastRowIndex) =>
      supabase
        .from('activity_log_entries')
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotInterviews', (firstRowIndex, lastRowIndex) =>
      supabase.from('interviews').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotJobSpecs', (firstRowIndex, lastRowIndex) =>
      supabase.from('job_specs').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotAlertSnoozes', (firstRowIndex, lastRowIndex) =>
      supabase.from('alert_snoozes').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
  ])

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    intermediaries,
    contacts,
    endClients,
    jobApplications,
    activityLogEntries,
    interviews,
    jobSpecs: await attachJobSpecPdfs(supabase, jobSpecRows),
    alertSnoozes,
  }
}
