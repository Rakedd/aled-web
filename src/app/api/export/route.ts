import { NextResponse } from 'next/server'
import { formatParisCalendarDate } from '@/domain/paris-time'
import { buildUserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { findAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

const UNAUTHORIZED_STATUS = 401
const INTERNAL_ERROR_STATUS = 500
const NO_STORE_CACHE_CONTROL = 'private, no-store'
const STREAM_CHUNK_SIZE_IN_BYTES = 1024 * 1024

const respondWithStatus = (status: number): NextResponse =>
  new NextResponse(null, { status, headers: { 'Cache-Control': NO_STORE_CACHE_CONTROL } })

const streamTextInChunks = (text: string): ReadableStream<Uint8Array> => {
  const encodedText = new TextEncoder().encode(text)
  return new ReadableStream({
    start: (streamController) => {
      for (let chunkStart = 0; chunkStart < encodedText.length; chunkStart += STREAM_CHUNK_SIZE_IN_BYTES) {
        streamController.enqueue(encodedText.subarray(chunkStart, chunkStart + STREAM_CHUNK_SIZE_IN_BYTES))
      }
      streamController.close()
    },
  })
}

export const GET = async (): Promise<NextResponse> => {
  try {
    const supabase = await createServerSupabaseClient()
    const authenticatedUser = await findAuthenticatedUser(supabase)
    if (authenticatedUser === null) return respondWithStatus(UNAUTHORIZED_STATUS)
    const userDataSnapshot = await buildUserDataSnapshot(supabase, authenticatedUser.id)
    const exportFileName = `freeclutch-export-${formatParisCalendarDate(new Date())}.json`
    return new NextResponse(streamTextInChunks(JSON.stringify(userDataSnapshot, null, 2)), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFileName}"`,
        'Cache-Control': NO_STORE_CACHE_CONTROL,
      },
    })
  } catch (exportError) {
    console.error('User data export failed', {
      errorMessage: exportError instanceof Error ? exportError.message : typeof exportError,
    })
    return respondWithStatus(INTERNAL_ERROR_STATUS)
  }
}
