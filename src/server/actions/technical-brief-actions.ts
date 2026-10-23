'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { validateUuid } from '@/domain/input-validation'
import { type BriefLanguage, validateBriefLanguage } from '@/domain/interview-preparation'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import type { TechnicalBriefGenerationOutcome, TechnicalBriefView } from '@/domain/technical-brief'
import {
  createTechnicalBriefDependencies,
  findTechnicalBriefViewForUser,
  generateTechnicalBriefForUser,
  type TechnicalBriefRequest,
} from '@/server/interview-preparation/prepare-technical-brief'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const TECHNICAL_BRIEF_LOAD_FAILURE_MESSAGE =
  'Impossible de charger le brief technique pour le moment. Réessaie dans quelques minutes.'
const TECHNICAL_BRIEF_GENERATION_FAILURE_MESSAGE =
  "Impossible d'enregistrer le brief technique pour le moment. Réessaie dans quelques minutes."

const validateTechnicalBriefRequest = (jobApplicationId: unknown, language: unknown): ActionResult<TechnicalBriefRequest> => {
  const jobApplicationIdValidation = validateUuid(jobApplicationId, JOB_APPLICATION_NOT_FOUND_MESSAGE)
  if (!jobApplicationIdValidation.ok) return jobApplicationIdValidation
  const languageValidation = validateBriefLanguage(language)
  if (!languageValidation.ok) return languageValidation
  return { ok: true, data: { jobApplicationId: jobApplicationIdValidation.data, language: languageValidation.data } }
}

export const getTechnicalBriefView = async (
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<TechnicalBriefView>> =>
  runAuthenticatedOperation({
    operationName: 'getTechnicalBriefView',
    failureMessage: TECHNICAL_BRIEF_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateTechnicalBriefRequest(jobApplicationId, language),
    operation: (supabase, userId, technicalBriefRequest) =>
      findTechnicalBriefViewForUser(supabase, userId, technicalBriefRequest.jobApplicationId, technicalBriefRequest.language),
  })

export const generateTechnicalBrief = async (
  jobApplicationId: string,
  language: BriefLanguage,
): Promise<ActionResult<TechnicalBriefGenerationOutcome>> =>
  runAuthenticatedOperation({
    operationName: 'generateTechnicalBrief',
    failureMessage: TECHNICAL_BRIEF_GENERATION_FAILURE_MESSAGE,
    validateArguments: () => validateTechnicalBriefRequest(jobApplicationId, language),
    operation: (supabase, userId, technicalBriefRequest) =>
      generateTechnicalBriefForUser(supabase, userId, technicalBriefRequest, createTechnicalBriefDependencies()),
  })
