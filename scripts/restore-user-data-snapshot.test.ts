/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import type { Database } from '@/server/supabase/database-types'
import { restoreUserDataSnapshot } from './restore-user-data-snapshot'

const SNAPSHOT_USER_ID = '44444444-4444-4444-8444-444444444444'

const EMPTY_SNAPSHOT: UserDataSnapshot = {
  formatVersion: 1,
  exportedAt: '2026-10-19T03:00:00.000Z',
  userId: SNAPSHOT_USER_ID,
  profile: {
    id: SNAPSHOT_USER_ID,
    first_name: null,
    last_name: null,
    email: 'restauration@test.local',
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
}

const buildFakeClient = (getUserByIdResult: { data: { user: null }; error: { status: number; code: string; message: string } }) => {
  const createUser = jest.fn()
  const from = jest.fn()
  const fakeClient = { auth: { admin: { getUserById: async () => getUserByIdResult, createUser } }, from }
  return { fakeClient: fakeClient as unknown as SupabaseClient<Database>, createUser, from }
}

describe('restoreUserDataSnapshot', () => {
  it('stops before any write when the user lookup fails for a reason other than a missing user', async () => {
    const { fakeClient, createUser, from } = buildFakeClient({
      data: { user: null },
      error: { status: 403, code: 'bad_jwt', message: 'invalid JWT' },
    })

    await expect(restoreUserDataSnapshot(fakeClient, EMPTY_SNAPSHOT)).rejects.toThrow(
      'Restore operation findUser failed: invalid JWT',
    )

    expect(createUser).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})
