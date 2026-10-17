import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  UserDataSnapshot,
  UserDataSnapshotJobSpec,
} from '../src/server/data-snapshot/build-user-data-snapshot'
import { JOB_SPEC_PDF_MIME_TYPE, JOB_SPECS_BUCKET, MAX_JOB_SPEC_PDF_BYTES } from '../src/domain/job-spec'
import type { Database, Tables } from '../src/server/supabase/database-types'

type RestoreSupabaseClient = SupabaseClient<Database>

const SNAPSHOT_TABLE_NAMES = {
  intermediaries: 'intermediaries',
  contacts: 'contacts',
  endClients: 'end_clients',
  jobApplications: 'job_applications',
  activityLogEntries: 'activity_log_entries',
  interviews: 'interviews',
  jobSpecs: 'job_specs',
  alertSnoozes: 'alert_snoozes',
} as const satisfies Record<string, keyof Database['public']['Tables']>
const SNAPSHOT_ARRAY_KEYS = Object.keys(SNAPSHOT_TABLE_NAMES) as (keyof typeof SNAPSHOT_TABLE_NAMES)[]
const ROW_ID_LOOKUP_CHUNK_SIZE = 100
const PARENT_DIRECTORY_SEGMENT = '..'
const USER_NOT_FOUND_ERROR_CODE = 'user_not_found'

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)

export const parseUserDataSnapshot = (snapshotJson: unknown): UserDataSnapshot => {
  const hasSnapshotShape =
    isRecord(snapshotJson) &&
    snapshotJson.formatVersion === 1 &&
    typeof snapshotJson.userId === 'string' &&
    isRecord(snapshotJson.profile) &&
    SNAPSHOT_ARRAY_KEYS.every((snapshotArrayKey) => Array.isArray(snapshotJson[snapshotArrayKey]))
  if (!hasSnapshotShape) throw new Error('The file is not a Freeclutch snapshot with formatVersion 1')
  return snapshotJson as UserDataSnapshot
}

const assertEveryRowBelongsToSnapshotUser = (snapshot: UserDataSnapshot): void => {
  const snapshotRowOwnerIds = [
    snapshot.profile.id,
    ...SNAPSHOT_ARRAY_KEYS.flatMap((snapshotArrayKey) =>
      snapshot[snapshotArrayKey].map((snapshotRow) => snapshotRow.user_id),
    ),
  ]
  if (snapshotRowOwnerIds.some((ownerId) => ownerId !== snapshot.userId)) {
    throw new Error('Snapshot rows must all belong to the snapshot user')
  }
}

const isJobSpecFileConfinedToSnapshotUser = (jobSpec: UserDataSnapshotJobSpec, userId: string): boolean => {
  const { storage_path: storagePath, pdfBase64 } = jobSpec
  const isPdfWithinLimit =
    pdfBase64 === null ||
    (typeof pdfBase64 === 'string' && Buffer.from(pdfBase64, 'base64').byteLength <= MAX_JOB_SPEC_PDF_BYTES)
  const isStoragePathInUserFolder =
    storagePath === null ||
    (typeof storagePath === 'string' &&
      storagePath.startsWith(`${userId}/`) &&
      !storagePath.split('/').includes(PARENT_DIRECTORY_SEGMENT))
  return isPdfWithinLimit && isStoragePathInUserFolder
}

const assertEveryJobSpecFileStaysInUserFolder = (snapshot: UserDataSnapshot): void => {
  if (!snapshot.jobSpecs.every((jobSpec) => isJobSpecFileConfinedToSnapshotUser(jobSpec, snapshot.userId))) {
    throw new Error('Snapshot job spec files must stay in the snapshot user folder and weigh at most 4 MB')
  }
}

const splitIntoChunks = <Item>(items: Item[], chunkSize: number): Item[][] =>
  Array.from({ length: Math.ceil(items.length / chunkSize) }, (_unused, chunkIndex) =>
    items.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize),
  )

const countRowsOwnedByAnotherUser = async (
  supabase: RestoreSupabaseClient,
  tableName: (typeof SNAPSHOT_TABLE_NAMES)[keyof typeof SNAPSHOT_TABLE_NAMES],
  rowIds: string[],
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .in('id', rowIds)
    .neq('user_id', userId)
  if (error) throw new Error(`Restore operation findForeignRowIds failed with code ${error.code}: ${error.message}`)
  return count ?? 0
}

const assertNoRowIdBelongsToAnotherUser = async (
  supabase: RestoreSupabaseClient,
  snapshot: UserDataSnapshot,
): Promise<void> => {
  const foreignRowCounts = await Promise.all(
    SNAPSHOT_ARRAY_KEYS.flatMap((snapshotArrayKey) =>
      splitIntoChunks(
        snapshot[snapshotArrayKey].map((snapshotRow) => snapshotRow.id),
        ROW_ID_LOOKUP_CHUNK_SIZE,
      ).map((rowIdChunk) =>
        countRowsOwnedByAnotherUser(supabase, SNAPSHOT_TABLE_NAMES[snapshotArrayKey], rowIdChunk, snapshot.userId),
      ),
    ),
  )
  if (foreignRowCounts.some((foreignRowCount) => foreignRowCount > 0)) {
    throw new Error('Snapshot row ids must not belong to another user')
  }
}

const failOnWriteError = (operationName: string, { error }: { error: PostgrestError | null }): void => {
  if (error) throw new Error(`Restore operation ${operationName} failed with code ${error.code}: ${error.message}`)
}

const ensureSnapshotUserExists = async (supabase: RestoreSupabaseClient, snapshot: UserDataSnapshot): Promise<void> => {
  const { data: existingUserData, error: userLookupError } = await supabase.auth.admin.getUserById(snapshot.userId)
  if (userLookupError && userLookupError.code !== USER_NOT_FOUND_ERROR_CODE) {
    throw new Error(`Restore operation findUser failed: ${userLookupError.message}`)
  }
  if (existingUserData.user !== null) return
  if (snapshot.profile.email === null) throw new Error('Cannot recreate the snapshot user without a profile email')
  const { error } = await supabase.auth.admin.createUser({
    id: snapshot.userId,
    email: snapshot.profile.email,
    email_confirm: true,
  })
  if (error) throw new Error(`Restore operation recreateUser failed: ${error.message}`)
}

const toJobSpecRow = (jobSpec: UserDataSnapshotJobSpec): Tables<'job_specs'> => ({
  id: jobSpec.id,
  user_id: jobSpec.user_id,
  job_application_id: jobSpec.job_application_id,
  source_kind: jobSpec.source_kind,
  storage_path: jobSpec.storage_path,
  raw_text: jobSpec.raw_text,
  pending_stack: jobSpec.pending_stack,
  created_at: jobSpec.created_at,
  updated_at: jobSpec.updated_at,
})

const uploadJobSpecPdfs = async (supabase: RestoreSupabaseClient, snapshot: UserDataSnapshot): Promise<void> => {
  for (const { storage_path: storagePath, pdfBase64 } of snapshot.jobSpecs) {
    if (storagePath === null || pdfBase64 === null) continue
    const { error } = await supabase.storage
      .from(JOB_SPECS_BUCKET)
      .upload(storagePath, Buffer.from(pdfBase64, 'base64'), { contentType: JOB_SPEC_PDF_MIME_TYPE, upsert: true })
    if (error) throw new Error(`Restore operation uploadJobSpecPdf failed: ${error.message}`)
  }
}

export const restoreUserDataSnapshot = async (
  supabase: RestoreSupabaseClient,
  snapshot: UserDataSnapshot,
): Promise<void> => {
  assertEveryRowBelongsToSnapshotUser(snapshot)
  assertEveryJobSpecFileStaysInUserFolder(snapshot)
  await assertNoRowIdBelongsToAnotherUser(supabase, snapshot)
  await ensureSnapshotUserExists(supabase, snapshot)
  failOnWriteError('upsertProfile', await supabase.from('profiles').upsert(snapshot.profile))
  failOnWriteError('upsertIntermediaries', await supabase.from('intermediaries').upsert(snapshot.intermediaries))
  failOnWriteError('upsertContacts', await supabase.from('contacts').upsert(snapshot.contacts))
  failOnWriteError('upsertEndClients', await supabase.from('end_clients').upsert(snapshot.endClients))
  failOnWriteError('upsertJobApplications', await supabase.from('job_applications').upsert(snapshot.jobApplications))
  failOnWriteError(
    'upsertActivityLogEntries',
    await supabase.from('activity_log_entries').upsert(snapshot.activityLogEntries),
  )
  failOnWriteError('upsertInterviews', await supabase.from('interviews').upsert(snapshot.interviews))
  failOnWriteError(
    'upsertJobSpecs',
    await supabase.from('job_specs').upsert(snapshot.jobSpecs.map(toJobSpecRow)),
  )
  failOnWriteError('upsertAlertSnoozes', await supabase.from('alert_snoozes').upsert(snapshot.alertSnoozes))
  await uploadJobSpecPdfs(supabase, snapshot)
}
