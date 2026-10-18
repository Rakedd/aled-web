import 'server-only'
import {
  isOpportunitySource,
  isRemoteMode,
  type Opportunity,
  type OpportunitySource,
  type RemoteMode,
} from '@/domain/opportunities'
import type { IngestMission } from '@/domain/opportunity-ingest-payload'
import { normalizeForKeywordMatch, type OpportunityMatchCandidate } from '@/domain/opportunity-filters'
import { fetchEveryRow } from '@/server/data-snapshot/fetch-every-row'
import type { Json, Tables, TablesInsert } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

export type OpportunitySummary = OpportunityMatchCandidate & {
  id: string
  source: OpportunitySource
  publishedAt: Date
}

type OpportunitySummaryRow = Pick<
  Tables<'opportunities'>,
  'id' | 'source' | 'title' | 'rate_min' | 'rate_max' | 'remote_mode' | 'region' | 'location_label' | 'published_at'
>

type OpportunityRow = Omit<Tables<'opportunities'>, 'title_normalized' | 'updated_at'>

const OPPORTUNITY_NATURAL_KEY_COLUMNS = 'source,external_id'
const OPPORTUNITY_SUMMARY_COLUMNS = 'id, source, title, rate_min, rate_max, remote_mode, region, location_label, published_at'
const OPPORTUNITY_COLUMNS =
  'id, source, external_id, url, title, company, description, rate_min, rate_max, rate_label, currency, remote_mode, location_label, region, country, duration_months, published_at, skills, received_at'

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

const toRemoteModeOrNull = (storedRemoteMode: string | null): RemoteMode | null =>
  isRemoteMode(storedRemoteMode) ? storedRemoteMode : null

const toSkills = (skillsJson: Json): string[] =>
  Array.isArray(skillsJson) ? skillsJson.filter((skill): skill is string => typeof skill === 'string') : []

const toOpportunitySummaries = (summaryRows: OpportunitySummaryRow[]): OpportunitySummary[] =>
  summaryRows.flatMap((summaryRow) => {
    const { source } = summaryRow
    if (!isOpportunitySource(source)) return []
    return [
      {
        id: summaryRow.id,
        source,
        title: summaryRow.title,
        rateMin: summaryRow.rate_min,
        rateMax: summaryRow.rate_max,
        remoteMode: toRemoteModeOrNull(summaryRow.remote_mode),
        region: summaryRow.region,
        locationLabel: summaryRow.location_label,
        publishedAt: new Date(summaryRow.published_at),
      },
    ]
  })

const toOpportunities = (opportunityRows: OpportunityRow[]): Opportunity[] =>
  opportunityRows.flatMap((opportunityRow) => {
    const { source } = opportunityRow
    if (!isOpportunitySource(source)) return []
    return [
      {
        id: opportunityRow.id,
        source,
        externalId: opportunityRow.external_id,
        url: opportunityRow.url,
        title: opportunityRow.title,
        company: opportunityRow.company,
        description: opportunityRow.description,
        rateMin: opportunityRow.rate_min,
        rateMax: opportunityRow.rate_max,
        rateLabel: opportunityRow.rate_label,
        currency: opportunityRow.currency,
        remoteMode: toRemoteModeOrNull(opportunityRow.remote_mode),
        locationLabel: opportunityRow.location_label,
        region: opportunityRow.region,
        country: opportunityRow.country,
        durationMonths: opportunityRow.duration_months,
        publishedAt: new Date(opportunityRow.published_at),
        skills: toSkills(opportunityRow.skills),
        receivedAt: new Date(opportunityRow.received_at),
      },
    ]
  })

export const listOpportunitySummariesPublishedSince = async (
  supabase: FreeclutchSupabaseClient,
  publishedSince: Date,
): Promise<OpportunitySummary[]> => {
  const summaryRows = await fetchEveryRow('listOpportunitySummariesPublishedSince', (firstRowIndex, lastRowIndex) =>
    supabase
      .from('opportunities')
      .select(OPPORTUNITY_SUMMARY_COLUMNS)
      .gte('published_at', publishedSince.toISOString())
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(firstRowIndex, lastRowIndex),
  )
  return toOpportunitySummaries(summaryRows)
}

export const listOpportunitiesByIds = async (
  supabase: FreeclutchSupabaseClient,
  opportunityIds: string[],
): Promise<Opportunity[]> => {
  if (opportunityIds.length === 0) return []
  const { data, error } = await supabase.from('opportunities').select(OPPORTUNITY_COLUMNS).in('id', opportunityIds)
  if (error) throw toRepositoryError('listOpportunitiesByIds', error)
  return toOpportunities(data)
}

export const findOpportunity = async (
  supabase: FreeclutchSupabaseClient,
  opportunityId: string,
): Promise<Opportunity | null> => {
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_COLUMNS)
    .eq('id', opportunityId)
    .maybeSingle()
  if (error) throw toRepositoryError('findOpportunity', error)
  return data === null ? null : (toOpportunities([data])[0] ?? null)
}

export const findLastOpportunityReceivedAt = async (supabase: FreeclutchSupabaseClient): Promise<Date | null> => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('received_at')
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw toRepositoryError('findLastOpportunityReceivedAt', error)
  return data === null ? null : new Date(data.received_at)
}

export const listOpportunityRegionsPublishedSince = async (
  supabase: FreeclutchSupabaseClient,
  publishedSince: Date,
): Promise<string[]> => {
  const regionRows = await fetchEveryRow('listOpportunityRegionsPublishedSince', (firstRowIndex, lastRowIndex) =>
    supabase
      .from('opportunities')
      .select('id, region')
      .gte('published_at', publishedSince.toISOString())
      .not('region', 'is', null)
      .order('id')
      .range(firstRowIndex, lastRowIndex),
  )
  const distinctRegions = new Set(
    regionRows.map((regionRow) => regionRow.region?.trim() ?? '').filter((region) => region !== ''),
  )
  return [...distinctRegions].sort((firstRegion, secondRegion) => firstRegion.localeCompare(secondRegion, 'fr'))
}
