import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { ActivityLogEntry, ActivityLogEntryInput } from '@/domain/activity-log'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { deleteAlertSnoozesForJobApplication } from './alert-snoozes-repository'
import { isJobApplicationOwnedByUser } from './job-application-ownership'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

export const recordActivityLogEntry = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  { kind, summary, occurredAt }: ActivityLogEntryInput,
): Promise<ActionResult<null>> => {
  const { error } = await supabase.from('activity_log_entries').insert({
    user_id: userId,
    job_application_id: jobApplicationId,
    kind,
    summary,
    occurred_at: occurredAt?.toISOString(),
  })
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
  }
  if (error) throw toRepositoryError('recordActivityLogEntry', error)
  await deleteAlertSnoozesForJobApplication(supabase, userId, jobApplicationId)
  return { ok: true, data: null }
}

export const listActivityLogEntriesForJobApplication = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<ActivityLogEntry[]>> => {
  if (!(await isJobApplicationOwnedByUser(supabase, userId, jobApplicationId))) {
    return { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
  }
  const { data, error } = await supabase
    .from('activity_log_entries')
    .select('id, job_application_id, occurred_at, kind, summary')
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw toRepositoryError('listActivityLogEntriesForJobApplication', error)
  return {
    ok: true,
    data: data.map((activityLogEntryRow) => ({
      id: activityLogEntryRow.id,
      jobApplicationId: activityLogEntryRow.job_application_id,
      occurredAt: new Date(activityLogEntryRow.occurred_at),
      kind: activityLogEntryRow.kind,
      summary: activityLogEntryRow.summary,
    })),
  }
}
