import { NextResponse } from 'next/server'
import { isRecord } from '@/domain/input-validation'
import { TECHNICAL_BRIEF_MESSAGES, validateTechnicalBriefRequest } from '@/domain/technical-brief'
import {
  createTechnicalBriefDependencies,
  generateTechnicalBriefForUser,
} from '@/server/interview-preparation/prepare-technical-brief'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

export const maxDuration = 300

const SUCCESS_STATUS = 200
const BAD_REQUEST_STATUS = 400
const UNAUTHORIZED_STATUS = 401
const INTERNAL_ERROR_STATUS = 500
const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' }

const respondWithJson = (responseBody: unknown, status: number): NextResponse =>
  NextResponse.json(responseBody, { status, headers: NO_STORE_HEADERS })

const readJsonBodyOrNull = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const supabase = await createServerSupabaseClient()
    const authenticatedUser = await findAuthenticatedUser(supabase)
    if (authenticatedUser === null) {
      return respondWithJson({ error: TECHNICAL_BRIEF_MESSAGES.sessionExpired }, UNAUTHORIZED_STATUS)
    }
    const requestBody = await readJsonBodyOrNull(request)
    if (!isRecord(requestBody)) {
      return respondWithJson({ error: TECHNICAL_BRIEF_MESSAGES.invalidRequest }, BAD_REQUEST_STATUS)
    }
    const requestValidation = validateTechnicalBriefRequest(requestBody.jobApplicationId, requestBody.language)
    if (!requestValidation.ok) return respondWithJson({ error: requestValidation.errorMessage }, BAD_REQUEST_STATUS)
    const generationResult = await generateTechnicalBriefForUser(
      supabase,
      authenticatedUser.id,
      requestValidation.data,
      createTechnicalBriefDependencies(),
    )
    return respondWithJson(generationResult, SUCCESS_STATUS)
  } catch (routeError) {
    console.error('Technical brief route failed', {
      errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
    })
    return respondWithJson({ ok: false, errorMessage: TECHNICAL_BRIEF_MESSAGES.generationFailure }, INTERNAL_ERROR_STATUS)
  }
}
