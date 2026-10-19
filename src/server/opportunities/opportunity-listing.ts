import 'server-only'
import { cache } from 'react'
import {
  compareOpportunityListingPositions,
  HISTORY_WINDOW_DAYS,
  matchesRemoteModeQuickFilter,
  type Opportunity,
  OPPORTUNITY_PAGE_SIZE,
  OPPORTUNITY_SOURCES,
  type OpportunityDecision,
  type OpportunityListing,
  type OpportunityListingOrder,
  type OpportunityListingPosition,
  type OpportunityListingRequest,
  type OpportunityListItem,
  type OpportunityQuickFilters,
  type OpportunitySource,
  type OpportunityTab,
  type RemoteMode,
  TO_PROCESS_WINDOW_DAYS,
  toOpportunityListingPosition,
} from '@/domain/opportunities'
import {
  createOpportunityMatcher,
  EMPTY_OPPORTUNITY_FILTERS,
  normalizeForKeywordMatch,
  type OpportunityFilters,
} from '@/domain/opportunity-filters'
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

const toSortedUniquePositions = (
  positions: OpportunityListingPosition[],
  order: OpportunityListingOrder,
): OpportunityListingPosition[] =>
  [...new Map(positions.map((position) => [position.id, position])).values()].sort(
    compareOpportunityListingPositions(order),
  )

const selectSummariesToProcess = ({
  recentSummaries,
  decisions,
  filtersBySource,
}: ToProcessContext): OpportunitySummary[] => {
  const decidedOpportunityIds = new Set(decisions.map((storedDecision) => storedDecision.opportunityId))
  const matchesUserFilters = buildSourceAwareMatcher(filtersBySource)
  return recentSummaries.filter((summary) => !decidedOpportunityIds.has(summary.id) && matchesUserFilters(summary))
}

const selectPositionsToProcess = (
  toProcessContext: ToProcessContext,
  order: OpportunityListingOrder,
): OpportunityListingPosition[] =>
  toSortedUniquePositions(
    selectSummariesToProcess(toProcessContext).map(toOpportunityListingPosition),
    order,
  )

const selectDecidedPositions = (
  decisions: StoredOpportunityDecision[],
  decision: OpportunityDecision,
  publishedSince: Date,
  order: OpportunityListingOrder,
): OpportunityListingPosition[] =>
  toSortedUniquePositions(
    decisions
      .filter(
        (storedDecision) =>
          storedDecision.decision === decision && storedDecision.opportunityPublishedAt >= publishedSince,
      )
      .map((storedDecision) =>
        toOpportunityListingPosition({
          id: storedDecision.opportunityId,
          publishedAt: storedDecision.opportunityPublishedAt,
          rateMin: storedDecision.opportunityRateMin,
          rateMax: storedDecision.opportunityRateMax,
        }),
      ),
    order,
  )

const selectPositionsAfter = (
  positions: OpportunityListingPosition[],
  after: OpportunityListingPosition | null,
  order: OpportunityListingOrder,
): OpportunityListingPosition[] => {
  if (after === null) return positions
  const comparePositions = compareOpportunityListingPositions(order)
  return positions.filter((position) => comparePositions(position, after) > 0)
}

type OpportunityFacts = {
  title: string
  company: string | null
  locationLabel: string | null
  rateMin: number | null
  rateMax: number | null
  remoteMode: RemoteMode | null
}

const buildOpportunityFactsById = ({ recentSummaries, decisions }: ToProcessContext): Map<string, OpportunityFacts> =>
  new Map<string, OpportunityFacts>([
    ...decisions.map((storedDecision): [string, OpportunityFacts] => [
      storedDecision.opportunityId,
      {
        title: storedDecision.opportunityTitle,
        company: storedDecision.opportunityCompany,
        locationLabel: storedDecision.opportunityLocationLabel,
        rateMin: storedDecision.opportunityRateMin,
        rateMax: storedDecision.opportunityRateMax,
        remoteMode: storedDecision.opportunityRemoteMode,
      },
    ]),
    ...recentSummaries.map((summary): [string, OpportunityFacts] => [summary.id, summary]),
  ])

const matchesSearch = ({ title, company, locationLabel }: OpportunityFacts, normalizedSearch: string): boolean =>
  [title, company, locationLabel].some((field) => normalizeForKeywordMatch(field ?? '').includes(normalizedSearch))

const buildListingPredicate = (
  toProcessContext: ToProcessContext,
  search: string,
  { remoteModes }: OpportunityQuickFilters,
): ((position: OpportunityListingPosition) => boolean) => {
  if (search === '' && remoteModes.length === 0) return () => true
  const normalizedSearch = normalizeForKeywordMatch(search)
  const opportunityFactsById = buildOpportunityFactsById(toProcessContext)
  return ({ id }) => {
    const opportunityFacts = opportunityFactsById.get(id)
    if (opportunityFacts === undefined) return false
    return (
      matchesSearch(opportunityFacts, normalizedSearch) &&
      matchesRemoteModeQuickFilter(opportunityFacts.remoteMode, remoteModes)
    )
  }
}

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
): Promise<number> =>
  selectPositionsToProcess(await loadToProcessContextOncePerRequest(supabase, userId, now), 'publication').length

export const buildOpportunityListing = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  { tab, after, search, quickFilters }: OpportunityListingRequest,
  now: Date,
): Promise<OpportunityListing> => {
  const historyStart = addParisCalendarDays(now, -HISTORY_WINDOW_DAYS)
  const [toProcessContext, lastReceivedAt, lastViewedAt] = await Promise.all([
    loadToProcessContextOncePerRequest(supabase, userId, now),
    findLastOpportunityReceivedAt(supabase),
    findOpportunitiesLastViewedAt(supabase, userId),
  ])
  const order: OpportunityListingOrder = quickFilters.sortByRate ? 'rate' : 'publication'
  const matchesListingFilters = buildListingPredicate(toProcessContext, search, quickFilters)
  const positionsByTab: Record<OpportunityTab, OpportunityListingPosition[]> = {
    to_process: selectPositionsToProcess(toProcessContext, order).filter(matchesListingFilters),
    applied: selectDecidedPositions(toProcessContext.decisions, 'applied', historyStart, order).filter(
      matchesListingFilters,
    ),
    dismissed: selectDecidedPositions(toProcessContext.decisions, 'dismissed', historyStart, order).filter(
      matchesListingFilters,
    ),
  }
  const positionsAfterCursor = selectPositionsAfter(positionsByTab[tab], after, order)
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
