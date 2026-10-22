import 'server-only'
import { CVS_BUCKET } from '@/domain/cv-library'
import { JOB_SPECS_BUCKET } from '@/domain/job-spec'
import type { OpportunityDecision } from '@/domain/opportunities'
import { toRepositoryError } from '@/server/repositories/repository-error'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { fetchEveryRow } from './fetch-every-row'

export type UserDataSnapshotProfile = Omit<
  Tables<'profiles'>,
  'encrypted_anthropic_api_key' | 'anthropic_api_key_last_four' | 'opportunities_last_viewed_at'
>

export type UserDataSnapshotJobSpec = Tables<'job_specs'> & { pdfBase64: string | null }

export type UserDataSnapshotCvVersion = Tables<'cv_versions'> & { pdfBase64: string }

export type UserDataSnapshotOpportunityDecision = {
  source: string
  externalId: string
  decision: OpportunityDecision
  jobApplicationId: string | null
  decidedAt: string
}

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
  opportunityFilters: Tables<'opportunity_filters'>[]
  opportunityDecisions: UserDataSnapshotOpportunityDecision[]
  endClientBriefs: Tables<'end_client_briefs'>[]
  interviewQuestions: Tables<'interview_questions'>[]
  cvs: Tables<'cvs'>[]
  cvVersions: UserDataSnapshotCvVersion[]
}

const SNAPSHOT_PROFILE_COLUMNS = 'id, first_name, last_name, email, links, follow_up_delay_days, created_at, updated_at'

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

const downloadCvPdfAsBase64 = async (supabase: FreeclutchSupabaseClient, storagePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from(CVS_BUCKET).download(storagePath)
  if (error) throw new Error(`Cv pdf download failed with status ${error.status ?? 'unknown'}`)
  return Buffer.from(await data.arrayBuffer()).toString('base64')
}

const attachCvVersionPdfs = (
  supabase: FreeclutchSupabaseClient,
  cvVersionRows: Tables<'cv_versions'>[],
): Promise<UserDataSnapshotCvVersion[]> =>
  Promise.all(
    cvVersionRows.map(async (cvVersionRow) => ({
      ...cvVersionRow,
      pdfBase64: await downloadCvPdfAsBase64(supabase, cvVersionRow.storage_path),
    })),
  )

const fetchSnapshotOpportunityDecisions = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<UserDataSnapshotOpportunityDecision[]> => {
  const decisionRows = await fetchEveryRow('fetchSnapshotOpportunityDecisions', (firstRowIndex, lastRowIndex) =>
    supabase
      .from('opportunity_decisions')
      .select('decision, job_application_id, decided_at, opportunity_id, opportunities!inner(source, external_id)')
      .eq('user_id', userId)
      .order('opportunity_id')
      .range(firstRowIndex, lastRowIndex),
  )
  return decisionRows.map((decisionRow) => ({
    source: decisionRow.opportunities.source,
    externalId: decisionRow.opportunities.external_id,
    decision: decisionRow.decision as OpportunityDecision,
    jobApplicationId: decisionRow.job_application_id,
    decidedAt: decisionRow.decided_at,
  }))
}

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
    opportunityFilters,
    opportunityDecisions,
    endClientBriefs,
    interviewQuestions,
    cvs,
    cvVersionRows,
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
    fetchEveryRow('fetchSnapshotOpportunityFilters', (firstRowIndex, lastRowIndex) =>
      supabase
        .from('opportunity_filters')
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(firstRowIndex, lastRowIndex),
    ),
    fetchSnapshotOpportunityDecisions(supabase, userId),
    fetchEveryRow('fetchSnapshotEndClientBriefs', (firstRowIndex, lastRowIndex) =>
      supabase
        .from('end_client_briefs')
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotInterviewQuestions', (firstRowIndex, lastRowIndex) =>
      supabase
        .from('interview_questions')
        .select('*')
        .eq('user_id', userId)
        .order('id')
        .range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotCvs', (firstRowIndex, lastRowIndex) =>
      supabase.from('cvs').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
    ),
    fetchEveryRow('fetchSnapshotCvVersions', (firstRowIndex, lastRowIndex) =>
      supabase.from('cv_versions').select('*').eq('user_id', userId).order('id').range(firstRowIndex, lastRowIndex),
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
    opportunityFilters,
    opportunityDecisions,
    endClientBriefs,
    interviewQuestions,
    cvs,
    cvVersions: await attachCvVersionPdfs(supabase, cvVersionRows),
  }
}
