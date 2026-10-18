import 'server-only'
import { cache } from 'react'
import {
  HISTORY_WINDOW_DAYS,
  type Opportunity,
  OPPORTUNITY_PAGE_SIZE,
  OPPORTUNITY_SOURCES,
  type OpportunityDecision,
  type OpportunityListing,
  type OpportunityListingPosition,
  type OpportunityListingRequest,
  type OpportunityListItem,
  type OpportunitySource,
  type OpportunityTab,
  TO_PROCESS_WINDOW_DAYS,
} from '@/domain/opportunities'
import { createOpportunityMatcher, EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from '@/domain/opportunity-filters'
import { addParisCalendarDays, formatParisCalendarDate } from '@/domain/paris-time'
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

const getRequestScopedToProcessContexts = cache(() => new Map<string, Promise<ToProcessContext>>())

const loadToProcessContextOncePerRequest = (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<ToProcessContext> => {
  const toProcessContexts = getRequestScopedToProcessContexts()
  const contextKey = `${userId}:${formatParisCalendarDate(now)}`
  const loadingContext = toProcessContexts.get(contextKey) ?? loadToProcessContext(supabase, userId, now)
  toProcessContexts.set(contextKey, loadingContext)
  return loadingContext
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

const compareByPublicationDescending = (
  firstPosition: OpportunityListingPosition,
  secondPosition: OpportunityListingPosition,
): number => {
  const publicationDifference = secondPosition.publishedAt.getTime() - firstPosition.publishedAt.getTime()
  if (publicationDifference !== 0) return publicationDifference
  if (firstPosition.id === secondPosition.id) return 0
  return firstPosition.id < secondPosition.id ? 1 : -1
}

const toSortedUniquePositions = (positions: OpportunityListingPosition[]): OpportunityListingPosition[] =>
  [...new Map(positions.map((position) => [position.id, position])).values()].sort(compareByPublicationDescending)

const selectSummariesToProcess = ({
  recentSummaries,
  decisions,
  filtersBySource,
}: ToProcessContext): OpportunitySummary[] => {
  const decidedOpportunityIds = new Set(decisions.map((storedDecision) => storedDecision.opportunityId))
  const matchesUserFilters = buildSourceAwareMatcher(filtersBySource)
  return recentSummaries.filter((summary) => !decidedOpportunityIds.has(summary.id) && matchesUserFilters(summary))
}

const selectPositionsToProcess = (toProcessContext: ToProcessContext): OpportunityListingPosition[] =>
  toSortedUniquePositions(
    selectSummariesToProcess(toProcessContext).map(({ id, publishedAt }) => ({ id, publishedAt })),
  )

const selectDecidedPositions = (
  decisions: StoredOpportunityDecision[],
  decision: OpportunityDecision,
  publishedSince: Date,
): OpportunityListingPosition[] =>
  toSortedUniquePositions(
    decisions
      .filter(
        (storedDecision) =>
          storedDecision.decision === decision && storedDecision.opportunityPublishedAt >= publishedSince,
      )
      .map((storedDecision) => ({ id: storedDecision.opportunityId, publishedAt: storedDecision.opportunityPublishedAt })),
  )

const selectPositionsAfter = (
  positions: OpportunityListingPosition[],
  after: OpportunityListingPosition | null,
): OpportunityListingPosition[] =>
  after === null ? positions : positions.filter((position) => compareByPublicationDescending(position, after) > 0)

export const toListItems = (
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

export const listSummariesToProcessForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<{ summaries: OpportunitySummary[]; decisions: StoredOpportunityDecision[] }> => {
  const toProcessContext = await loadToProcessContextOncePerRequest(supabase, userId, now)
  return { summaries: selectSummariesToProcess(toProcessContext), decisions: toProcessContext.decisions }
}

export const countOpportunitiesToProcessForUser = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<number> => selectPositionsToProcess(await loadToProcessContextOncePerRequest(supabase, userId, now)).length

export const buildOpportunityListing = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { tab, after }: OpportunityListingRequest,
  now: Date,
): Promise<OpportunityListing> => {
  const [toProcessContext, lastReceivedAt, lastViewedAt] = await Promise.all([
    loadToProcessContextOncePerRequest(supabase, userId, now),
    findLastOpportunityReceivedAt(supabase),
    findOpportunitiesLastViewedAt(supabase, userId),
  ])
  const historyStart = addParisCalendarDays(now, -HISTORY_WINDOW_DAYS)
  const positionsByTab: Record<OpportunityTab, OpportunityListingPosition[]> = {
    to_process: selectPositionsToProcess(toProcessContext),
    applied: selectDecidedPositions(toProcessContext.decisions, 'applied', historyStart),
    dismissed: selectDecidedPositions(toProcessContext.decisions, 'dismissed', historyStart),
  }
  const positionsAfterCursor = selectPositionsAfter(positionsByTab[tab], after)
  const pageOpportunityIds = positionsAfterCursor.slice(0, OPPORTUNITY_PAGE_SIZE).map(({ id }) => id)
  const pageOpportunities = await listOpportunitiesByIds(supabase, pageOpportunityIds)
  return {
    items: toListItems(pageOpportunityIds, pageOpportunities, toProcessContext.decisions),
    hasMore: positionsAfterCursor.length > OPPORTUNITY_PAGE_SIZE,
    counts: {
      to_process: positionsByTab.to_process.length,
      applied: positionsByTab.applied.length,
      dismissed: positionsByTab.dismissed.length,
    },
    lastReceivedAt,
    lastViewedAt,
  }
}
