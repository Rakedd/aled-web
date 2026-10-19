import 'server-only'
import {
  getOpportunityEffectiveRate,
  HIGHLIGHTED_OPPORTUNITIES_COUNT,
  HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS,
  type HighlightedOpportunities,
} from '@/domain/opportunities'
import { listOpportunitiesByIds, type OpportunitySummary } from '@/server/repositories/opportunities-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { listSummariesToProcessForUser, toListItems } from './opportunity-listing'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

const compareByEffectiveRateThenPublication = (firstSummary: OpportunitySummary, secondSummary: OpportunitySummary): number => {
  const firstRate = getOpportunityEffectiveRate(firstSummary)
  const secondRate = getOpportunityEffectiveRate(secondSummary)
  if (firstRate !== secondRate) {
    if (firstRate === null) return 1
    if (secondRate === null) return -1
    return secondRate - firstRate
  }
  const publicationDifference = secondSummary.publishedAt.getTime() - firstSummary.publishedAt.getTime()
  if (publicationDifference !== 0) return publicationDifference
  return firstSummary.id < secondSummary.id ? 1 : -1
}

export const buildHighlightedOpportunities = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<HighlightedOpportunities> => {
  const { summaries, decisions } = await listSummariesToProcessForUser(supabase, userId, now)
  const publishedSince = new Date(now.getTime() - HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS * MILLISECONDS_PER_HOUR)
  const recentSummaries = summaries.filter(({ publishedAt }) => publishedAt >= publishedSince)
  const highlightedOpportunityIds = recentSummaries
    .sort(compareByEffectiveRateThenPublication)
    .slice(0, HIGHLIGHTED_OPPORTUNITIES_COUNT)
    .map(({ id }) => id)
  const highlightedOpportunities = await listOpportunitiesByIds(supabase, highlightedOpportunityIds)
  return {
    opportunities: toListItems(highlightedOpportunityIds, highlightedOpportunities, decisions),
    recentOpportunityCount: recentSummaries.length,
  }
}
