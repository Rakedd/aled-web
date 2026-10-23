import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { CalendarFeedInterview } from '@/domain/calendar-feed'
import { formatEndClientLabel } from '@/domain/entity-names'
import { rejectWith } from '@/domain/input-validation'
import {
  INTERVIEW_NOT_FOUND_MESSAGE,
  type Interview,
  type InterviewWithJobApplication,
  type ValidatedInterviewInput,
} from '@/domain/interviews'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { isJobApplicationOwnedByUser } from './job-application-ownership'
import { parseStoredStackItems } from './job-applications-repository'
import { POSTGRES_FOREIGN_KEY_VIOLATION_CODE, toRepositoryError } from './repository-error'

type InterviewRow = Pick<
  Tables<'interviews'>,
  'id' | 'job_application_id' | 'starts_at' | 'kind' | 'format' | 'participants' | 'notes'
>

type InterviewJobApplicationRow = Pick<
  Tables<'job_applications_overview'>,
  | 'id'
  | 'title'
  | 'stack'
  | 'end_client_name'
  | 'end_client_parent_name'
  | 'location'
  | 'remote_policy'
  | 'posted_daily_rate'
  | 'requested_daily_rate'
  | 'desired_start'
  | 'duration'
  | 'posting_raw_text'
>

type CalendarFeedWindow = { from: Date; now: Date; to: Date }

const INTERVIEW_COLUMNS = 'id, job_application_id, starts_at, kind, format, participants, notes'

const CALENDAR_FEED_INTERVIEW_COLUMNS =
  'id, job_application_id, starts_at, kind, format, participants, job_applications_overview!interviews_user_id_job_application_id_fkey(title, end_client_name, end_client_parent_name, intermediary_name, location)'

const CALENDAR_FEED_MAXIMUM_INTERVIEWS = 500

const INTERVIEW_JOB_APPLICATION_COLUMNS =
  'id, title, stack, end_client_name, end_client_parent_name, location, remote_policy, posted_daily_rate, requested_daily_rate, desired_start, duration, posting_raw_text'

const toInterview = (interviewRow: InterviewRow): Interview => ({
  id: interviewRow.id,
  jobApplicationId: interviewRow.job_application_id,
  startsAt: new Date(interviewRow.starts_at),
  kind: interviewRow.kind,
  format: interviewRow.format,
  participants: interviewRow.participants,
  notes: interviewRow.notes,
})

const toInterviewColumns = ({ startsAt, kind, format, participants, notes }: ValidatedInterviewInput) => ({
  starts_at: startsAt.toISOString(),
  kind,
  format,
  participants,
  notes,
})

export const saveNewInterview = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  interviewInput: ValidatedInterviewInput,
): Promise<ActionResult<{ id: string }>> => {
  const { data, error } = await supabase
    .from('interviews')
    .insert({ user_id: userId, job_application_id: jobApplicationId, ...toInterviewColumns(interviewInput) })
    .select('id')
    .single()
  if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION_CODE) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (error) throw toRepositoryError('saveNewInterview', error)
  return { ok: true, data: { id: data.id } }
}

export const saveInterviewChanges = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  interviewId: string,
  interviewInput: ValidatedInterviewInput,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('interviews')
    .update(toInterviewColumns(interviewInput))
    .eq('id', interviewId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('saveInterviewChanges', error)
  return data === null ? rejectWith(INTERVIEW_NOT_FOUND_MESSAGE) : { ok: true, data: null }
}

export const removeInterview = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  interviewId: string,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('interviews')
    .delete()
    .eq('id', interviewId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError('removeInterview', error)
  return data === null ? rejectWith(INTERVIEW_NOT_FOUND_MESSAGE) : { ok: true, data: null }
}

export const findInterviewsForJobApplication = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<Interview[]>> => {
  if (!(await isJobApplicationOwnedByUser(supabase, userId, jobApplicationId))) {
    return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  }
  const { data, error } = await supabase
    .from('interviews')
    .select(INTERVIEW_COLUMNS)
    .eq('user_id', userId)
    .eq('job_application_id', jobApplicationId)
    .order('starts_at', { ascending: true })
  if (error) throw toRepositoryError('findInterviewsForJobApplication', error)
  return { ok: true, data: data.map(toInterview) }
}

const findInterviewJobApplicationsByIds = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationIds: string[],
): Promise<Map<string, InterviewJobApplicationRow>> => {
  if (jobApplicationIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('job_applications_overview')
    .select(INTERVIEW_JOB_APPLICATION_COLUMNS)
    .eq('user_id', userId)
    .in('id', jobApplicationIds)
  if (error) throw toRepositoryError('findInterviewJobApplicationsByIds', error)
  return new Map(
    data.flatMap((jobApplicationRow) =>
      jobApplicationRow.id === null ? [] : [[jobApplicationRow.id, jobApplicationRow] as const],
    ),
  )
}

const toInterviewWithJobApplication = (
  interview: Interview,
  jobApplicationRow: InterviewJobApplicationRow | undefined,
): InterviewWithJobApplication[] => {
  if (jobApplicationRow === undefined || jobApplicationRow.title === null) return []
  return [
    {
      ...interview,
      jobApplicationTitle: jobApplicationRow.title,
      endClientLabel:
        jobApplicationRow.end_client_name === null
          ? null
          : formatEndClientLabel(jobApplicationRow.end_client_name, jobApplicationRow.end_client_parent_name),
      stack: parseStoredStackItems(jobApplicationRow.stack),
      location: jobApplicationRow.location,
      remotePolicy: jobApplicationRow.remote_policy,
      postedDailyRate: jobApplicationRow.posted_daily_rate,
      requestedDailyRate: jobApplicationRow.requested_daily_rate,
      desiredStart: jobApplicationRow.desired_start,
      duration: jobApplicationRow.duration,
      postingRawText: jobApplicationRow.posting_raw_text,
    },
  ]
}

const selectCalendarFeedInterviews = (supabase: FreeclutchSupabaseClient, userId: string) =>
  supabase.from('interviews').select(CALENDAR_FEED_INTERVIEW_COLUMNS).eq('user_id', userId)

type CalendarFeedInterviewRow = NonNullable<Awaited<ReturnType<typeof selectCalendarFeedInterviews>>['data']>[number]

const toCalendarFeedInterview = (interviewRow: CalendarFeedInterviewRow): CalendarFeedInterview[] => {
  const jobApplicationRow = interviewRow.job_applications_overview
  if (jobApplicationRow === null || jobApplicationRow.title === null) return []
  return [
    {
      id: interviewRow.id,
      jobApplicationId: interviewRow.job_application_id,
      startsAt: new Date(interviewRow.starts_at),
      kind: interviewRow.kind,
      format: interviewRow.format,
      participants: interviewRow.participants,
      jobApplicationTitle: jobApplicationRow.title,
      endClientLabel:
        jobApplicationRow.end_client_name === null
          ? null
          : formatEndClientLabel(jobApplicationRow.end_client_name, jobApplicationRow.end_client_parent_name),
      intermediaryName: jobApplicationRow.intermediary_name,
      jobApplicationLocation: jobApplicationRow.location,
    },
  ]
}

const findUpcomingCalendarFeedInterviewRows = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { now, to }: CalendarFeedWindow,
): Promise<CalendarFeedInterviewRow[]> => {
  const { data, error } = await selectCalendarFeedInterviews(supabase, userId)
    .gte('starts_at', now.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true })
    .limit(CALENDAR_FEED_MAXIMUM_INTERVIEWS)
  if (error) throw toRepositoryError('findUpcomingCalendarFeedInterviewRows', error)
  return data
}

const findPastCalendarFeedInterviewRows = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { from, now }: CalendarFeedWindow,
  maximumInterviews: number,
): Promise<CalendarFeedInterviewRow[]> => {
  if (maximumInterviews <= 0) return []
  const { data, error } = await selectCalendarFeedInterviews(supabase, userId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', now.toISOString())
    .order('starts_at', { ascending: false })
    .limit(maximumInterviews)
  if (error) throw toRepositoryError('findPastCalendarFeedInterviewRows', error)
  return data
}

export const findInterviewsForCalendarFeed = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  calendarFeedWindow: CalendarFeedWindow,
): Promise<CalendarFeedInterview[]> => {
  const upcomingInterviewRows = await findUpcomingCalendarFeedInterviewRows(supabase, userId, calendarFeedWindow)
  const pastInterviewRows = await findPastCalendarFeedInterviewRows(
    supabase,
    userId,
    calendarFeedWindow,
    CALENDAR_FEED_MAXIMUM_INTERVIEWS - upcomingInterviewRows.length,
  )
  return [...pastInterviewRows.reverse(), ...upcomingInterviewRows].flatMap(toCalendarFeedInterview)
}

export const findInterviewsStartingBetween = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<InterviewWithJobApplication[]> => {
  const { data, error } = await supabase
    .from('interviews')
    .select(INTERVIEW_COLUMNS)
    .eq('user_id', userId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw toRepositoryError('findInterviewsStartingBetween', error)
  const interviews = data.map(toInterview)
  const jobApplicationIds = [...new Set(interviews.map((interview) => interview.jobApplicationId))]
  const jobApplicationsById = await findInterviewJobApplicationsByIds(supabase, userId, jobApplicationIds)
  return interviews.flatMap((interview) =>
    toInterviewWithJobApplication(interview, jobApplicationsById.get(interview.jobApplicationId)),
  )
}
