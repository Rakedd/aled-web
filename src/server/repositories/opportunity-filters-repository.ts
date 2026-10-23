import 'server-only'
import { isOpportunitySource } from '@/domain/opportunities'
import { EMPTY_OPPORTUNITY_FILTERS, type OpportunityFilters } from '@/domain/opportunity-filters'
import type { Tables, TablesInsert } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

type OpportunityFiltersRow = Pick<
  Tables<'opportunity_filters'>,
  | 'include_keywords'
  | 'always_exclude_keywords'
  | 'rescuable_exclude_keywords'
  | 'rescue_keywords'
  | 'rate_floor_full_remote'
  | 'rate_floor_hybrid'
  | 'rate_floor_onsite'
  | 'regions'
  | 'disabled_sources'
  | 'my_skills'
>

type OpportunityFiltersColumns = Omit<TablesInsert<'opportunity_filters'>, 'id' | 'created_at' | 'updated_at'>

const OPPORTUNITY_FILTERS_COLUMNS =
  'include_keywords, always_exclude_keywords, rescuable_exclude_keywords, rescue_keywords, rate_floor_full_remote, rate_floor_hybrid, rate_floor_onsite, regions, disabled_sources, my_skills'
const FILTERS_UNIQUE_KEY_COLUMNS = 'user_id'

const toOpportunityFilters = (filtersRow: OpportunityFiltersRow): OpportunityFilters => ({
  includeKeywords: filtersRow.include_keywords,
  alwaysExcludeKeywords: filtersRow.always_exclude_keywords,
  rescuableExcludeKeywords: filtersRow.rescuable_exclude_keywords,
  rescueKeywords: filtersRow.rescue_keywords,
  rateFloorFullRemote: filtersRow.rate_floor_full_remote,
  rateFloorHybrid: filtersRow.rate_floor_hybrid,
  rateFloorOnsite: filtersRow.rate_floor_onsite,
  regions: filtersRow.regions,
  disabledSources: filtersRow.disabled_sources.filter(isOpportunitySource),
  mySkills: filtersRow.my_skills,
})

const toOpportunityFiltersColumns = (userId: string, filters: OpportunityFilters): OpportunityFiltersColumns => ({
  user_id: userId,
  include_keywords: filters.includeKeywords,
  always_exclude_keywords: filters.alwaysExcludeKeywords,
  rescuable_exclude_keywords: filters.rescuableExcludeKeywords,
  rescue_keywords: filters.rescueKeywords,
  rate_floor_full_remote: filters.rateFloorFullRemote,
  rate_floor_hybrid: filters.rateFloorHybrid,
  rate_floor_onsite: filters.rateFloorOnsite,
  regions: filters.regions,
  disabled_sources: filters.disabledSources,
  my_skills: filters.mySkills,
})

export const findOpportunityFilters = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
): Promise<OpportunityFilters> => {
  const { data, error } = await supabase
    .from('opportunity_filters')
    .select(OPPORTUNITY_FILTERS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findOpportunityFilters', error)
  return data === null ? EMPTY_OPPORTUNITY_FILTERS : toOpportunityFilters(data)
}

export const upsertOpportunityFilters = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  filters: OpportunityFilters,
): Promise<OpportunityFilters> => {
  const { data, error } = await supabase
    .from('opportunity_filters')
    .upsert(toOpportunityFiltersColumns(userId, filters), { onConflict: FILTERS_UNIQUE_KEY_COLUMNS })
    .select(OPPORTUNITY_FILTERS_COLUMNS)
    .single()
  if (error) throw toRepositoryError('upsertOpportunityFilters', error)
  return toOpportunityFilters(data)
}
