import { randomUUID } from 'node:crypto'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  UserDataSnapshot,
  UserDataSnapshotJobSpec,
  UserDataSnapshotOpportunityDecision,
} from '../src/server/data-snapshot/build-user-data-snapshot'
import type { BriefLanguage } from '../src/domain/interview-preparation'
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
  opportunityFilters: 'opportunity_filters',
  endClientBriefs: 'end_client_briefs',
  interviewQuestions: 'interview_questions',
} as const satisfies Record<string, keyof Database['public']['Tables']>
const SNAPSHOT_ARRAY_KEYS = Object.keys(SNAPSHOT_TABLE_NAMES) as (keyof typeof SNAPSHOT_TABLE_NAMES)[]
const ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS = [
  'opportunityFilters',
  'opportunityDecisions',
  'endClientBriefs',
  'interviewQuestions',
] as const
const REQUIRED_SNAPSHOT_ARRAY_KEYS = SNAPSHOT_ARRAY_KEYS.filter(
  (snapshotArrayKey) => !(ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS as readonly string[]).includes(snapshotArrayKey),
)
const OPPORTUNITY_DECISION_VALUES: readonly string[] = ['applied', 'dismissed']
const OPPORTUNITY_KEY_SEPARATOR = '\u0000'
const ROW_ID_LOOKUP_CHUNK_SIZE = 100
const PARENT_DIRECTORY_SEGMENT = '..'
const USER_NOT_FOUND_ERROR_CODE = 'user_not_found'
const LEGACY_END_CLIENT_BRIEF_LANGUAGE: BriefLanguage = 'fr'
const LEGACY_OPPORTUNITY_FILTERS_SOURCE = 'free-work'

type EarlierOpportunityFiltersRow = Omit<Tables<'opportunity_filters'>, 'disabled_sources'> & {
  source?: string
  disabled_sources?: string[]
}

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)

const toFrenchBriefsFromLegacyColumns = (endClient: Tables<'end_clients'>): Tables<'end_client_briefs'>[] => {
  if (typeof endClient.brief_markdown !== 'string') return []
  return [
    {
      id: randomUUID(),
      user_id: endClient.user_id,
      end_client_id: endClient.id,
      language: LEGACY_END_CLIENT_BRIEF_LANGUAGE,
      markdown: endClient.brief_markdown,
      sources: Array.isArray(endClient.brief_sources) ? endClient.brief_sources : [],
      generated_at: endClient.brief_generated_at ?? endClient.updated_at,
    },
  ]
}

const toSharedOpportunityFiltersRow = (filtersRow: EarlierOpportunityFiltersRow): Tables<'opportunity_filters'> => {
  const sharedFiltersRow = { ...filtersRow, disabled_sources: filtersRow.disabled_sources ?? [] }
  delete sharedFiltersRow.source
  return sharedFiltersRow
}

const toSharedOpportunityFilters = (filtersRows: EarlierOpportunityFiltersRow[]): Tables<'opportunity_filters'>[] =>
  filtersRows
    .filter((filtersRow) => filtersRow.source === undefined || filtersRow.source === LEGACY_OPPORTUNITY_FILTERS_SOURCE)
    .map(toSharedOpportunityFiltersRow)

export const parseUserDataSnapshot = (snapshotJson: unknown): UserDataSnapshot => {
  const hasSnapshotShape =
    isRecord(snapshotJson) &&
    snapshotJson.formatVersion === 1 &&
    typeof snapshotJson.userId === 'string' &&
    isRecord(snapshotJson.profile) &&
    REQUIRED_SNAPSHOT_ARRAY_KEYS.every((snapshotArrayKey) => Array.isArray(snapshotJson[snapshotArrayKey])) &&
    ARRAY_KEYS_ABSENT_FROM_EARLIER_SNAPSHOTS.every(
      (snapshotArrayKey) => snapshotJson[snapshotArrayKey] === undefined || Array.isArray(snapshotJson[snapshotArrayKey]),
    )
  if (!hasSnapshotShape) throw new Error('The file is not a Freeclutch snapshot with formatVersion 1')
  const parsedSnapshot = snapshotJson as UserDataSnapshot
  return {
    ...parsedSnapshot,
    opportunityFilters: toSharedOpportunityFilters(parsedSnapshot.opportunityFilters ?? []),
    opportunityDecisions: parsedSnapshot.opportunityDecisions ?? [],
    endClientBriefs: parsedSnapshot.endClientBriefs ?? parsedSnapshot.endClients.flatMap(toFrenchBriefsFromLegacyColumns),
    interviewQuestions: parsedSnapshot.interviewQuestions ?? [],
  }
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

const isOpportunityDecisionRestorable = (
  opportunityDecision: UserDataSnapshotOpportunityDecision,
  snapshotJobApplicationIds: Set<string>,
): boolean =>
  isRecord(opportunityDecision) &&
  typeof opportunityDecision.source === 'string' &&
  typeof opportunityDecision.externalId === 'string' &&
  OPPORTUNITY_DECISION_VALUES.includes(opportunityDecision.decision) &&
  (opportunityDecision.jobApplicationId === null ||
    snapshotJobApplicationIds.has(opportunityDecision.jobApplicationId))

const assertEveryOpportunityDecisionIsRestorable = (snapshot: UserDataSnapshot): void => {
  const snapshotJobApplicationIds = new Set(snapshot.jobApplications.map((jobApplication) => jobApplication.id))
  if (
    !snapshot.opportunityDecisions.every((opportunityDecision) =>
      isOpportunityDecisionRestorable(opportunityDecision, snapshotJobApplicationIds),
    )
  ) {
    throw new Error('Snapshot opportunity decisions must be valid and only reference job applications of the snapshot user')
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

const buildOpportunityKey = (source: string, externalId: string): string =>
  `${source}${OPPORTUNITY_KEY_SEPARATOR}${externalId}`

const findOpportunityIdsByKey = async (
  supabase: RestoreSupabaseClient,
  opportunityDecisions: UserDataSnapshotOpportunityDecision[],
): Promise<Map<string, string>> => {
  const externalIdChunks = splitIntoChunks(
    [...new Set(opportunityDecisions.map((opportunityDecision) => opportunityDecision.externalId))],
    ROW_ID_LOOKUP_CHUNK_SIZE,
  )
  const opportunityRowChunks = await Promise.all(
    externalIdChunks.map(async (externalIdChunk) => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, source, external_id')
        .in('external_id', externalIdChunk)
      if (error) throw new Error(`Restore operation findOpportunities failed with code ${error.code}: ${error.message}`)
      return data
    }),
  )
  return new Map(
    opportunityRowChunks.flat().map((opportunityRow) => [
      buildOpportunityKey(opportunityRow.source, opportunityRow.external_id),
      opportunityRow.id,
    ]),
  )
}

const restoreOpportunityDecisions = async (
  supabase: RestoreSupabaseClient,
  snapshot: UserDataSnapshot,
): Promise<number> => {
  const opportunityIdsByKey = await findOpportunityIdsByKey(supabase, snapshot.opportunityDecisions)
  const decisionRows = snapshot.opportunityDecisions.flatMap((opportunityDecision) => {
    const opportunityId = opportunityIdsByKey.get(
      buildOpportunityKey(opportunityDecision.source, opportunityDecision.externalId),
    )
    if (opportunityId === undefined) return []
    return [
      {
        user_id: snapshot.userId,
        opportunity_id: opportunityId,
        decision: opportunityDecision.decision,
        job_application_id: opportunityDecision.jobApplicationId,
        decided_at: opportunityDecision.decidedAt,
      },
    ]
  })
  failOnWriteError(
    'upsertOpportunityDecisions',
    await supabase.from('opportunity_decisions').upsert(decisionRows, { onConflict: 'user_id,opportunity_id' }),
  )
  return snapshot.opportunityDecisions.length - decisionRows.length
}

export const restoreUserDataSnapshot = async (
  supabase: RestoreSupabaseClient,
  snapshot: UserDataSnapshot,
): Promise<{ skippedOpportunityDecisionCount: number }> => {
  assertEveryRowBelongsToSnapshotUser(snapshot)
  assertEveryOpportunityDecisionIsRestorable(snapshot)
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
  failOnWriteError(
    'upsertOpportunityFilters',
    await supabase.from('opportunity_filters').upsert(snapshot.opportunityFilters, { onConflict: 'user_id' }),
  )
  failOnWriteError(
    'upsertEndClientBriefs',
    await supabase
      .from('end_client_briefs')
      .upsert(snapshot.endClientBriefs, { onConflict: 'user_id,end_client_id,language' }),
  )
  failOnWriteError(
    'upsertInterviewQuestions',
    await supabase
      .from('interview_questions')
      .upsert(snapshot.interviewQuestions, { onConflict: 'user_id,job_application_id,language' }),
  )
  failOnWriteError('assignMissingContactIntermediaries', await supabase.rpc('assign_missing_contact_intermediaries'))
  const skippedOpportunityDecisionCount = await restoreOpportunityDecisions(supabase, snapshot)
  await uploadJobSpecPdfs(supabase, snapshot)
  return { skippedOpportunityDecisionCount }
}
