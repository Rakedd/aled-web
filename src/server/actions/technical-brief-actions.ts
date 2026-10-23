'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage } from '@/domain/interview-preparation'
import { type TechnicalBriefView, validateTechnicalBriefRequest } from '@/domain/technical-brief'
import { findTechnicalBriefViewForUser } from '@/server/interview-preparation/prepare-technical-brief'
import { runAuthenticatedOperation } from './run-authenticated-operation'

const TECHNICAL_BRIEF_LOAD_FAILURE_MESSAGE =
  'Impossible de charger le brief technique pour le moment. Réessaie dans quelques minutes.'

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
