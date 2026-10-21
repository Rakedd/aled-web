import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JOB_SPECS_BUCKET } from '@/domain/job-spec'
import { buildUserDataSnapshot, type UserDataSnapshot } from '@/server/data-snapshot/build-user-data-snapshot'
import type { Database } from '@/server/supabase/database-types'
import { parseUserDataSnapshot, restoreUserDataSnapshot } from '../../scripts/restore-user-data-snapshot'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import {
  seedEveryUserTable,
  STORED_API_KEY_LAST_FOUR,
  STORED_ENCRYPTED_API_KEY,
  STORED_PDF_BYTES,
  type TestUser,
} from './user-data-snapshot-fixtures'

jest.mock('server-only', () => ({}))

const USER_OWNED_TABLES_CHILDREN_FIRST = [
  'opportunity_decisions',
  'opportunity_filters',
  'interview_questions',
  'end_client_briefs',
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
    ...snapshot.opportunityFilters,
    ...snapshot.endClientBriefs,
    ...snapshot.interviewQuestions,
  ].map((snapshotRow) => snapshotRow.user_id),
]

const removeBriefIds = (endClientBriefs: UserDataSnapshot['endClientBriefs']) =>
  endClientBriefs.map((endClientBrief) => ({ ...endClientBrief, id: undefined }))

const buildSnapshotWrittenBeforeBriefsByLanguage = (currentSnapshot: UserDataSnapshot): unknown => {
  const earlierSnapshot: Partial<UserDataSnapshot> = { ...currentSnapshot }
  delete earlierSnapshot.endClientBriefs
  delete earlierSnapshot.interviewQuestions
  return JSON.parse(JSON.stringify(earlierSnapshot))
}

const listChildEndClientsBeforeRootOnes = (endClients: UserDataSnapshot['endClients']): UserDataSnapshot['endClients'] => [
  ...endClients.filter((endClient) => endClient.parent_end_client_id !== null),
  ...endClients.filter((endClient) => endClient.parent_end_client_id === null),
]

type SeededOpportunities = { keptOpportunityExternalId: string; vanishingOpportunityExternalId: string; source: string }

const insertOpportunity = async (
  serviceRoleClient: SupabaseClient<Database>,
  source: string,
  externalId: string,
): Promise<string> => {
  const { data, error } = await serviceRoleClient
    .from('opportunities')
    .insert({
      source,
      external_id: externalId,
      url: `https://opportunities.example/${externalId}`,
      title: `Mission ${externalId}`,
      title_normalized: `mission ${externalId}`,
      published_at: '2026-10-15T08:00:00+00:00',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const seedOpportunityFiltersAndDecisions = async (
  serviceRoleClient: SupabaseClient<Database>,
  { client, userId }: TestUser,
  jobApplicationId: string,
): Promise<SeededOpportunities> => {
  const source = `snapshot-source-${randomUUID()}`
  const keptOpportunityExternalId = `kept-${randomUUID()}`
  const vanishingOpportunityExternalId = `vanishing-${randomUUID()}`
  const keptOpportunityId = await insertOpportunity(serviceRoleClient, source, keptOpportunityExternalId)
  const vanishingOpportunityId = await insertOpportunity(serviceRoleClient, source, vanishingOpportunityExternalId)
  const { error: filterError } = await client.from('opportunity_filters').insert({
    user_id: userId,
    disabled_sources: ['collective'],
    include_keywords: ['react'],
    always_exclude_keywords: ['stage'],
    regions: ['Île-de-France'],
    rate_floor_full_remote: 500,
  })
  if (filterError) throw filterError
  const { error: decisionError } = await client.from('opportunity_decisions').insert([
    {
      user_id: userId,
      opportunity_id: keptOpportunityId,
      decision: 'applied',
      job_application_id: jobApplicationId,
      decided_at: '2026-10-16T09:00:00+00:00',
    },
    {
      user_id: userId,
      opportunity_id: vanishingOpportunityId,
      decision: 'dismissed',
      decided_at: '2026-10-16T10:00:00+00:00',
    },
  ])
  if (decisionError) throw decisionError
  return { keptOpportunityExternalId, vanishingOpportunityExternalId, source }
}

const createSeededUserWithOpportunities = async () => {
  const serviceRoleClient = createServiceRoleTestClient()
  const testUser = await createSignedInTestClient(`data-snapshot-${randomUUID()}@test.local`)
  const { pdfStoragePath, jobApplicationId } = await seedEveryUserTable(testUser)
  const seededOpportunities = await seedOpportunityFiltersAndDecisions(serviceRoleClient, testUser, jobApplicationId)
  return { ...testUser, pdfStoragePath, jobApplicationId, seededOpportunities, serviceRoleClient }
}

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
      endClientBriefs: snapshot.endClientBriefs.length,
      interviewQuestions: snapshot.interviewQuestions.length,
    }).toEqual({
      intermediaries: 1,
      contacts: 1,
      endClients: 3,
      jobApplications: 1,
      activityLogEntries: 2,
      interviews: 1,
      jobSpecs: 1,
      alertSnoozes: 1,
      endClientBriefs: 1,
      interviewQuestions: 1,
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

  it('exports the opportunity filters and the decisions keyed by mission, and nothing from another user', async () => {
    const owner = await createSeededUserWithOpportunities()
    const otherUser = await createSeededUserWithOpportunities()

    const snapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)

    expect(snapshot.opportunityFilters).toHaveLength(1)
    expect(snapshot.opportunityFilters[0]).toMatchObject({
      user_id: owner.userId,
      disabled_sources: ['collective'],
      include_keywords: ['react'],
    })
    expect(snapshot.opportunityDecisions).toEqual(
      expect.arrayContaining([
        {
          source: owner.seededOpportunities.source,
          externalId: owner.seededOpportunities.keptOpportunityExternalId,
          decision: 'applied',
          jobApplicationId: owner.jobApplicationId,
          decidedAt: '2026-10-16T09:00:00+00:00',
        },
        {
          source: owner.seededOpportunities.source,
          externalId: owner.seededOpportunities.vanishingOpportunityExternalId,
          decision: 'dismissed',
          jobApplicationId: null,
          decidedAt: '2026-10-16T10:00:00+00:00',
        },
      ]),
    )
    expect(snapshot.opportunityDecisions).toHaveLength(2)
    expect(JSON.stringify(snapshot)).not.toContain(otherUser.userId)
    expect(JSON.stringify(snapshot)).not.toContain(otherUser.seededOpportunities.source)
    expect(snapshot.profile).not.toHaveProperty('opportunities_last_viewed_at')
  })

  it('restores the opportunity filters and decisions identically after the user data was deleted', async () => {
    const owner = await createSeededUserWithOpportunities()
    const originalSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(owner.serviceRoleClient, owner.userId, owner.pdfStoragePath)

    const { skippedOpportunityDecisionCount } = await restoreUserDataSnapshot(owner.serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
    })

    expect(skippedOpportunityDecisionCount).toBe(0)
    const restoredSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)
    expect({ ...restoredSnapshot, exportedAt: originalSnapshot.exportedAt }).toEqual(originalSnapshot)
    expect(restoredSnapshot.opportunityDecisions).toHaveLength(2)
  })

  it('skips a decision whose mission no longer exists without failing the restoration', async () => {
    const owner = await createSeededUserWithOpportunities()
    const originalSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(owner.serviceRoleClient, owner.userId, owner.pdfStoragePath)
    const { error: opportunityDeletionError } = await owner.serviceRoleClient
      .from('opportunities')
      .delete()
      .eq('source', owner.seededOpportunities.source)
      .eq('external_id', owner.seededOpportunities.vanishingOpportunityExternalId)
    expect(opportunityDeletionError).toBeNull()

    const { skippedOpportunityDecisionCount } = await restoreUserDataSnapshot(owner.serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
    })

    expect(skippedOpportunityDecisionCount).toBe(1)
    const restoredSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)
    expect(restoredSnapshot.opportunityDecisions).toEqual(
      originalSnapshot.opportunityDecisions.filter(
        (decision) => decision.externalId === owner.seededOpportunities.keptOpportunityExternalId,
      ),
    )
    expect(restoredSnapshot.opportunityFilters).toEqual(originalSnapshot.opportunityFilters)
  })

  it('refuses an opportunity filter of another user and a reused filter id, writing nothing', async () => {
    const owner = await createSeededUserWithOpportunities()
    const victim = await createSeededUserWithOpportunities()
    const originalSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)
    const victimSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, victim.userId)
    const profileWithMarker = { ...originalSnapshot.profile, first_name: 'Modifié' }

    await expect(
      restoreUserDataSnapshot(owner.serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        opportunityFilters: originalSnapshot.opportunityFilters.map((filter) => ({ ...filter, user_id: victim.userId })),
      }),
    ).rejects.toThrow('Snapshot rows must all belong to the snapshot user')
    await expect(
      restoreUserDataSnapshot(owner.serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        opportunityFilters: originalSnapshot.opportunityFilters.map((filter) => ({
          ...filter,
          id: victimSnapshot.opportunityFilters[0].id,
        })),
      }),
    ).rejects.toThrow('Snapshot row ids must not belong to another user')

    const victimSnapshotAfterRefusal = await buildUserDataSnapshot(owner.serviceRoleClient, victim.userId)
    expect({ ...victimSnapshotAfterRefusal, exportedAt: victimSnapshot.exportedAt }).toEqual(victimSnapshot)
    const { data: profileAfterRefusal } = await owner.serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })

  it("refuses a decision pointing at another user's job application, writing nothing", async () => {
    const owner = await createSeededUserWithOpportunities()
    const victim = await createSeededUserWithOpportunities()
    const originalSnapshot = await buildUserDataSnapshot(owner.serviceRoleClient, owner.userId)

    await expect(
      restoreUserDataSnapshot(owner.serviceRoleClient, {
        ...originalSnapshot,
        profile: { ...originalSnapshot.profile, first_name: 'Modifié' },
        opportunityDecisions: originalSnapshot.opportunityDecisions.map((decision) => ({
          ...decision,
          jobApplicationId: victim.jobApplicationId,
        })),
      }),
    ).rejects.toThrow('Snapshot opportunity decisions must be valid and only reference job applications of the snapshot user')

    const { data: profileAfterRefusal } = await owner.serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })

  it('still parses and restores a snapshot written before the opportunity fields existed', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const currentSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    const earlierSnapshot: Partial<UserDataSnapshot> = { ...currentSnapshot }
    delete earlierSnapshot.opportunityFilters
    delete earlierSnapshot.opportunityDecisions
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)

    const parsedSnapshot = parseUserDataSnapshot(JSON.parse(JSON.stringify(earlierSnapshot)))
    await restoreUserDataSnapshot(serviceRoleClient, {
      ...parsedSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(parsedSnapshot.endClients),
    })

    expect(parsedSnapshot.opportunityFilters).toEqual([])
    expect(parsedSnapshot.opportunityDecisions).toEqual([])
    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect({ ...restoredSnapshot, exportedAt: currentSnapshot.exportedAt }).toEqual(currentSnapshot)
  })

  it('restores the briefs by language and the interview questions after the user data was deleted', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)

    await restoreUserDataSnapshot(serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
    })

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect(restoredSnapshot.endClientBriefs).toEqual(originalSnapshot.endClientBriefs)
    expect(restoredSnapshot.endClientBriefs[0]).toMatchObject({ language: 'fr', markdown: '## Bêta Digital\nÉditeur de logiciels.' })
    expect(restoredSnapshot.interviewQuestions).toEqual(originalSnapshot.interviewQuestions)
    expect(restoredSnapshot.interviewQuestions[0]).toMatchObject({
      language: 'en',
      questions: ['Which product ships next?', 'How large is the frontend team?'],
    })
  })

  it('exports and restores an exchange without job application and contact notes', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)

    await restoreUserDataSnapshot(serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
    })

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect(restoredSnapshot.contacts[0]).toMatchObject({ notes: 'Rencontrée au meetup React', referred_by: 'Paul Leroy' })
    expect(restoredSnapshot.activityLogEntries).toContainEqual(
      expect.objectContaining({
        job_application_id: null,
        contact_id: restoredSnapshot.contacts[0].id,
        summary: 'Appel sans candidature',
      }),
    )
    expect({ ...restoredSnapshot, exportedAt: originalSnapshot.exportedAt }).toEqual(originalSnapshot)
  })

  it('assigns agencies to restored contacts without one', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)

    await restoreUserDataSnapshot(serviceRoleClient, {
      ...originalSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(originalSnapshot.endClients),
      contacts: originalSnapshot.contacts.map((contact) => ({ ...contact, intermediary_id: null })),
    })

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect(restoredSnapshot.contacts[0].intermediary_id).toBe(originalSnapshot.jobApplications[0].intermediary_id)
  })

  it('refuses a brief or interview questions of another user and reused ids, writing nothing', async () => {
    const owner = await createSeededTestUser()
    const victim = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const originalSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    const victimSnapshot = await buildUserDataSnapshot(serviceRoleClient, victim.userId)
    const profileWithMarker = { ...originalSnapshot.profile, first_name: 'Modifié' }

    await expect(
      restoreUserDataSnapshot(serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        endClientBriefs: originalSnapshot.endClientBriefs.map((endClientBrief) => ({ ...endClientBrief, user_id: victim.userId })),
      }),
    ).rejects.toThrow('Snapshot rows must all belong to the snapshot user')
    await expect(
      restoreUserDataSnapshot(serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        interviewQuestions: originalSnapshot.interviewQuestions.map((interviewQuestions) => ({
          ...interviewQuestions,
          user_id: victim.userId,
        })),
      }),
    ).rejects.toThrow('Snapshot rows must all belong to the snapshot user')
    await expect(
      restoreUserDataSnapshot(serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        endClientBriefs: originalSnapshot.endClientBriefs.map((endClientBrief) => ({
          ...endClientBrief,
          id: victimSnapshot.endClientBriefs[0].id,
          markdown: 'Volé',
        })),
      }),
    ).rejects.toThrow('Snapshot row ids must not belong to another user')
    await expect(
      restoreUserDataSnapshot(serviceRoleClient, {
        ...originalSnapshot,
        profile: profileWithMarker,
        interviewQuestions: originalSnapshot.interviewQuestions.map((interviewQuestions) => ({
          ...interviewQuestions,
          id: victimSnapshot.interviewQuestions[0].id,
          questions: ['Volé'],
        })),
      }),
    ).rejects.toThrow('Snapshot row ids must not belong to another user')

    const victimSnapshotAfterRefusal = await buildUserDataSnapshot(serviceRoleClient, victim.userId)
    expect({ ...victimSnapshotAfterRefusal, exportedAt: victimSnapshot.exportedAt }).toEqual(victimSnapshot)
    const { data: profileAfterRefusal } = await serviceRoleClient
      .from('profiles')
      .select('first_name')
      .eq('id', owner.userId)
      .single()
    expect(profileAfterRefusal).toEqual({ first_name: 'Camille' })
  })

  it('turns the end client brief of a snapshot written before briefs by language into a french brief', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const currentSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    await deleteEveryUserRowAndFile(serviceRoleClient, owner.userId, owner.pdfStoragePath)

    const parsedSnapshot = parseUserDataSnapshot(buildSnapshotWrittenBeforeBriefsByLanguage(currentSnapshot))
    await restoreUserDataSnapshot(serviceRoleClient, {
      ...parsedSnapshot,
      endClients: listChildEndClientsBeforeRootOnes(parsedSnapshot.endClients),
    })

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect(removeBriefIds(restoredSnapshot.endClientBriefs)).toEqual(removeBriefIds(currentSnapshot.endClientBriefs))
    expect(restoredSnapshot.interviewQuestions).toEqual([])
    expect({
      ...restoredSnapshot,
      exportedAt: currentSnapshot.exportedAt,
      endClientBriefs: currentSnapshot.endClientBriefs,
      interviewQuestions: currentSnapshot.interviewQuestions,
    }).toEqual(currentSnapshot)
  })

  it('restores a snapshot written before briefs by language over the current data without duplicating the brief', async () => {
    const owner = await createSeededTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const currentSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)

    await restoreUserDataSnapshot(
      serviceRoleClient,
      parseUserDataSnapshot(buildSnapshotWrittenBeforeBriefsByLanguage(currentSnapshot)),
    )

    const restoredSnapshot = await buildUserDataSnapshot(serviceRoleClient, owner.userId)
    expect(removeBriefIds(restoredSnapshot.endClientBriefs)).toEqual(removeBriefIds(currentSnapshot.endClientBriefs))
    expect(restoredSnapshot.interviewQuestions).toEqual(currentSnapshot.interviewQuestions)
  })
})
