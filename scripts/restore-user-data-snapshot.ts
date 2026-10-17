import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  UserDataSnapshot,
  UserDataSnapshotJobSpec,
} from '../src/server/data-snapshot/build-user-data-snapshot'
import type { Database, Tables } from '../src/server/supabase/database-types'

type RestoreSupabaseClient = SupabaseClient<Database>

const JOB_SPECS_BUCKET = 'job-specs'
const JOB_SPEC_PDF_MIME_TYPE = 'application/pdf'
const SNAPSHOT_ARRAY_KEYS = [
  'intermediaries',
  'contacts',
  'endClients',
  'jobApplications',
  'activityLogEntries',
  'interviews',
  'jobSpecs',
  'alertSnoozes',
] as const

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

const failOnWriteError = (operationName: string, { error }: { error: PostgrestError | null }): void => {
  if (error) throw new Error(`Restore operation ${operationName} failed with code ${error.code}: ${error.message}`)
}

const ensureSnapshotUserExists = async (supabase: RestoreSupabaseClient, snapshot: UserDataSnapshot): Promise<void> => {
  const { data: existingUserData } = await supabase.auth.admin.getUserById(snapshot.userId)
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
