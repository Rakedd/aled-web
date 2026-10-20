'use server'

import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import { rejectWith } from '@/domain/input-validation'
import {
  HISTORY_WINDOW_DAYS,
  type HighlightedOpportunities,
  NO_OPPORTUNITY_QUICK_FILTERS,
  OPPORTUNITY_VALIDATION_MESSAGES,
  type OpportunityListing,
  type OpportunityListingCursor,
  type OpportunityQuickFilters,
  type OpportunityTab,
  validateOpportunityId,
  validateOpportunityListingRequest,
} from '@/domain/opportunities'
import { type OpportunityFilters, validateOpportunityFilters } from '@/domain/opportunity-filters'
import { addParisCalendarDays } from '@/domain/paris-time'
import { buildHighlightedOpportunities } from '@/server/opportunities/highlighted-opportunities'
import { applyToOpportunityForUser } from '@/server/opportunities/apply-to-opportunity'
import { buildOpportunityListing, countOpportunitiesToProcessForUser } from '@/server/opportunities/opportunity-listing'
import { listOpportunityRegionsPublishedSince } from '@/server/repositories/opportunities-repository'
import {
  deleteDismissedOpportunityDecision,
  recordDismissedOpportunityDecision,
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
  search: string,
  quickFilters: OpportunityQuickFilters = NO_OPPORTUNITY_QUICK_FILTERS,
): Promise<ActionResult<OpportunityListing>> =>
  runAuthenticatedOperation({
    operationName: 'listOpportunities',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityListingRequest(tab, cursor, search, quickFilters),
    operation: async (supabase, userId, listingRequest) => ({
      ok: true,
      data: await buildOpportunityListing(supabase, userId, listingRequest, new Date()),
    }),
  })

export const listHighlightedOpportunities = async (): Promise<ActionResult<HighlightedOpportunities>> =>
  runAuthenticatedOperation({
    operationName: 'listHighlightedOpportunities',
    failureMessage: LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({
      ok: true,
      data: await buildHighlightedOpportunities(supabase, userId, new Date()),
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
      recordDismissedOpportunityDecision(supabase, userId, validatedOpportunityId),
  })

export const restoreOpportunity = async (opportunityId: string): Promise<ActionResult<null>> =>
  runAuthenticatedOperation({
    operationName: 'restoreOpportunity',
    failureMessage: DECISION_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityId(opportunityId),
    operation: async (supabase, userId, validatedOpportunityId) =>
      (await deleteDismissedOpportunityDecision(supabase, userId, validatedOpportunityId))
        ? { ok: true, data: null }
        : rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.notDismissed),
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

export const getOpportunityFilters = async (): Promise<ActionResult<OpportunityFilters>> =>
  runAuthenticatedOperation({
    operationName: 'getOpportunityFilters',
    failureMessage: FILTERS_LOAD_FAILURE_MESSAGE,
    validateArguments: () => NO_ARGUMENTS,
    operation: async (supabase, userId) => ({
      ok: true,
      data: await findOpportunityFilters(supabase, userId),
    }),
  })

export const saveOpportunityFilters = async (filters: unknown): Promise<ActionResult<OpportunityFilters>> =>
  runAuthenticatedOperation({
    operationName: 'saveOpportunityFilters',
    failureMessage: FILTERS_SAVE_FAILURE_MESSAGE,
    validateArguments: () => validateOpportunityFilters(filters),
    operation: async (supabase, userId, validatedFilters) => ({
      ok: true,
      data: await upsertOpportunityFilters(supabase, userId, validatedFilters),
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
