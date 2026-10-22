import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/server/supabase/database-types'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

type TestUser = { client: SupabaseClient<Database>; userId: string }

const CHECK_VIOLATION_CODE = '23514'
const FOREIGN_KEY_VIOLATION_CODE = '23503'

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`contacts-schema-${randomUUID()}@test.local`)

const insertContactOrFail = async (user: TestUser, intermediaryId: string | null = null): Promise<string> => {
  const fullName = `Contact ${randomUUID()}`
  const { data, error } = await user.client
    .from('contacts')
    .insert({ user_id: user.userId, full_name: fullName, normalized_name: fullName.toLowerCase(), intermediary_id: intermediaryId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const insertIntermediaryOrFail = async (user: TestUser): Promise<string> => {
  const name = `Agence ${randomUUID()}`
  const { data, error } = await user.client
    .from('intermediaries')
    .insert({ user_id: user.userId, name, normalized_name: name.toLowerCase() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const insertExchange = (
  user: TestUser,
  exchange: { contactId?: string | null; jobApplicationId?: string | null; occurredAt?: string; kind?: 'call' | 'status_change' },
) =>
  user.client
    .from('activity_log_entries')
    .insert({
      user_id: user.userId,
      contact_id: exchange.contactId ?? null,
      job_application_id: exchange.jobApplicationId ?? null,
      kind: exchange.kind ?? 'call',
      summary: 'Appel',
      occurred_at: exchange.occurredAt,
    })

const insertExchangeOrFail = async (user: TestUser, exchange: Parameters<typeof insertExchange>[1]): Promise<void> => {
  const { error } = await insertExchange(user, exchange)
  if (error) throw error
}

const linkJobApplication = async (
  user: TestUser,
  jobApplicationId: string,
  links: { contactId?: string; intermediaryId?: string },
): Promise<void> => {
  const { error } = await user.client
    .from('job_applications')
    .update({ contact_id: links.contactId, intermediary_id: links.intermediaryId })
    .eq('id', jobApplicationId)
  if (error) throw error
}

const listExchangesOfJobApplication = async (jobApplicationId: string) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('activity_log_entries')
    .select('id, job_application_id, contact_id')
    .eq('job_application_id', jobApplicationId)
  if (error) throw error
  return data
}

describe('contacts and agencies schema', () => {
  it('accepts an exchange linked only to a contact', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)

    const { error } = await insertExchange(user, { contactId })

    expect(error).toBeNull()
  })

  it('rejects an exchange linked to neither a contact nor a job application', async () => {
    const user = await createTestUser()

    const { error } = await insertExchange(user, {})

    expect(error?.code).toBe(CHECK_VIOLATION_CODE)
  })

  it('rejects an exchange pointing at another user contact', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const contactIdOfUserA = await insertContactOrFail(userA)

    const { error } = await insertExchange(userB, { contactId: contactIdOfUserA })

    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION_CODE)
  })

  it('keeps contact exchanges and deletes the others when a job application is deleted', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await insertExchangeOrFail(user, { contactId, jobApplicationId })
    await insertExchangeOrFail(user, { jobApplicationId })

    const { error } = await user.client.from('job_applications').delete().eq('id', jobApplicationId)
    expect(error).toBeNull()

    const { data: remainingExchanges } = await user.client.from('activity_log_entries').select('contact_id, job_application_id')
    expect(remainingExchanges).toEqual([{ contact_id: contactId, job_application_id: null }])
    expect(await listExchangesOfJobApplication(jobApplicationId)).toEqual([])
  })

  it('deletes standalone exchanges and detaches linked ones when deleting a contact', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await linkJobApplication(user, jobApplicationId, { contactId })
    await insertExchangeOrFail(user, { contactId })
    await insertExchangeOrFail(user, { contactId, jobApplicationId })

    const { data: wasDeleted, error } = await user.client.rpc('delete_contact', { target_contact_id: contactId })

    expect(error).toBeNull()
    expect(wasDeleted).toBe(true)
    const { data: remainingExchanges } = await user.client.from('activity_log_entries').select('contact_id, job_application_id')
    expect(remainingExchanges).toEqual([{ contact_id: null, job_application_id: jobApplicationId }])
    const { data: jobApplication } = await user.client.from('job_applications').select('contact_id').eq('id', jobApplicationId).single()
    expect(jobApplication?.contact_id).toBeNull()
  })

  it('returns false when deleting a contact of another user', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const contactIdOfUserA = await insertContactOrFail(userA)

    const { data: wasDeleted, error } = await userB.client.rpc('delete_contact', { target_contact_id: contactIdOfUserA })

    expect(error).toBeNull()
    expect(wasDeleted).toBe(false)
    const { data: contactsOfUserA } = await userA.client.from('contacts').select('id').eq('id', contactIdOfUserA)
    expect(contactsOfUserA).toHaveLength(1)
  })

  it('computes the effective contact of an exchange', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { title: 'Mission Alpha' })
    await linkJobApplication(user, jobApplicationId, { contactId })
    await insertExchangeOrFail(user, { jobApplicationId })
    await insertExchangeOrFail(user, { jobApplicationId, kind: 'status_change' })

    const { data: exchanges, error } = await user.client.from('exchanges_overview').select('*')

    expect(error).toBeNull()
    expect(exchanges).toHaveLength(1)
    expect(exchanges?.[0]).toMatchObject({
      effective_contact_id: contactId,
      job_application_id: jobApplicationId,
      job_application_title: 'Mission Alpha',
      kind: 'call',
    })
  })

  it('exposes last exchange and proposed mission count per contact', async () => {
    const user = await createTestUser()
    const activeContactId = await insertContactOrFail(user)
    const idleContactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await linkJobApplication(user, jobApplicationId, { contactId: activeContactId })
    await insertExchangeOrFail(user, { contactId: activeContactId, occurredAt: '2026-10-01T10:00:00+00:00' })
    await insertExchangeOrFail(user, { contactId: activeContactId, occurredAt: '2026-10-05T10:00:00+00:00' })

    const { data: contacts, error } = await user.client
      .from('contacts_overview')
      .select('id, last_exchange_at, proposed_mission_count')
    expect(error).toBeNull()

    const activeContact = contacts?.find((contact) => contact.id === activeContactId)
    const idleContact = contacts?.find((contact) => contact.id === idleContactId)
    expect(activeContact?.proposed_mission_count).toBe(1)
    expect(new Date(activeContact?.last_exchange_at ?? '').toISOString()).toBe('2026-10-05T10:00:00.000Z')
    expect(idleContact).toMatchObject({ last_exchange_at: null, proposed_mission_count: 0 })
  })

  it('counts contacts, missions and exchanges per intermediary', async () => {
    const user = await createTestUser()
    const intermediaryId = await insertIntermediaryOrFail(user)
    const otherIntermediaryId = await insertIntermediaryOrFail(user)
    const contactOfAgencyId = await insertContactOrFail(user, intermediaryId)
    const contactOfOtherAgencyId = await insertContactOrFail(user, otherIntermediaryId)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await linkJobApplication(user, jobApplicationId, { contactId: contactOfOtherAgencyId, intermediaryId })
    await insertExchangeOrFail(user, { contactId: contactOfAgencyId, occurredAt: '2026-10-02T10:00:00+00:00' })
    await insertExchangeOrFail(user, { jobApplicationId, occurredAt: '2026-10-08T10:00:00+00:00' })

    const { data: intermediary, error } = await user.client
      .from('intermediaries_overview')
      .select('contact_count, proposed_mission_count, last_exchange_at')
      .eq('id', intermediaryId)
      .single()

    expect(error).toBeNull()
    expect(intermediary?.contact_count).toBe(1)
    expect(intermediary?.proposed_mission_count).toBe(1)
    expect(new Date(intermediary?.last_exchange_at ?? '').toISOString()).toBe('2026-10-08T10:00:00.000Z')
  })

  it('uses the most recent exchange of a contact of the agency', async () => {
    const user = await createTestUser()
    const intermediaryId = await insertIntermediaryOrFail(user)
    const contactId = await insertContactOrFail(user, intermediaryId)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await linkJobApplication(user, jobApplicationId, { intermediaryId })
    await insertExchangeOrFail(user, { jobApplicationId, occurredAt: '2026-10-03T10:00:00+00:00' })
    await insertExchangeOrFail(user, { contactId, occurredAt: '2026-10-12T10:00:00+00:00' })

    const { data: intermediary, error } = await user.client
      .from('intermediaries_overview')
      .select('last_exchange_at')
      .eq('id', intermediaryId)
      .single()

    expect(error).toBeNull()
    expect(new Date(intermediary?.last_exchange_at ?? '').toISOString()).toBe('2026-10-12T10:00:00.000Z')
  })

  it('deletes a user who has a standalone exchange', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    await insertExchangeOrFail(user, { contactId })

    const { error } = await createServiceRoleTestClient().auth.admin.deleteUser(user.userId)

    expect(error).toBeNull()
  })

  it('deletes standalone exchanges when a contact row is deleted directly', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    await insertExchangeOrFail(user, { contactId })

    const { error } = await user.client.from('contacts').delete().eq('id', contactId)

    expect(error).toBeNull()
    const { data: remainingExchanges } = await user.client.from('activity_log_entries').select('id')
    expect(remainingExchanges).toEqual([])
  })

  it('assigns the agency of the most recent job application to contacts without one', async () => {
    const user = await createTestUser()
    const oldIntermediaryId = await insertIntermediaryOrFail(user)
    const recentIntermediaryId = await insertIntermediaryOrFail(user)
    const keptIntermediaryId = await insertIntermediaryOrFail(user)
    const contactWithoutAgencyId = await insertContactOrFail(user)
    const contactWithAgencyId = await insertContactOrFail(user, keptIntermediaryId)
    const oldJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { appliedOn: new Date('2026-09-01T10:00:00Z') })
    const recentJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { appliedOn: new Date('2026-10-10T10:00:00Z') })
    const keptJobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await linkJobApplication(user, oldJobApplicationId, { contactId: contactWithoutAgencyId, intermediaryId: oldIntermediaryId })
    await linkJobApplication(user, recentJobApplicationId, { contactId: contactWithoutAgencyId, intermediaryId: recentIntermediaryId })
    await linkJobApplication(user, keptJobApplicationId, { contactId: contactWithAgencyId, intermediaryId: oldIntermediaryId })

    const { error } = await user.client.rpc('assign_missing_contact_intermediaries')
    expect(error).toBeNull()

    const { data: contacts } = await user.client.from('contacts').select('id, intermediary_id')
    expect(contacts?.find((contact) => contact.id === contactWithoutAgencyId)?.intermediary_id).toBe(recentIntermediaryId)
    expect(contacts?.find((contact) => contact.id === contactWithAgencyId)?.intermediary_id).toBe(keptIntermediaryId)
  })

  it('only touches the contacts of the given user when a user id is passed', async () => {
    const targetUser = await createTestUser()
    const otherUser = await createTestUser()
    const serviceRoleClient = createServiceRoleTestClient()
    const contactIdsByUser = new Map<TestUser, string>()
    for (const user of [targetUser, otherUser]) {
      const intermediaryId = await insertIntermediaryOrFail(user)
      const contactId = await insertContactOrFail(user)
      const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
      await linkJobApplication(user, jobApplicationId, { contactId, intermediaryId })
      contactIdsByUser.set(user, contactId)
    }

    const { error } = await serviceRoleClient.rpc('assign_missing_contact_intermediaries', { target_user_id: targetUser.userId })
    expect(error).toBeNull()

    const { data: targetContact } = await targetUser.client.from('contacts').select('intermediary_id').eq('id', contactIdsByUser.get(targetUser) ?? '').single()
    const { data: otherContact } = await otherUser.client.from('contacts').select('intermediary_id').eq('id', contactIdsByUser.get(otherUser) ?? '').single()
    expect(targetContact?.intermediary_id).not.toBeNull()
    expect(otherContact?.intermediary_id).toBeNull()
  })
})
