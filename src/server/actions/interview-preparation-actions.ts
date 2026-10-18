'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { validateUuid } from '@/domain/input-validation'
import { type BriefLanguage, type InterviewPreparation, validateBriefLanguage } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import {
  createInterviewPreparationDependencies,
  findInterviewPreparationForUser,
  generateInterviewPreparationForUser,
} from '@/server/interview-preparation/prepare-interview'
import { runAuthenticatedOperation } from './run-authenticated-operation'

type PreparationTarget = { jobApplicationId: string; language: BriefLanguage }

const PREPARATION_LOAD_FAILURE_MESSAGE =
  "Impossible de charger la préparation d'entretien pour le moment. Réessaie dans quelques minutes."
const PREPARATION_GENERATION_FAILURE_MESSAGE =
  "Impossible d'enregistrer la préparation d'entretien pour le moment. Réessaie dans quelques minutes."

const validatePreparationTarget = (jobApplicationId: unknown, language: unknown): ActionResult<PreparationTarget> => {
  const jobApplicationIdValidation = validateUuid(jobApplicationId, JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const languageValidation = validateBriefLanguage(language)
  if (!languageValidation.ok) return languageValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, language: languageValidation.data } }
}

export const getInterviewPreparation = async (
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<InterviewPreparation>> =>
  runAuthenticatedOperation({
    operationName: 'getInterviewPreparation',
    failureMessage: PREPARATION_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validatePreparationTarget(jobApplicationId, language),
    operation: (supabase, userId, preparationTarget) =>
      findInterviewPreparationForUser(supabase, userId, preparationTarget.jobApplicationId, preparationTarget.language),
  })

export const generateInterviewPreparation = async (
  jobApplicationId: string,
  language: BriefLanguage,
  regenerate: boolean,
): Promise<ActionResult<InterviewPreparation>> => {
  const startedAtInMilliseconds = Date.now()
  return runAuthenticatedOperation({
    operationName: 'generateInterviewPreparation',
    failureMessage: PREPARATION_GENERATION_FAILURE_MESSAGE,
    validateArguments: () => validatePreparationTarget(jobApplicationId, language),
    operation: (supabase, userId, preparationTarget) =>
      generateInterviewPreparationForUser(
        supabase,
        userId,
        { ...preparationTarget, regenerate: regenerate === true },
        createInterviewPreparationDependencies(startedAtInMilliseconds),
      ),
  })
}
