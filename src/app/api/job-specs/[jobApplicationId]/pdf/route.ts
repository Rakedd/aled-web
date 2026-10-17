import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/domain/input-validation'
import { createJobSpecDownloadUrl } from '@/server/repositories/job-specs-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

const UNAUTHORIZED_STATUS = 401
const NOT_FOUND_STATUS = 404
const INTERNAL_ERROR_STATUS = 500
const FOUND_REDIRECT_STATUS = 302
const NO_STORE_CACHE_CONTROL = 'private, no-store'

const respondWithStatus = (status: number): NextResponse =>
  new NextResponse(null, { status, headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL } })

export const GET = async (
  _request: NextRequest,
  routeContext: RouteContext<'/api/job-specs/[jobApplicationId]/pdf'>,
): Promise<NextResponse> => {
  const { jobApplicationId } = await routeContext.params
  try {
    const supabase = await createServerSupabaseClient()
    const authenticatedUser = await findAuthenticatedUser(supabase)
    if (authenticatedUser === null) return respondWithStatus(UNAUTHORIZED_STATUS)
    if (!isUuid(jobApplicationId)) return respondWithStatus(NOT_FOUND_STATUS)
    const downloadUrlResult = await createJobSpecDownloadUrl(supabase, authenticatedUser.id, jobApplicationId)
    if (!downloadUrlResult.ok) return respondWithStatus(NOT_FOUND_STATUS)
    const redirectResponse = NextResponse.redirect(downloadUrlResult.data, FOUND_REDIRECT_STATUS)
    redirectResponse.headers.set('Cache-Control', NO_STORE_CACHE_CONTROL)
    return redirectResponse
  } catch (routeError) {
    console.error('Job spec pdf redirect failed', {
      errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
    })
    return respondWithStatus(INTERNAL_ERROR_STATUS)
  }
}
