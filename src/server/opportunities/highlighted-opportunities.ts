import 'server-only'
import {
  compareOpportunityListingPositions,
  HIGHLIGHTED_OPPORTUNITIES_COUNT,
  HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS,
  type HighlightedOpportunities,
} from '@/domain/opportunities'
import { listOpportunitiesByIds } from '@/server/repositories/opportunities-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { listPositionsToProcessForUser, toListItems } from './opportunity-listing'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

export const buildHighlightedOpportunities = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  now: Date,
): Promise<HighlightedOpportunities> => {
  const { positions, decisions } = await listPositionsToProcessForUser(supabase, userId, now)
  const publishedSince = new Date(now.getTime() - HIGHLIGHTED_OPPORTUNITIES_WINDOW_HOURS * MILLISECONDS_PER_HOUR)
  const recentPositions = positions.filter(({ publishedAt }) => publishedAt >= publishedSince)
  const highlightedPositions = [...recentPositions]
    .sort(compareOpportunityListingPositions('rate'))
    .slice(0, HIGHLIGHTED_OPPORTUNITIES_COUNT)
  const highlightedOpportunities = await listOpportunitiesByIds(
    supabase,
    highlightedPositions.map(({ id }) => id),
  )
  return {
    opportunities: toListItems(highlightedPositions, highlightedOpportunities, decisions),
    recentOpportunityCount: recentPositions.length,
  }
}
