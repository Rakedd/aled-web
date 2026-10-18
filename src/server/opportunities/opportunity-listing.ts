import 'server-only'
import {
  HISTORY_WINDOW_DAYS,
  type Opportunity,
  OPPORTUNITY_PAGE_SIZE,
  OPPORTUNITY_SOURCES,
  type OpportunityDecision,
  type OpportunityListing,
  type OpportunityListingRequest,
  type OpportunityListItem,
  type OpportunitySource,
  type OpportunityTab,
  TO_PROCESS_WINDOW_DAYS,
} from '@/domain/opportunities'
import { createOpportunityMatcher, EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from '@/domain/opportunity-filters'
import { addParisCalendarDays } from '@/domain/paris-time'
import {
  findLastOpportunityReceivedAt,
  listOpportunitiesByIds,
  listOpportunitySummariesPublishedSince,
  type OpportunitySummary,
} from '@/server/repositories/opportunities-repository'
import {
  listOpportunityDecisions,
  type StoredOpportunityDecision,
} from '@/server/repositories/opportunity-decisions-repository'
import { findOpportunityFiltersBySource } from '@/server/repositories/opportunity-filters-repository'
import { findOpportunitiesLastViewedAt } from '@/server/repositories/profile-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

type ToProcessContext = {
  recentSummaries: OpportunitySummary[]
  decisions: StoredOpportunityDecision[]
  filtersBySource: Map<OpportunitySource, OpportunityFilters>
}

const loadToProcessContext = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<ToProcessContext> => {
  const [recentSummaries, decisions, filtersBySource] = await Promise.all([
    listOpportunitySummariesPublishedSince(supabase, addParisCalendarDays(now, -TO_PROCESS_WINDOW_DAYS)),
    listOpportunityDecisions(supabase, userId),
    findOpportunityFiltersBySource(supabase, userId),
  ])
  return { recentSummaries, decisions, filtersBySource }
}

const buildSourceAwareMatcher = (
  filtersBySource: Map<OpportunitySource, OpportunityFilters>,
): ((summary: OpportunitySummary) => boolean) => {
  const matcherBySource = new Map(
    OPPORTUNITY_SOURCES.map((source) => [
      source,
      createOpportunityMatcher(filtersBySource.get(source) ?? EMPTY_OPPORTUNITY_FILTERS),
    ]),
  )
  return (summary) => matcherBySource.get(summary.source)?.(summary) ?? false
}

const selectOpportunityIdsToProcess = ({ recentSummaries, decisions, filtersBySource }: ToProcessContext): string[] => {
  const decidedOpportunityIds = new Set(decisions.map((storedDecision) => storedDecision.opportunityId))
  const matchesUserFilters = buildSourceAwareMatcher(filtersBySource)
  return recentSummaries
    .filter((summary) => !decidedOpportunityIds.has(summary.id) && matchesUserFilters(summary))
    .map((summary) => summary.id)
}

const compareByPublicationDescending = (
  firstDecision: StoredOpportunityDecision,
  secondDecision: StoredOpportunityDecision,
): number =>
  secondDecision.opportunityPublishedAt.getTime() - firstDecision.opportunityPublishedAt.getTime() ||
  secondDecision.opportunityId.localeCompare(firstDecision.opportunityId)

const selectDecidedOpportunityIds = (
  decisions: StoredOpportunityDecision[],
  decision: OpportunityDecision,
  publishedSince: Date,
): string[] =>
  decisions
    .filter(
      (storedDecision) =>
        storedDecision.decision === decision && storedDecision.opportunityPublishedAt >= publishedSince,
    )
    .sort(compareByPublicationDescending)
    .map((storedDecision) => storedDecision.opportunityId)

const toListItems = (
  pageOpportunityIds: string[],
  pageOpportunities: Opportunity[],
  decisions: StoredOpportunityDecision[],
): OpportunityListItem[] => {
  const opportunitiesById = new Map(pageOpportunities.map((opportunity) => [opportunity.id, opportunity]))
  const decisionsByOpportunityId = new Map(
    decisions.map((storedDecision) => [storedDecision.opportunityId, storedDecision]),
  )
  return pageOpportunityIds.flatMap((opportunityId) => {
    const opportunity = opportunitiesById.get(opportunityId)
    if (opportunity === undefined) return []
    const storedDecision = decisionsByOpportunityId.get(opportunityId)
    return [
      {
        ...opportunity,
        decision: storedDecision?.decision ?? null,
        jobApplicationId: storedDecision?.jobApplicationId ?? null,
      },
    ]
  })
}

export const countOpportunitiesToProcessForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<number> => selectOpportunityIdsToProcess(await loadToProcessContext(supabase, userId, now)).length

export const buildOpportunityListing = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { tab, page }: OpportunityListingRequest,
  now: Date,
): Promise<OpportunityListing> => {
  const [toProcessContext, lastReceivedAt, lastViewedAt] = await Promise.all([
    loadToProcessContext(supabase, userId, now),
    findLastOpportunityReceivedAt(supabase),
    findOpportunitiesLastViewedAt(supabase, userId),
  ])
  const historyStart = addParisCalendarDays(now, -HISTORY_WINDOW_DAYS)
  const opportunityIdsByTab: Record<OpportunityTab, string[]> = {
    to_process: selectOpportunityIdsToProcess(toProcessContext),
    applied: selectDecidedOpportunityIds(toProcessContext.decisions, 'applied', historyStart),
    dismissed: selectDecidedOpportunityIds(toProcessContext.decisions, 'dismissed', historyStart),
  }
  const firstPageIndex = (page - 1) * OPPORTUNITY_PAGE_SIZE
  const nextPageIndex = firstPageIndex + OPPORTUNITY_PAGE_SIZE
  const pageOpportunityIds = opportunityIdsByTab[tab].slice(firstPageIndex, nextPageIndex)
  const pageOpportunities = await listOpportunitiesByIds(supabase, pageOpportunityIds)
  return {
    items: toListItems(pageOpportunityIds, pageOpportunities, toProcessContext.decisions),
    hasMore: opportunityIdsByTab[tab].length > nextPageIndex,
    counts: {
      to_process: opportunityIdsByTab.to_process.length,
      applied: opportunityIdsByTab.applied.length,
      dismissed: opportunityIdsByTab.dismissed.length,
    },
    lastReceivedAt,
    lastViewedAt,
  }
}
