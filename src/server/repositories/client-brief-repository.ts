import 'server-only'
import type { ActionResult } from '@/domain/action-result'
import {
  type ClientBrief,
  type EndClientBrief,
  type GeneratedClientBrief,
  isClientBriefSource,
} from '@/domain/client-brief'
import { ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { rejectWith } from '@/domain/input-validation'
import type { Json, Tables } from '@/server/supabase/database-types'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { toRepositoryError } from './repository-error'

export type EndClientBriefSubject = { endClientName: string; parentGroupName: string | null }

type EndClientBriefRow = Pick<
  Tables<'end_clients'>,
  'id' | 'notes' | 'brief_markdown' | 'brief_sources' | 'brief_generated_at'
>

const toBriefSources = (briefSourcesJson: Json | null) =>
  Array.isArray(briefSourcesJson) ? briefSourcesJson.filter(isClientBriefSource) : []

const toGeneratedClientBrief = (endClientRow: EndClientBriefRow): GeneratedClientBrief | null => {
  if (endClientRow.brief_markdown === null || endClientRow.brief_generated_at === null) return null
  return {
    markdown: endClientRow.brief_markdown,
    sources: toBriefSources(endClientRow.brief_sources),
    generatedAt: new Date(endClientRow.brief_generated_at),
  }
}

export const findEndClientBrief = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
): Promise<ActionResult<EndClientBrief>> => {
  const { data, error } = await supabase
    .from('end_clients')
    .select('id, notes, brief_markdown, brief_sources, brief_generated_at')
    .eq('id', endClientId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findEndClientBrief', error)
  if (data === null) return rejectWith(ENTITY_NOT_FOUND_MESSAGES.endClient)
  return { ok: true, data: { endClientId: data.id, notes: data.notes, brief: toGeneratedClientBrief(data) } }
}

const findEndClientName = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('end_clients')
    .select('name')
    .eq('id', endClientId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findEndClientName', error)
  return data?.name ?? null
}

export const findEndClientBriefSubject = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
): Promise<ActionResult<EndClientBriefSubject>> => {
  const { data, error } = await supabase
    .from('end_clients')
    .select('name, parent_end_client_id')
    .eq('id', endClientId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw toRepositoryError('findEndClientBriefSubject', error)
  if (data === null) return rejectWith(ENTITY_NOT_FOUND_MESSAGES.endClient)
  const parentGroupName =
    data.parent_end_client_id === null ? null : await findEndClientName(supabase, userId, data.parent_end_client_id)
  return { ok: true, data: { endClientName: data.name, parentGroupName } }
}

const updateEndClientColumns = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  operationName: string,
  columns: Pick<Tables<'end_clients'>, 'notes'> | Pick<Tables<'end_clients'>, 'brief_markdown' | 'brief_sources' | 'brief_generated_at'>,
): Promise<ActionResult<null>> => {
  const { data, error } = await supabase
    .from('end_clients')
    .update(columns)
    .eq('id', endClientId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw toRepositoryError(operationName, error)
  return data === null ? rejectWith(ENTITY_NOT_FOUND_MESSAGES.endClient) : { ok: true, data: null }
}

export const saveGeneratedEndClientBrief = (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  clientBrief: ClientBrief,
  generatedAt: Date,
): Promise<ActionResult<null>> =>
  updateEndClientColumns(supabase, userId, endClientId, 'saveGeneratedEndClientBrief', {
    brief_markdown: clientBrief.markdown,
    brief_sources: clientBrief.sources,
    brief_generated_at: generatedAt.toISOString(),
  })

export const saveEndClientNotes = (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  endClientId: string,
  notes: string | null,
): Promise<ActionResult<null>> =>
  updateEndClientColumns(supabase, userId, endClientId, 'saveEndClientNotes', { notes })
