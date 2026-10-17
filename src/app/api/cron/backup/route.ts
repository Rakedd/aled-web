import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { formatParisCalendarDate } from '@/domain/paris-time'
import { buildUserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import { fetchEveryRow } from '@/server/data-snapshot/fetch-every-row'
import { uploadBackupToGcs } from '@/server/data-snapshot/upload-backup-to-gcs'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'

export const maxDuration = 300

const UNAUTHORIZED_STATUS = 401
const INTERNAL_ERROR_STATUS = 500

const describeError = (unknownError: unknown): string =>
  unknownError instanceof Error ? unknownError.message : typeof unknownError

const hashForConstantTimeComparison = (secretCandidate: string): Buffer =>
  createHash('sha256').update(secretCandidate).digest()

const isAuthorizedCronRequest = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Backup cron rejected because CRON_SECRET is not configured')
    return false
  }
  return timingSafeEqual(
    hashForConstantTimeComparison(request.headers.get('authorization') ?? ''),
    hashForConstantTimeComparison(`Bearer ${cronSecret}`),
  )
}

const listEveryUserId = async (supabase: FreeclutchSupabaseClient): Promise<string[]> => {
  const profileRows = await fetchEveryRow('listEveryUserId', (firstRowIndex, lastRowIndex) =>
    supabase.from('profiles').select('id').order('id').range(firstRowIndex, lastRowIndex),
  )
  return profileRows.map((profileRow) => profileRow.id)
}

const backUpUserData = async (
  supabase: FreeclutchSupabaseClient,
  userId: string,
  backupCalendarDate: string,
): Promise<boolean> => {
  try {
    const userDataSnapshot = await buildUserDataSnapshot(supabase, userId)
    await uploadBackupToGcs(`backups/${backupCalendarDate}/${userId}.json`, JSON.stringify(userDataSnapshot))
    return true
  } catch (backupError) {
    console.error('User data backup failed', { userId, errorMessage: describeError(backupError) })
    return false
  }
}

const backUpEveryUserSequentially = async (
  supabase: FreeclutchSupabaseClient,
  userIds: string[],
  backupCalendarDate: string,
): Promise<boolean[]> => {
  const backupSuccesses: boolean[] = []
  for (const userId of userIds) backupSuccesses.push(await backUpUserData(supabase, userId, backupCalendarDate))
  return backupSuccesses
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: UNAUTHORIZED_STATUS })
  try {
    const supabase = createServiceRoleSupabaseClient()
    const backupCalendarDate = formatParisCalendarDate(new Date())
    const backupSuccesses = await backUpEveryUserSequentially(supabase, await listEveryUserId(supabase), backupCalendarDate)
    const failedUserCount = backupSuccesses.filter((isBackupSuccessful) => !isBackupSuccessful).length
    return NextResponse.json(
      { backedUpUserCount: backupSuccesses.length - failedUserCount, failedUserCount },
      { status: failedUserCount === 0 ? 200 : INTERNAL_ERROR_STATUS },
    )
  } catch (cronError) {
    console.error('Backup cron failed before backing up users', { errorMessage: describeError(cronError) })
    return NextResponse.json({ error: 'Backup failed' }, { status: INTERNAL_ERROR_STATUS })
  }
}
