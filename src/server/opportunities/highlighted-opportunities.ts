import 'server-only'
import {
  compareOpportunityListingPositions,
  HIGHLIGHTED_OPPORTUNITIES_COUNT,
  HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS,
  type HighlightedOpportunities,
  toOpportunityListingPosition,
} from '@/domain/opportunities'
import { listOpportunitiesByIds } from '@/server/repositories/opportunities-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { listSummariesToProcessForUser, toListItems } from './opportunity-listing'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

export const buildHighlightedOpportunities = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<HighlightedOpportunities> => {
  const { summaries, decisions } = await listSummariesToProcessForUser(supabase, userId, now)
  const publishedSince = new Date(now.getTime() - HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS * MILLISECONDS_PER_HOUR)
  const recentSummaries = summaries.filter(({ publishedAt }) => publishedAt >= publishedSince)
  const highlightedOpportunityIds = recentSummaries
    .map(toOpportunityListingPosition)
    .sort(compareOpportunityListingPositions('rate'))
    .slice(0, HIGHLIGHTED_OPPORTUNITIES_COUNT)
    .map(({ id }) => id)
  const highlightedOpportunities = await listOpportunitiesByIds(supabase, highlightedOpportunityIds)
  return {
    opportunities: toListItems(highlightedOpportunityIds, highlightedOpportunities, decisions),
    recentOpportunityCount: recentSummaries.length,
  }
}
