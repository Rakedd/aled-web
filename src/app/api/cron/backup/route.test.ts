/** @jest-environment node */
import { NextRequest } from 'next/server'
import { buildUserDataSnapshot, type UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import { uploadBackupToGcs } from '@/server/data-snapshot/upload-backup-to-gcs'
import { createServiceRoleSupabaseClient } from '@/server/supabase/create-service-role-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { GET, maxDuration } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/server/data-snapshot/build-user-data-snapshot', () => ({ buildUserDataSnapshot: jest.fn() }))
jest.mock('@/server/data-snapshot/upload-backup-to-gcs', () => ({ uploadBackupToGcs: jest.fn() }))
jest.mock('@/server/supabase/create-service-role-supabase-client', () => ({
  createServiceRoleSupabaseClient: jest.fn(),
}))

const CRON_SECRET = 'secret-du-cron-de-test'
const FIRST_USER_ID = '11111111-1111-4111-8111-111111111111'
const SECOND_USER_ID = '22222222-2222-4222-8222-222222222222'
const THIRD_USER_ID = '33333333-3333-4333-8333-333333333333'
const BACKUP_INSTANT_IN_PARIS_NEXT_DAY = new Date('2026-10-18T22:30:00Z')

const buildFakeSnapshot = (userId: string): UserDataSnapshot => ({
  formatVersion: 1,
  exportedAt: BACKUP_INSTANT_IN_PARIS_NEXT_DAY.toISOString(),
  userId,
  profile: {
    id: userId,
    first_name: null,
    last_name: null,
    email: `${userId}@test.local`,
    links: [],
    follow_up_delay_days: 7,
    created_at: '2026-10-01T00:00:00+00:00',
    updated_at: '2026-10-01T00:00:00+00:00',
  },
  intermediaries: [],
  contacts: [],
  endClients: [],
  jobApplications: [],
  activityLogEntries: [],
  interviews: [],
  jobSpecs: [],
  alertSnoozes: [],
  opportunityFilters: [],
  opportunityDecisions: [],
  endClientBriefs: [],
  interviewQuestions: [],
  cvs: [],
  cvVersions: [],
})

const mockProfileIds = (profileIds: string[]): void => {
  const fakeServiceRoleClient = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (firstRowIndex: number, lastRowIndex: number) => ({
            data: profileIds.slice(firstRowIndex, lastRowIndex + 1).map((id) => ({ id })),
            error: null,
          }),
        }),
      }),
    }),
  }
  jest
    .mocked(createServiceRoleSupabaseClient)
    .mockReturnValue(fakeServiceRoleClient as unknown as FreeclutchSupabaseClient)
}

const requestBackup = (authorizationHeader?: string) =>
  GET(
    new NextRequest('http://localhost:3000/api/cron/backup', {
      headers: authorizationHeader === undefined ? {} : { authorization: authorizationHeader },
    }),
  )

describe('GET /api/cron/backup', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: BACKUP_INSTANT_IN_PARIS_NEXT_DAY, doNotFake: ['nextTick', 'setImmediate'] })
    process.env.CRON_SECRET = CRON_SECRET
    jest.mocked(buildUserDataSnapshot).mockImplementation(async (_supabase, userId) => buildFakeSnapshot(userId))
    jest.mocked(uploadBackupToGcs).mockResolvedValue(undefined)
    mockProfileIds([FIRST_USER_ID, SECOND_USER_ID, THIRD_USER_ID])
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    jest.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('lets the backup run for up to five minutes', () => {
    expect(maxDuration).toBe(300)
  })

  it.each([
    ['without an authorization header', undefined],
    ['with a wrong secret', 'Bearer mauvais-secret'],
    ['with the secret but no bearer scheme', CRON_SECRET],
  ])('answers 401 and backs nothing up %s', async (_caseName, authorizationHeader) => {
    const backupResponse = await requestBackup(authorizationHeader)

    expect(backupResponse.status).toBe(401)
    expect(buildUserDataSnapshot).not.toHaveBeenCalled()
    expect(uploadBackupToGcs).not.toHaveBeenCalled()
  })

  it('answers 401 when no cron secret is configured on the server', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    delete process.env.CRON_SECRET

    const backupResponse = await requestBackup('Bearer undefined')

    expect(backupResponse.status).toBe(401)
    expect(uploadBackupToGcs).not.toHaveBeenCalled()
  })

  it('uploads one backup per user under the paris calendar date', async () => {
    const backupResponse = await requestBackup(`Bearer ${CRON_SECRET}`)

    expect(backupResponse.status).toBe(200)
    expect(await backupResponse.json()).toEqual({ backedUpUserCount: 3, failedUserCount: 0 })
    expect(uploadBackupToGcs).toHaveBeenCalledTimes(3)
    expect(jest.mocked(uploadBackupToGcs).mock.calls.map(([objectKey]) => objectKey)).toEqual([
      `backups/2026-10-19/${FIRST_USER_ID}.json`,
      `backups/2026-10-19/${SECOND_USER_ID}.json`,
      `backups/2026-10-19/${THIRD_USER_ID}.json`,
    ])
    expect(JSON.parse(jest.mocked(uploadBackupToGcs).mock.calls[1][1])).toEqual(buildFakeSnapshot(SECOND_USER_ID))
  })

  it('backs up every user even when the profiles span several pages', async () => {
    const manyUserIds = Array.from({ length: 1501 }, (_unused, userIndex) => `user-${String(userIndex).padStart(4, '0')}`)
    mockProfileIds(manyUserIds)

    const backupResponse = await requestBackup(`Bearer ${CRON_SECRET}`)

    expect(await backupResponse.json()).toEqual({ backedUpUserCount: 1501, failedUserCount: 0 })
    expect(jest.mocked(uploadBackupToGcs).mock.calls.map(([objectKey]) => objectKey)).toEqual(
      manyUserIds.map((userId) => `backups/2026-10-19/${userId}.json`),
    )
  })

  it('keeps backing up the other users when one fails and logs only the user id and error message', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest
      .mocked(buildUserDataSnapshot)
      .mockImplementation(async (_supabase, userId) =>
        userId === FIRST_USER_ID ? Promise.reject(new Error('Repository failed')) : buildFakeSnapshot(userId),
      )

    const backupResponse = await requestBackup(`Bearer ${CRON_SECRET}`)

    expect(backupResponse.status).toBe(500)
    expect(await backupResponse.json()).toEqual({ backedUpUserCount: 2, failedUserCount: 1 })
    expect(jest.mocked(uploadBackupToGcs).mock.calls.map(([objectKey]) => objectKey)).toEqual([
      `backups/2026-10-19/${SECOND_USER_ID}.json`,
      `backups/2026-10-19/${THIRD_USER_ID}.json`,
    ])
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('User data backup failed', {
      userId: FIRST_USER_ID,
      errorMessage: 'Repository failed',
    })
  })

  it('logs a failed upload and still uploads the next users', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest
      .mocked(uploadBackupToGcs)
      .mockImplementation(async (objectKey) =>
        objectKey.includes(SECOND_USER_ID) ? Promise.reject(new Error('Precondition failed')) : undefined,
      )

    const backupResponse = await requestBackup(`Bearer ${CRON_SECRET}`)

    expect(await backupResponse.json()).toEqual({ backedUpUserCount: 2, failedUserCount: 1 })
    expect(uploadBackupToGcs).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith('User data backup failed', {
      userId: SECOND_USER_ID,
      errorMessage: 'Precondition failed',
    })
  })
})
