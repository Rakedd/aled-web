'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { type ActivityLogEntry, type ActivityLogEntryInput, validateActivityLogEntryInput } from '@/domain/activity-log'
import { type SnoozeDurationInDays, validateSnoozeAlertArguments } from '@/domain/alert-snoozes'
import { rejectWith } from '@/domain/input-validation'
import {
  JOB_APPLICATION_NOT_FOUND_MESSAGE,
  JOB_APPLICATION_VALIDATION_MESSAGES,
  type JobApplicationInput,
  type JobApplicationListItem,
  type JobApplicationOverview,
  validateJobApplicationId,
  validateJobApplicationInput,
  validateJobApplicationUpdateInput,
} from '@/domain/job-application'
import { isJobApplicationStatus, type JobApplicationStatus } from '@/domain/job-application-status'
import type { AlertSnooze } from '@/domain/todo-alerts'
import type { AlertKind } from '@/domain/types'
import {
  listActivityLogEntriesForJobApplication,
  recordActivityLogEntry,
} from '@/server/repositories/activity-log-repository'
import { listActiveAlertSnoozes, snoozeJobApplicationAlert } from '@/server/repositories/alert-snoozes-repository'
import { findSentCvVersionId, releaseCvVersions } from '@/server/repositories/cvs-repository'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import {
  changeJobApplicationStatusRow,
  deleteJobApplicationRow,
  findJobApplicationOverview,
  insertJobApplication,
  listJobApplicationItems,
  updateJobApplicationRow,
} from '@/server/repositories/job-applications-repository'
import { findJobSpecStoragePath, removeJobSpecFile } from '@/server/repositories/job-specs-repository'
import { deleteAppliedOpportunityDecisionsOfJobApplication } from '@/server/repositories/opportunity-decisions-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { NO_ARGUMENTS, runAuthenticatedOperation } from './run-authenticated-operation'

const LOAD_FAILURE_MESSAGE = 'Impossible de charger les candidatures pour le moment. Réessaie dans quelques minutes.'
const SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer la candidature pour le moment. Réessaie dans quelques minutes."
const DELETE_FAILURE_MESSAGE = 'Impossible de supprimer la candidature pour le moment. Réessaie dans quelques minutes.'

const removeJobSpecFileWithoutFailing = async (supabase: FreeclutchSupabaseClient, storagePath: string): Promise<void> => {
  try {
    await removeJobSpecFile(supabase, storagePath)
  } catch (removalError) {
    console.error('Job spec file removal failed after job application deletion', {
      errorName: removalError instanceof Error ? removalError.name : typeof removalError,
    })
  }
}

const releaseCvVersionsWithoutFailing = async (
  supabase: FreeclutchSupabaseClient,
  candidateVersionIds: (string | null)[],
): Promise<void> => {
  try {
    await releaseCvVersions(supabase, candidateVersionIds)
  } catch (releaseError) {
    console.error('Cv version release failed after job application deletion', {
      errorName: releaseError instanceof Error ? releaseError.name : typeof releaseError,
    })
  }
}

const deleteJobApplicationWithFiles = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  jobApplicationId: string,
): Promise<ActionResult<null>> => {
  const isOwnedByUser = await isJobApplicationOwnedByUser(supabase, userId, jobApplicationId)
  if (!isOwnedByUser) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  const jobSpecStoragePath = await findJobSpecStoragePath(supabase, userId, jobApplicationId)
  const sentCvVersionId = await findSentCvVersionId(supabase, userId, jobApplicationId)
  await deleteAppliedOpportunityDecisionsOfJobApplication(supabase, userId, jobApplicationId)
  const isDeleted = await deleteJobApplicationRow(supabase, userId, jobApplicationId)
  if (!isDeleted) return rejectWith(JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (jobSpecStoragePath !== null) await removeJobSpecFileWithoutFailing(supabase, jobSpecStoragePath)
  await releaseCvVersionsWithoutFailing(supabase, [sentCvVersionId])
  return { ok: true, data: null }
}

export const listJobApplications = async (): Promise<ActionResult<JobApplicationListItem[]>> =>
  runAuthenticatedOperation({
    operationName: 'listJobApplications',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({ ok: true, data: await listJobApplicationItems(supabase, userId) }),
  })

export const getJobApplication = async (jobApplicationId: string): Promise<ActionResult<JobApplicationOverview>> =>
  runAuthenticatedOperation({
    operationName: 'getJobApplication',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: (supabase, userId, validatedJobApplicationId) =>
      findJobApplicationOverview(supabase, userId, validatedJobApplicationId),
  })

export const createJobApplication = async (input: JobApplicationInput): Promise<ActionResult<{ id: string }>> =>
  runAuthenticatedOperation({
    operationName: 'createJobApplication',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationInput(input),
    operation: (supabase, userId, validatedInput) => insertJobApplication(supabase, userId, validatedInput),
  })

export const updateJobApplication = async (
  jobApplicationId: string,
  input: Partial<JobApplicationInput>,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateJobApplication',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ jobApplicationId: string; input: Partial<JobApplicationInput> }> => {
      const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
      if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
      const inputValidation = validateJobApplicationUpdateInput(input)
      if (!inputValidation.ok) return inputValidation
      return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, input: inputValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      updateJobApplicationRow(supabase, userId, validatedArguments.jobApplicationId, validatedArguments.input),
  })

export const changeJobApplicationStatus = async (
  jobApplicationId: string,
  newStatus: JobApplicationStatus,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'changeJobApplicationStatus',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ jobApplicationId: string; newStatus: JobApplicationStatus }> => {
      const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
      if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
      if (!isJobApplicationStatus(newStatus)) {
        return { ok: false, errorMessage: JOB_APPLICATION_VALIDATION_MESSAGES.invalidStatus }
      }
      return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, newStatus } }
    },
    operation: (supabase, userId, validatedArguments) =>
      changeJobApplicationStatusRow(supabase, userId, validatedArguments.jobApplicationId, validatedArguments.newStatus),
  })

export const deleteJobApplication = async (jobApplicationId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'deleteJobApplication',
    failureMessage: DELETE_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: deleteJobApplicationWithFiles,
  })

export const addActivityLogEntry = async (
  jobApplicationId: string,
  input: ActivityLogEntryInput,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'addActivityLogEntry',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ jobApplicationId: string; input: ActivityLogEntryInput }> => {
      const jobApplicationIdValidation = validateJobApplicationId(jobApplicationId)
      if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
      const inputValidation = validateActivityLogEntryInput(input, new Date())
      if (!inputValidation.ok) return inputValidation
      return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, input: inputValidation.data } }
    },
    operation: (supabase, userId, validatedArguments) =>
      recordActivityLogEntry(supabase, userId, validatedArguments.jobApplicationId, validatedArguments.input),
  })

export const listActivityLogEntries = async (jobApplicationId: string): Promise<ActionResult<ActivityLogEntry[]>> =>
  runAuthenticatedOperation({
    operationName: 'listActivityLogEntries',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: (supabase, userId, validatedJobApplicationId) =>
      listActivityLogEntriesForJobApplication(supabase, userId, validatedJobApplicationId),
  })

export const snoozeAlert = async (
  jobApplicationId: string,
  alertKind: AlertKind,
  days: SnoozeDurationInDays,
): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'snoozeAlert',
    failureMessage: SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateSnoozeAlertArguments(jobApplicationId, alertKind, days),
    operation: (supabase, userId, validatedArguments) =>
      snoozeJobApplicationAlert(supabase, userId, validatedArguments, new Date()),
  })

export const listAlertSnoozes = async (): Promise<ActionResult<AlertSnooze[]>> =>
  runAuthenticatedOperation({
    operationName: 'listAlertSnoozes',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({ ok: true, data: await listActiveAlertSnoozes(supabase, userId, new Date()) }),
  })
