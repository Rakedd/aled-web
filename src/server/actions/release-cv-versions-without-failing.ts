import 'server-only'
import { releaseCvVersions } from '@/server/repositories/cvs-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export const releaseCvVersionsWithoutFailing = async (
  supabase: FreeclutchSupabaseClient,
  candidateVersionIds: (string | null)[],
  failureLogMessage: string,
): Promise<void> => {
  try {
    await releaseCvVersions(supabase, candidateVersionIds)
  } catch (releaseError) {
    console.error(failureLogMessage, {
      errorName: releaseError instanceof Error ? releaseError.name : typeof releaseError,
    })
  }
}
