import 'server-only'
import type { IngestMission } from '@/domain/opportunity-ingest-payload'
import { normalizeForKeywordMatch } from '@/domain/opportunity-filters'
import type { TablesInsert } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

const OPPORTUNITY_NATURAL_KEY_COLUMNS = 'source,external_id'

const toOpportunityRow = (mission: IngestMission): TablesInsert<'opportunities'> => ({
  source: mission.source,
  external_id: mission.id,
  url: mission.url,
  title: mission.title,
  title_normalized: normalizeForKeywordMatch(mission.title),
  company: mission.company,
  description: mission.description,
  rate_min: mission.rateMin,
  rate_max: mission.rateMax,
  rate_label: mission.rateLabel,
  currency: mission.currency,
  remote_mode: mission.remoteMode,
  location_label: mission.locationLabel,
  region: mission.region,
  country: mission.country,
  duration_months: mission.durationMonths,
  published_at: mission.publishedAt.toISOString(),
  skills: mission.skills,
})

const keepLastMissionPerNaturalKey = (missions: IngestMission[]): IngestMission[] => [
  ...new Map(missions.map((mission) => [JSON.stringify([mission.source, mission.id]), mission])).values(),
]

export const upsertOpportunities = async (
  serviceClient: FreeclutchSupabaseClient,
  missions: IngestMission[],
): Promise<number> => {
  const uniqueMissions = keepLastMissionPerNaturalKey(missions)
  if (uniqueMissions.length === 0) return 0
  const { count, error } = await serviceClient
    .from('opportunities')
    .upsert(uniqueMissions.map(toOpportunityRow), { onConflict: OPPORTUNITY_NATURAL_KEY_COLUMNS, count: 'exact' })
  if (error) throw toRepositoryError('upsertOpportunities', error)
  return count ?? 0
}

export const purgeOpportunitiesPublishedBefore = async (
  serviceClient: FreeclutchSupabaseClient,
  cutoff: Date,
): Promise<number> => {
  const { count, error } = await serviceClient
    .from('opportunities')
    .delete({ count: 'exact' })
    .lt('published_at', cutoff.toISOString())
  if (error) throw toRepositoryError('purgeOpportunitiesPublishedBefore', error)
  return count ?? 0
}
