'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { isValidDate, rejectWith, validateUuid } from '@/domain/input-validation'
import {
  INTERVIEW_NOT_FOUND_MESSAGE,
  INTERVIEW_VALIDATION_MESSAGES,
  type Interview,
  type InterviewInput,
  type InterviewWithJobApplication,
  type ValidatedInterviewInput,
  validateInterviewInput,
} from '@/domain/interviews'
import { validateJobApplicationId } from '@/domain/job-application'
import {
  findInterviewsForJobApplication,
  findInterviewsStartingBetween,
  removeInterview,
  saveInterviewChanges,
  saveNewInterview,
} from '@/server/repositories/interviews-repository'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const INTERVIEWS_LOAD_FAILURE_MESSAGE = 'Impossible de charger les entretiens pour le moment. Réessaie dans quelques minutes.'
const INTERVIEW_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer l'entretien pour le moment. Réessaie dans quelques minutes."
const INTERVIEW_DELETE_FAILURE_MESSAGE = "Impossible de supprimer l'entretien pour le moment. Réessaie dans quelques minutes."

type IdentifiedInterviewInput = { id: string; interviewInput: ValidatedInterviewInput }

const validateInterviewId = (interviewId: unknown): ActionResult<string> =>
  validateUuid(interviewId, INTERVIEW_NOT_FOUND_MESSAGE)

const validateIdentifiedInterviewInput = (
  idValidation: ActionResult<string>,
  input: unknown,
): ActionResult<IdentifiedInterviewInput> => {
  if (!idValidation.ok) return idValidation
  const interviewInputValidation = validateInterviewInput(input)
  if (!interviewInputValidation.ok) return interviewInputValidation
  return { ok: true, data: { id: idValidation.data, interviewInput: interviewInputValidation.data } }
}

const validatePeriod = (from: unknown, to: unknown): ActionResult<{ from: Date; to: Date }> =>
  isValidDate(from) && isValidDate(to) && from <= to
    ? { ok: true, data: { from, to } }
    : rejectWith(INTERVIEW_VALIDATION_MESSAGES.invalidPeriod)

export const createInterview = async (
  jobApplicationId: string,
  input: InterviewInput,
): Promise<ActionResult<{ id: string }>> =>
  runAuthenticatedOperation({
    operationName: 'createInterview',
    failureMessage: INTERVIEW_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateIdentifiedInterviewInput(validateJobApplicationId(jobApplicationId), input),
    operation: (supabase, userId, validatedArguments) =>
      saveNewInterview(supabase, userId, validatedArguments.id, validatedArguments.interviewInput),
  })

export const updateInterview = async (interviewId: string, input: InterviewInput): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'updateInterview',
    failureMessage: INTERVIEW_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateIdentifiedInterviewInput(validateInterviewId(interviewId), input),
    operation: (supabase, userId, validatedArguments) =>
      saveInterviewChanges(supabase, userId, validatedArguments.id, validatedArguments.interviewInput),
  })

export const deleteInterview = async (interviewId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'deleteInterview',
    failureMessage: INTERVIEW_DELETE_FAILURE_MESSAGE,
    validateArguments: () => validateInterviewId(interviewId),
    operation: (supabase, userId, validatedInterviewId) => removeInterview(supabase, userId, validatedInterviewId),
  })

export const listInterviewsForJobApplication = async (jobApplicationId: string): Promise<ActionResult<Interview[]>> =>
  runAuthenticatedOperation({
    operationName: 'listInterviewsForJobApplication',
    failureMessage: INTERVIEWS_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateJobApplicationId(jobApplicationId),
    operation: (supabase, userId, validatedJobApplicationId) =>
      findInterviewsForJobApplication(supabase, userId, validatedJobApplicationId),
  })

export const listUpcomingInterviews = async (
  from: Date,
  to: Date,
): Promise<ActionResult<InterviewWithJobApplication[]>> =>
  runAuthenticatedOperation({
    operationName: 'listUpcomingInterviews',
    failureMessage: INTERVIEWS_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validatePeriod(from, to),
    operation: async (supabase, userId, period) => ({
      ok: true,
      data: await findInterviewsStartingBetween(supabase, userId, period.from, period.to),
    }),
  })
