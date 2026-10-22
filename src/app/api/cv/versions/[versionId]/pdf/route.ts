import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/domain/input-validation'
import { createCvVersionDownloadUrl } from '@/server/repositories/cvs-repository'
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
  routeContext: RouteContext<'/api/cv/versions/[versionId]/pdf'>,
): Promise<NextResponse> => {
  const { versionId } = await routeContext.params
  try {
    const supabase = await createServerSupabaseClient()
    const authenticatedUser = await findAuthenticatedUser(supabase)
    if (authenticatedUser === null) return respondWithStatus(UNAUTHORIZED_STATUS)
    if (!isUuid(versionId)) return respondWithStatus(NOT_FOUND_STATUS)
    const downloadUrlResult = await createCvVersionDownloadUrl(supabase, authenticatedUser.id, versionId)
    if (!downloadUrlResult.ok) return respondWithStatus(NOT_FOUND_STATUS)
    const redirectResponse = NextResponse.redirect(downloadUrlResult.data, FOUND_REDIRECT_STATUS)
    redirectResponse.headers.set('Cache-Control', NO_STORE_CACHE_CONTROL)
    return redirectResponse
  } catch (routeError) {
    console.error('Cv pdf redirect failed', {
      errorMessage: routeError instanceof Error ? routeError.message : typeof routeError,
    })
    return respondWithStatus(INTERNAL_ERROR_STATUS)
  }
}
