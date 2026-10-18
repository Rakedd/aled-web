import { NextResponse } from 'next/server'
import { HISTORY_WINDOW_DAYS } from '@/domain/opportunities'
import { parseIngestPayload } from '@/domain/opportunity-ingest-payload'
import { addParisCalendarDays } from '@/domain/paris-time'
import {
  purgeOpportunitiesPublishedBefore,
  upsertOpportunities,
} from '@/server/repositories/opportunities-repository'
import { isAuthorizedBearerRequest } from '@/server/security/is-authorized-bearer-request'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export const maxDuration = 60

const BAD_REQUEST_STATUS = 400
const UNAUTHORIZED_STATUS = 401
const UNPROCESSABLE_STATUS = 422
const INTERNAL_ERROR_STATUS = 500

const describeError = (unknownError: unknown): string =>
  unknownError instanceof Error ? unknownError.message : typeof unknownError

const isAuthorizedIngestRequest = (request: Request): boolean => {
  const ingestToken = process.env.OPPORTUNITIES_INGEST_TOKEN
  if (!ingestToken) console.error('Opportunities ingest rejected because OPPORTUNITIES_INGEST_TOKEN is not configured')
  return isAuthorizedBearerRequest(request, ingestToken)
}

const purgeExpiredOpportunities = async (serviceClient: FreeclutchSupabaseClient): Promise<number> => {
  try {
    return await purgeOpportunitiesPublishedBefore(serviceClient, addParisCalendarDays(new Date(), -HISTORY_WINDOW_DAYS))
  } catch (purgeError) {
    console.error('Opportunities purge failed', { errorMessage: describeError(purgeError) })
    return 0
  }
}

const readJsonBody = async (request: Request): Promise<{ body: unknown } | null> => {
  try {
    return { body: await request.json() }
  } catch {
    return null
  }
}

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isAuthorizedIngestRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: UNAUTHORIZED_STATUS })
  const jsonBody = await readJsonBody(request)
  if (jsonBody === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: BAD_REQUEST_STATUS })
  const parsedPayload = parseIngestPayload(jsonBody.body)
  if ('error' in parsedPayload) return NextResponse.json({ error: parsedPayload.error }, { status: BAD_REQUEST_STATUS })
  const { missions, skippedInvalid } = parsedPayload
  const received = missions.length + skippedInvalid
  if (skippedInvalid > 0) console.warn('Opportunities ingest skipped invalid missions', { skippedInvalid })
  if (missions.length === 0 && skippedInvalid > 0) {
    return NextResponse.json(
      { error: 'Every mission of the batch is invalid', received, skippedInvalid },
      { status: UNPROCESSABLE_STATUS },
    )
  }
  try {
    const serviceClient = createServiceRoleSupabaseClient()
    const upserted = await upsertOpportunities(serviceClient, missions)
    const purged = await purgeExpiredOpportunities(serviceClient)
    return NextResponse.json({ received, upserted, skippedInvalid, purged })
  } catch (ingestError) {
    console.error('Opportunities ingest failed', { errorMessage: describeError(ingestError) })
    return NextResponse.json({ error: 'Ingest failed' }, { status: INTERNAL_ERROR_STATUS })
  }
}
