import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildUserDataSnapshot, type UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import type { Database } from '@/server/supabase/database-types'
import { restoreUserDataSnapshot } from '../../scripts/restore-user-data-snapshot'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import {
  JOB_SPECS_BUCKET,
  seedEveryUserTable,
  STORED_API_KEY_LAST_FOUR,
  STORED_ENCRYPTED_API_KEY,
  STORED_PDF_BYTES,
  type TestUser,
} from './user-data-snapshot-fixtures'

jest.mock('server-only', () => ({}))

const USER_OWNED_TABLES_CHILDREN_FIRST = [
  'alert_snoozes',
  'job_specs',
  'interviews',
  'activity_log_entries',
  'job_applications',
  'contacts',
  'intermediaries',
  'end_clients',
] as const

const createSeededTestUser = async (): Promise<TestUser & { pdfStoragePath: string }> => {
  const testUser = await createSignedInTestClient(`data-snapshot-${randomUUID()}@test.local`)
  const { pdfStoragePath } = await seedEveryUserTable(testUser)
  return { ...testUser, pdfStoragePath }
}

const deleteEveryUserRowAndFile = async (
  serviceRoleClient: SupabaseClient<Database>,
  userId: string,
  pdfStoragePath: string,
): Promise<void> => {
  const { error: fileRemovalError } = await serviceRoleClient.storage.from(JOB_SPECS_BUCKET).remove([pdfStoragePath])
  if (fileRemovalError) throw fileRemovalError
  for (const tableName of USER_OWNED_TABLES_CHILDREN_FIRST) {
    const { error } = await serviceRoleClient.from(tableName).delete().eq('user_id', userId)
    if (error) throw error
  }
  const { error: profileDeletionError } = await serviceRoleClient.from('profiles').delete().eq('id', userId)
  if (profileDeletionError) throw profileDeletionError
}

const countRemainingUserRows = async (serviceRoleClient: SupabaseClient<Database>, userId: string): Promise<number> => {
  const remainingRowCounts = await Promise.all(
    USER_OWNED_TABLES_CHILDREN_FIRST.map(async (tableName) => {
      const { count } = await serviceRoleClient
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      return count ?? 0
    }),
  )
  return remainingRowCounts.reduce((total, rowCount) => total + rowCount, 0)
}

const downloadStoredPdfBytes = async (
  serviceRoleClient: SupabaseClient<Database>,
  pdfStoragePath: string,
): Promise<Uint8Array> => {
  const { data, error } = await serviceRoleClient.storage.from(JOB_SPECS_BUCKET).download(pdfStoragePath)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

const collectSnapshotRowOwnerIds = (snapshot: UserDataSnapshot): string[] => [
  snapshot.profile.id,
  ...[
    ...snapshot.intermediaries,
    ...snapshot.contacts,
    ...snapshot.endClients,
    ...snapshot.jobApplications,
    ...snapshot.activityLogEntries,
    ...snapshot.interviews,
    ...snapshot.jobSpecs,
    ...snapshot.alertSnoozes,
  ].map((snapshotRow) => snapshotRow.user_id),
]

const listChildEndClientsBeforeRootOnes = (endClients: UserDataSnapshot['endClients']): UserDataSnapshot['endClients'] => [
  ...endClients.filter((endClient) => endClient.parent_end_client_id !== null),
  ...endClients.filter((endClient) => endClient.parent_end_client_id === null),
]

describe('user data snapshot', () => {
  it('contains every row of the user and nothing from another user, even with the service role', async () => {
    const owner = await createSeededTestUser()
    const otherUser = await createSeededTestUser()

    const snapshot = await buildUserDataSnapshot(createServiceRoleTestClient(), owner.userId)

    expect(snapshot.formatVersion).toBe(1)
    expect(snapshot.userId).toBe(owner.userId)
    expect(new Set(collectSnapshotRowOwnerIds(snapshot))).toEqual(new Set([owner.userId]))
    expect(JSON.stringify(snapshot)).not.toContain(otherUser.userId)
    expect({
      intermediaries: snapshot.intermediaries.length,
      contacts: snapshot.contacts.length,
      endClients: snapshot.endClients.length,
      jobApplications: snapshot.jobApplications.length,
      activityLogEntries: snapshot.activityLogEntries.length,
      interviews: snapshot.interviews.length,
      jobSpecs: snapshot.jobSpecs.length,
      alertSnoozes: snapshot.alertSnoozes.length,
    }).toEqual({
      intermediaries: 1,
      contacts: 1,
      endClients: 3,
      jobApplications: 1,
      activityLogEntries: 1,
      interviews: 1,
      jobSpecs: 1,
      alertSnoozes: 1,
    })
    expect(Buffer.from(snapshot.jobSpecs[0].pdfBase64 ?? '', 'base64')).toEqual(Buffer.from(STORED_PDF_BYTES))
  })

  it('leaves the encrypted claude api key and its last four characters out of the profile', async () => {
    const owner = await createSeededTestUser()

    const snapshot = await buildUserDataSnapshot(owner.client, owner.userId)

    expect(snapshot.profile).toMatchObject({ id: owner.userId, first_name: 'Camille', follow_up_delay_days: 10 })
    expect(snapshot.profile).not.toHaveProperty('encrypted_anthropic_api_key')
    expect(snapshot.profile).not.toHaveProperty('anthropic_api_key_last_four')
    expect(JSON.stringify(snapshot)).not.toContain(STORED_ENCRYPTED_API_KEY)
    expect(JSON.stringify(snapshot)).not.toContain(STORED_API_KEY_LAST_FOUR)
  })

  it('restores every row and the pdf byte for byte after the user data was deleted, children end clients first', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)
    expect(await countRemainingUserRows(serviceRoleClient, owner.userId)).toBe(0)

    await restoreUserDataSnapshot(serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
    })

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect({ ...restoredSnapshot, exportedAt: originalSnapshot.exportedAt }).toEqual(originalSnapshot)
    expect(await downloadStoredPdfBytes(serviceRoleClient, owner.pdfStoragePath)).toEqual(STORED_PDF_BYTES)
  })

  it('restores a user who has no job application yet', async () => {
    const owner = await createSignedInTestClient(`data-snapshot-empty-${randomUUID()}@test.local`)
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await serviceRoleClient.from('profiles').delete().eq('id', owner.userId)

    await restoreUserDataSnapshot(serviceRoleClient, originalSnapshot)

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect({ ...restoredSnapshot, exportedAt: originalSnapshot.exportedAt }).toEqual(originalSnapshot)
  })

  it('recreates the account with the same id and email when the user no longer exists', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await serviceRoleClient.storage.from(JOB_SPECS_BUCKET).remove([owner.pdfStoragePath])
    const { error: userDeletionError } = await serviceRoleClient.auth.admin.deleteUser(owner.userId)
    expect(userDeletionError).toBeNull()

    await restoreUserDataSnapshot(serviceRoleClient, originalSnapshot)

    const { data: recreatedUserData } = await serviceRoleClient.auth.admin.getUserById(owner.userId)
    expect(recreatedUserData.user?.email).toBe(originalSnapshot.profile.email)
    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect({
      ...restoredSnapshot,
      exportedAt: originalSnapshot.exportedAt,
      profile: { ...restoredSnapshot.profile, updated_at: originalSnapshot.profile.updated_at },
    }).toEqual(originalSnapshot)
    expect(await downloadStoredPdfBytes(serviceRoleClient, owner.pdfStoragePath)).toEqual(STORED_PDF_BYTES)
  })

  it('refuses a snapshot holding a row of another user and writes nothing', async () => {
    const owner = await createSeededTestUser()
    const otherUser = await createSignedInTestClient(`data-snapshot-other-${randomUUID()}@test.local`)
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    const tamperedSnapshot: UserDataSnapshot = {
      ...originalSnapshot,
      profile: { ...originalSnapshot.profile, first_name: 'Modifié' },
      intermediaries: originalSnapshot.intermediaries.map((intermediary) => ({
        ...intermediary,
        user_id: otherUser.userId,
      })),
    }

    await expect(restoreUserDataSnapshot(serviceRoleClient, tamperedSnapshot)).rejects.toThrow(
      'Snapshot rows must all belong to the snapshot user',
    )

    const { data: profileAfterRefusal } = await serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })

  const PDF_LIMIT_PLUS_ONE_BYTE_BASE64 = Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')

  it.each([
    ['overwrites another user pdf', (_ownerId: string, victimPdfPath: string) => ({ storage_path: victimPdfPath })],
    [
      'escapes the owner folder with a .. segment',
      (ownerId: string, victimPdfPath: string) => ({ storage_path: `${ownerId}/../${victimPdfPath}` }),
    ],
    ['carries a pdf over 4 mb', () => ({ pdfBase64: PDF_LIMIT_PLUS_ONE_BYTE_BASE64 })],
    ['carries a pdf that is not a base64 string', () => ({ pdfBase64: 42 as unknown as string })],
  ])('refuses a snapshot whose job spec %s and writes nothing', async (_caseName, buildJobSpecTampering) => {
    const owner = await createSeededTestUser()
    const victim = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    const tamperedSnapshot: UserDataSnapshot = {
      ...originalSnapshot,
      profile: { ...originalSnapshot.profile, first_name: 'Modifié' },
      jobSpecs: originalSnapshot.jobSpecs.map((jobSpec) => ({
        ...jobSpec,
        pdfBase64: Buffer.from('%PDF-1.4 contenu falsifié').toString('base64'),
        ...buildJobSpecTampering(owner.userId, victim.pdfStoragePath),
      })),
    }

    await expect(restoreUserDataSnapshot(serviceRoleClient, tamperedSnapshot)).rejects.toThrow(
      'Snapshot job spec files must stay in the snapshot user folder and weigh at most 4 MB',
    )

    expect(await downloadStoredPdfBytes(serviceRoleClient, victim.pdfStoragePath)).toEqual(STORED_PDF_BYTES)
    expect(await downloadStoredPdfBytes(serviceRoleClient, owner.pdfStoragePath)).toEqual(STORED_PDF_BYTES)
    const { data: profileAfterRefusal } = await serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })

  it("refuses a snapshot reusing ids of another user's rows and leaves the victim rows untouched", async () => {
    const owner = await createSeededTestUser()
    const victim = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    const victimSnapshot = await buildUserDataSnapshot(serviceRoleClient, victim.userId)
    const tamperedSnapshot: UserDataSnapshot = {
      ...originalSnapshot,
      profile: { ...originalSnapshot.profile, first_name: 'Modifié' },
      interviews: originalSnapshot.interviews.map((interview) => ({
        ...interview,
        id: victimSnapshot.interviews[0].id,
        participants: 'Volé',
      })),
      alertSnoozes: originalSnapshot.alertSnoozes.map((alertSnooze) => ({
        ...alertSnooze,
        id: victimSnapshot.alertSnoozes[0].id,
      })),
    }

    await expect(restoreUserDataSnapshot(serviceRoleClient, tamperedSnapshot)).rejects.toThrow(
      'Snapshot row ids must not belong to another user',
    )

    const victimSnapshotAfterRefusal = await buildUserDataSnapshot(serviceRoleClient, victim.userId)
    expect({ ...victimSnapshotAfterRefusal, exportedAt: victimSnapshot.exportedAt }).toEqual(victimSnapshot)
    const { data: profileAfterRefusal } = await serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })
})
