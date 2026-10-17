import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { ALERT_SNOOZE_MESSAGES, isSnoozableAlertKind, type SnoozeAlertArguments } from '@/domain/alert-snoozes'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { addParisCalendarDays } from '@/domain/paris-time'
import type { AlertSnooze } from '@/domain/todo-alerts'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

export const snoozeJobApplicationAlert = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { jobApplicationId, alertKind, snoozeDays }: SnoozeAlertArguments,
  now: Date,
): Promise<ActionResult<null>> => {
  if (!isSnoozableAlertKind(alertKind)) {
    return { ok: false, errorMessage: ALERT_SNOOZE_MESSAGES.upcomingInterviewNotSnoozable }
  }
  const { error } = await supabase.from('alert_snoozes').upsert(
    {
      user_id: userId,
      job_application_id: jobApplicationId,
      alert_kind: alertKind,
      snoozed_until: addParisCalendarDays(now, snoozeDays).toISOString(),
    },
    { onConflict: 'user_id,job_application_id,alert_kind' },
  )
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) {
    return { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
  }
  if (error) throw toRepositoryError('snoozeJobApplicationAlert', error)
  return { ok: true, data: null }
}

export const listActiveAlertSnoozes = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<AlertSnooze[]> => {
  const { data, error } = await supabase
    .from('alert_snoozes')
    .select('job_application_id, alert_kind, snoozed_until')
    .eq('user_id', userId)
    .gt('snoozed_until', now.toISOString())
  if (error) throw toRepositoryError('listActiveAlertSnoozes', error)
  return data.map((alertSnoozeRow) => ({
    jobApplicationId: alertSnoozeRow.job_application_id,
    alertKind: alertSnoozeRow.alert_kind,
    snoozedUntil: new Date(alertSnoozeRow.snoozed_until),
  }))
}

export const deleteAlertSnoozesForJobApplication = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('alert_snoozes')
    .delete()
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
  if (error) throw toRepositoryError('deleteAlertSnoozesForJobApplication', error)
}
