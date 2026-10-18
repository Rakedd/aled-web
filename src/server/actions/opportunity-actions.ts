'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  HISTORY_WINDOW_DAYS,
  type OpportunityListing,
  type OpportunityListingCursor,
  type OpportunitySource,
  type OpportunityTab,
  validateOpportunityId,
  validateOpportunityListingRequest,
  validateOpportunitySource,
} from '@/domain/opportunities'
import { type OpportunityFilters, validateOpportunityFilters } from '@/domain/opportunity-filters'
import { addParisCalendarDays } from '@/domain/paris-time'
import { applyToOpportunityForUser } from '@/server/opportunities/apply-to-opportunity'
import { buildOpportunityListing, countOpportunitiesToProcessForUser } from '@/server/opportunities/opportunity-listing'
import { listOpportunityRegionsPublishedSince } from '@/server/repositories/opportunities-repository'
import {
  deleteOpportunityDecision,
  upsertOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import { findOpportunityFilters, upsertOpportunityFilters } from '@/server/repositories/opportunity-filters-repository'
import { recordOpportunitiesViewedAt } from '@/server/repositories/profile-repository'
import { NO_ARGUMENTS, runAuthenticatedOperation } from './run-authenticated-operation'

const LOAD_FAILURE_MESSAGE = 'Impossible de charger les opportunités pour le moment. Réessaie dans quelques minutes.'
const APPLY_FAILURE_MESSAGE = 'Impossible de créer la candidature pour le moment. Réessaie dans quelques minutes.'
const DECISION_FAILURE_MESSAGE = "Impossible d'enregistrer ton choix pour le moment. Réessaie dans quelques minutes."
const VISIT_FAILURE_MESSAGE = "Impossible d'enregistrer ta visite pour le moment. Réessaie dans quelques minutes."
const FILTERS_LOAD_FAILURE_MESSAGE = 'Impossible de charger tes filtres pour le moment. Réessaie dans quelques minutes.'
const FILTERS_SAVE_FAILURE_MESSAGE = "Impossible d'enregistrer tes filtres pour le moment. Réessaie dans quelques minutes."

export const listOpportunities = async (
  tab: OpportunityTab,
  cursor: OpportunityListingCursor | null,
): Promise<ActionResult<OpportunityListing>> =>
  runAuthenticatedOperation({
    operationName: 'listOpportunities',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityListingRequest(tab, cursor),
    operation: async (supabase, userId, listingRequest) => ({
      ok: true,
      data: await buildOpportunityListing(supabase, userId, listingRequest, new Date()),
    }),
  })

export const countOpportunitiesToProcess = async (): Promise<ActionResult<number>> =>
  runAuthenticatedOperation({
    operationName: 'countOpportunitiesToProcess',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({
      ok: true,
      data: await countOpportunitiesToProcessForUser(supabase, userId, new Date()),
    }),
  })

export const applyToOpportunity = async (
  opportunityId: string,
): Promise<ActionResult<{ jobApplicationId: string }>> =>
  runAuthenticatedOperation({
    operationName: 'applyToOpportunity',
    failureMessage: APPLY_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityId(opportunityId),
    operation: (supabase, userId, validatedOpportunityId) =>
      applyToOpportunityForUser(supabase, userId, validatedOpportunityId, new Date()),
  })

export const dismissOpportunity = async (opportunityId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'dismissOpportunity',
    failureMessage: DECISION_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityId(opportunityId),
    operation: (supabase, userId, validatedOpportunityId) =>
      upsertOpportunityDecision(supabase, userId, {
        opportunityId: validatedOpportunityId,
        decision: 'dismissed',
        jobApplicationId: null,
      }),
  })

export const restoreOpportunity = async (opportunityId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'restoreOpportunity',
    failureMessage: DECISION_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityId(opportunityId),
    operation: async (supabase, userId, validatedOpportunityId) => {
      await deleteOpportunityDecision(supabase, userId, validatedOpportunityId)
      return { ok: true, data: null }
    },
  })

export const markOpportunitiesViewed = async (): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'markOpportunitiesViewed',
    failureMessage: VISIT_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => {
      await recordOpportunitiesViewedAt(supabase, userId, new Date())
      return { ok: true, data: null }
    },
  })

export const getOpportunityFilters = async (source: OpportunitySource): Promise<ActionResult<OpportunityFilters>> =>
  runAuthenticatedOperation({
    operationName: 'getOpportunityFilters',
    failureMessage: FILTERS_LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunitySource(source),
    operation: async (supabase, userId, validatedSource) => ({
      ok: true,
      data: await findOpportunityFilters(supabase, userId, validatedSource),
    }),
  })

export const saveOpportunityFilters = async (
  source: OpportunitySource,
  filters: unknown,
): Promise<ActionResult<OpportunityFilters>> =>
  runAuthenticatedOperation({
    operationName: 'saveOpportunityFilters',
    failureMessage: FILTERS_SAVE_FAILURE_MESSAGE,
    validateArguments: (): ActionResult<{ source: OpportunitySource; filters: OpportunityFilters }> => {
      const sourceValidation = validateOpportunitySource(source)
      if (!sourceValidation.ok) return sourceValidation
      const filtersValidation = validateOpportunityFilters(filters)
      if (!filtersValidation.ok) return filtersValidation
      return { ok: true, data: { source: sourceValidation.data, filters: filtersValidation.data } }
    },
    operation: async (supabase, userId, validatedArguments) => ({
      ok: true,
      data: await upsertOpportunityFilters(supabase, userId, validatedArguments.source, validatedArguments.filters),
    }),
  })

export const listKnownOpportunityRegions = async (): Promise<ActionResult<string[]>> =>
  runAuthenticatedOperation({
    operationName: 'listKnownOpportunityRegions',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase) => ({
      ok: true,
      data: await listOpportunityRegionsPublishedSince(supabase, addParisCalendarDays(new Date(), -HISTORY_WINDOW_DAYS)),
    }),
  })
