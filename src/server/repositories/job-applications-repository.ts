import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { formatStatusChangeSummary } from '@/domain/activity-log'
import { formatEndClientLabel } from '@/domain/entity-names'
import {
  isStackItem,
  JOB_APPLICATION_NOT_FOUND_MESSAGE,
  type JobApplicationInput,
  type JobApplicationListItem,
  type JobApplicationOverview,
} from '@/domain/job-application'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { formatParisCalendarDate, parseParisCalendarDate } from '@/domain/paris-time'
import type { StackItem } from '@/domain/types'
import type { Json, Tables, TablesUpdate } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { recordActivityLogEntry } from './activity-log-repository'
import { type JobApplicationEntityNames, resolveJobApplicationEntityColumns } from './entities-repository'
import { toRepositoryError } from './repository-error'

type JobApplicationOverviewRow = Tables<'job_applications_overview'>

type JobApplicationListItemRow = Omit<JobApplicationOverviewRow, 'posting_raw_text'>

type JobApplicationColumns = Omit<
  TablesUpdate<'job_applications'>,
  'id' | 'user_id' | 'status' | 'intermediary_id' | 'contact_id' | 'end_client_id' | 'created_at' | 'updated_at'
>

const JOB_APPLICATION_LIST_ITEM_COLUMNS =
  'id, user_id, title, source, posting_url, status, intermediary_id, contact_id, end_client_id, posted_daily_rate, requested_daily_rate, location, remote_policy, desired_start, duration, applied_on, notes, actual_start_date, stack, created_at, updated_at, last_activity_at, has_job_spec, intermediary_name, contact_name, end_client_name, end_client_parent_name'

const CONCURRENT_STATUS_CHANGE_MESSAGE = 'Le statut a changé entre-temps. Recharge la page et réessaie.'

const requireOverviewValue = <OverviewValue>(overviewValue: OverviewValue | null, columnName: string): OverviewValue => {
  if (overviewValue === null) throw new Error(`Job applications overview row is missing ${columnName}`)
  return overviewValue
}

const toDateOrNull = (isoDate: string | null): Date | null => (isoDate === null ? null : new Date(isoDate))

export const toStackItems = (stackJson: Json | null): StackItem[] => (Array.isArray(stackJson) ? stackJson.filter(isStackItem) : [])

const toJobApplicationListItem = (overviewRow: JobApplicationListItemRow): JobApplicationListItem => ({
  id: requireOverviewValue(overviewRow.id, 'id'),
  userId: requireOverviewValue(overviewRow.user_id, 'user_id'),
  title: requireOverviewValue(overviewRow.title, 'title'),
  source: overviewRow.source,
  postingUrl: overviewRow.posting_url,
  status: requireOverviewValue(overviewRow.status, 'status'),
  intermediaryId: overviewRow.intermediary_id,
  contactId: overviewRow.contact_id,
  endClientId: overviewRow.end_client_id,
  postedDailyRate: overviewRow.posted_daily_rate,
  requestedDailyRate: overviewRow.requested_daily_rate,
  location: overviewRow.location,
  remotePolicy: overviewRow.remote_policy,
  desiredStart: overviewRow.desired_start,
  duration: overviewRow.duration,
  appliedOn: parseParisCalendarDate(requireOverviewValue(overviewRow.applied_on, 'applied_on')),
  notes: overviewRow.notes,
  actualStartDate: overviewRow.actual_start_date === null ? null : parseParisCalendarDate(overviewRow.actual_start_date),
  stack: toStackItems(overviewRow.stack),
  createdAt: new Date(requireOverviewValue(overviewRow.created_at, 'created_at')),
  updatedAt: new Date(requireOverviewValue(overviewRow.updated_at, 'updated_at')),
  lastActivityAt: toDateOrNull(overviewRow.last_activity_at),
  hasJobSpec: overviewRow.has_job_spec ?? false,
  intermediaryName: overviewRow.intermediary_name,
  contactName: overviewRow.contact_name,
  endClientName: overviewRow.end_client_name,
  endClientParentName: overviewRow.end_client_parent_name,
  endClientLabel:
    overviewRow.end_client_name === null
      ? null
      : formatEndClientLabel(overviewRow.end_client_name, overviewRow.end_client_parent_name),
})

const toJobApplicationOverview = (overviewRow: JobApplicationOverviewRow): JobApplicationOverview => ({
  ...toJobApplicationListItem(overviewRow),
  postingRawText: overviewRow.posting_raw_text,
})

const toJobApplicationColumns = (input: Partial<JobApplicationInput>): JobApplicationColumns => ({
  title: input.title,
  source: input.source,
  posting_url: input.postingUrl,
  posting_raw_text: input.postingRawText,
  posted_daily_rate: input.postedDailyRate,
  requested_daily_rate: input.requestedDailyRate,
  location: input.location,
  remote_policy: input.remotePolicy,
  desired_start: input.desiredStart,
  duration: input.duration,
  applied_on: input.appliedOn === undefined ? undefined : formatParisCalendarDate(input.appliedOn),
  notes: input.notes,
  actual_start_date:
    input.actualStartDate === undefined || input.actualStartDate === null
      ? input.actualStartDate
      : formatParisCalendarDate(input.actualStartDate),
  stack: input.stack,
})

const hasAnyDefinedValue = (columns: Record<string, unknown>): boolean =>
  Object.values(columns).some((columnValue) => columnValue !== undefined)

export const listJobApplicationItems = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<JobApplicationListItem[]> => {
  const { data, error } = await supabase
    .from('job_applications_overview')
    .select(JOB_APPLICATION_LIST_ITEM_COLUMNS)
    .eq('user_id', userId)
    .order('applied_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw toRepositoryError('listJobApplicationItems', error)
  return data.map(toJobApplicationListItem)
}

export const findJobApplicationOverview = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<JobApplicationOverview>> => {
  const { data, error } = await supabase
    .from('job_applications_overview')
    .select('*')
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findJobApplicationOverview', error)
  if (data === null) return { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
  return { ok: true, data: toJobApplicationOverview(data) }
}

export const insertJobApplication = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  input: JobApplicationInput,
): Promise<ActionResult<{ id: string }>> => {
  const entityColumnsResolution = await resolveJobApplicationEntityColumns(supabase, userId, input)
  if (!entityColumnsResolution.ok) return entityColumnsResolution
  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      ...toJobApplicationColumns(input),
      ...entityColumnsResolution.data,
      title: input.title,
      status: input.status,
      user_id: userId,
    })
    .select('id')
    .single()
  if (error) throw toRepositoryError('insertJobApplication', error)
  return { ok: true, data: { id: data.id } }
}

const completeEntityNamesFromCurrentValues = (
  input: Partial<JobApplicationInput>,
  currentOverview: JobApplicationOverview,
): Partial<JobApplicationEntityNames> => {
  const isUpdatingContactDetailsOnly =
    input.contactName === undefined && (input.contactEmail !== undefined || input.contactPhone !== undefined)
  const isUpdatingEndClientParentOnly = input.endClientName === undefined && input.endClientParentName !== undefined
  return {
    intermediaryName: input.intermediaryName,
    contactName: isUpdatingContactDetailsOnly ? currentOverview.contactName : input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    endClientName: isUpdatingEndClientParentOnly ? currentOverview.endClientName : input.endClientName,
    endClientParentName: input.endClientParentName,
  }
}

export const changeJobApplicationStatusRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  newStatus: JobApplicationStatus,
): Promise<ActionResult<null>> => {
  const { data: currentJobApplication, error: readError } = await supabase
    .from('job_applications')
    .select('status')
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw toRepositoryError('changeJobApplicationStatusRow read', readError)
  if (currentJobApplication === null) return { ok: false, errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE }
  const previousStatus = currentJobApplication.status
  if (previousStatus === newStatus) return { ok: true, data: null }
  const { data: updatedJobApplication, error: updateError } = await supabase
    .from('job_applications')
    .update({ status: newStatus })
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
    .eq('status', previousStatus)
    .select('id')
    .maybeSingle()
  if (updateError) throw toRepositoryError('changeJobApplicationStatusRow update', updateError)
  if (updatedJobApplication === null) return { ok: false, errorMessage: CONCURRENT_STATUS_CHANGE_MESSAGE }
  return recordActivityLogEntry(supabase, userId, jobApplicationId, {
    kind: 'status_change',
    summary: formatStatusChangeSummary(previousStatus, newStatus),
  })
}

export const updateJobApplicationRow = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
  input: Partial<JobApplicationInput>,
): Promise<ActionResult<null>> => {
  const currentOverviewResult = await findJobApplicationOverview(supabase, userId, jobApplicationId)
  if (!currentOverviewResult.ok) return currentOverviewResult
  if (input.status !== undefined) {
    const statusChangeResult = await changeJobApplicationStatusRow(supabase, userId, jobApplicationId, input.status)
    if (!statusChangeResult.ok) return statusChangeResult
  }
  const entityColumnsResolution = await resolveJobApplicationEntityColumns(
    supabase,
    userId,
    completeEntityNamesFromCurrentValues(input, currentOverviewResult.data),
  )
  if (!entityColumnsResolution.ok) return entityColumnsResolution
  const columnsToUpdate = { ...toJobApplicationColumns(input), ...entityColumnsResolution.data }
  if (!hasAnyDefinedValue(columnsToUpdate)) return { ok: true, data: null }
  const { error } = await supabase
    .from('job_applications')
    .update(columnsToUpdate)
    .eq('id', jobApplicationId)
    .eq('user_id', userId)
  if (error) throw toRepositoryError('updateJobApplicationRow', error)
  return { ok: true, data: null }
}
