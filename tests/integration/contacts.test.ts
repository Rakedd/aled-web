import { randomUUID } from 'node:crypto'
import { CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE, type ContactProfileInput } from '@/domain/contacts'
import { CONTACT_NAME_ALREADY_TAKEN_MESSAGE, ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { listActiveAlertSnoozes, snoozeJobApplicationAlert } from '@/server/repositories/alert-snoozes-repository'
import {
  deleteContactRow,
  findContactProfile,
  insertContact,
  listContactListItems,
  listContactListItemsForIntermediary,
  saveContactProfile,
} from '@/server/repositories/contacts-repository'
import { searchEntitySuggestions } from '@/server/repositories/entities-repository'
import {
  listExchangesForContact,
  listExchangesForIntermediary,
  recordContactExchange,
} from '@/server/repositories/exchanges-repository'
import { findIntermediaryListItem, listIntermediaryListItems } from '@/server/repositories/intermediaries-repository'
import {
  listProposedMissionsForContact,
  listProposedMissionsForIntermediary,
} from '@/server/repositories/job-applications-repository'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`contacts-${randomUUID()}@test.local`)

type TestUser = Awaited<ReturnType<typeof createTestUser>>

const buildContactProfileInput = (overrides: Partial<ContactProfileInput> = {}): ContactProfileInput => ({
  fullName: 'Hélène Martin',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
  ...overrides,
})

const insertContactOrFail = async (user: TestUser, overrides: Partial<ContactProfileInput> = {}): Promise<string> => {
  const insertion = await insertContact(user.client, user.userId, buildContactProfileInput(overrides))
  if (!insertion.ok) throw new Error(insertion.errorMessage)
  return insertion.data.id
}

const exchangeInput = (overrides: { jobApplicationId?: string | null; occurredAt?: Date; summary?: string } = {}) => ({
  kind: 'call' as const,
  summary: overrides.summary ?? 'Point rapide',
  occurredAt: overrides.occurredAt,
  jobApplicationId: overrides.jobApplicationId ?? null,
})

describe('contacts repositories', () => {
  it('creates a contact with its agency created on the fly', async () => {
    const user = await createTestUser()

    const contactId = await insertContactOrFail(user, {
      fullName: 'Hélène Martin',
      phone: '0612345678',
      intermediaryName: 'Société Conseil',
      referredBy: 'Paul',
      notes: 'Très réactive',
    })

    await expect(findContactProfile(user.client, user.userId, contactId)).resolves.toEqual({
      ok: true,
      data: {
        id: contactId,
        fullName: 'Hélène Martin',
        phone: '0612345678',
        email: null,
        linkedinUrl: null,
        intermediaryId: expect.any(String),
        intermediaryName: 'Société Conseil',
        referredBy: 'Paul',
        notes: 'Très réactive',
      },
    })
    await expect(listContactListItems(user.client, user.userId)).resolves.toMatchObject([
      { id: contactId, fullName: 'Hélène Martin', intermediaryName: 'Société Conseil', proposedMissionCount: 0, lastExchangeAt: null },
    ])
    await expect(listIntermediaryListItems(user.client, user.userId)).resolves.toMatchObject([
      { name: 'Société Conseil', contactCount: 1, proposedMissionCount: 0 },
    ])
  })

  it('refuses to rename a contact to a name differing only by accents from another contact', async () => {
    const user = await createTestUser()
    await insertContactOrFail(user, { fullName: 'Hélène Martin' })
    const otherContactId = await insertContactOrFail(user, { fullName: 'Paul Durand' })

    await expect(
      saveContactProfile(user.client, user.userId, otherContactId, buildContactProfileInput({ fullName: 'Helene Martin' })),
    ).resolves.toEqual({ ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE })
    await expect(
      insertContact(user.client, user.userId, buildContactProfileInput({ fullName: 'HELENE MARTIN' })),
    ).resolves.toEqual({ ok: false, errorMessage: CONTACT_NAME_ALREADY_TAKEN_MESSAGE })
  })

  it('does not leave an empty agency behind when the contact name is already taken', async () => {
    const user = await createTestUser()
    await insertContactOrFail(user, { fullName: 'Hélène Martin' })
    const otherContactId = await insertContactOrFail(user, { fullName: 'Paul Durand' })

    await insertContact(user.client, user.userId, buildContactProfileInput({ fullName: 'Helene Martin', intermediaryName: 'Agence Fantôme' }))
    await saveContactProfile(
      user.client,
      user.userId,
      otherContactId,
      buildContactProfileInput({ fullName: 'Helene Martin', intermediaryName: 'Agence Fantôme' }),
    )

    const intermediaries = await listIntermediaryListItems(user.client, user.userId)
    expect(intermediaries).toEqual([])
  })

  it('lets a contact change the case of its own name', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user, { fullName: 'hélène martin' })

    await expect(
      saveContactProfile(
        user.client,
        user.userId,
        contactId,
        buildContactProfileInput({ fullName: 'Hélène Martin', intermediaryName: 'Acme' }),
      ),
    ).resolves.toEqual({ ok: true, data: null })
    await expect(findContactProfile(user.client, user.userId, contactId)).resolves.toMatchObject({
      ok: true,
      data: { fullName: 'Hélène Martin', intermediaryName: 'Acme' },
    })
  })

  it('lists exchanges of a contact including those of its job applications', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const otherContactId = await insertContactOrFail(user, { fullName: 'Paul Durand' })
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Mission Alpha',
      contactName: 'Hélène Martin',
    })
    await recordContactExchange(user.client, user.userId, contactId, exchangeInput({ summary: 'Ancien', occurredAt: new Date('2026-10-01T10:00:00Z') }))
    await recordContactExchange(
      user.client,
      user.userId,
      contactId,
      exchangeInput({ summary: 'Récent', jobApplicationId, occurredAt: new Date('2026-10-05T10:00:00Z') }),
    )
    await recordContactExchange(user.client, user.userId, otherContactId, exchangeInput({ summary: 'Autre' }))
    await user.client
      .from('activity_log_entries')
      .insert({ user_id: user.userId, job_application_id: jobApplicationId, kind: 'email', summary: 'Via candidature', occurred_at: '2026-10-03T10:00:00Z' })
    await user.client
      .from('activity_log_entries')
      .insert({ user_id: user.userId, job_application_id: jobApplicationId, kind: 'status_change', summary: 'Statut', occurred_at: '2026-10-04T10:00:00Z' })

    const exchanges = await listExchangesForContact(user.client, user.userId, contactId)

    expect(exchanges.map((exchange) => exchange.summary)).toEqual(['Récent', 'Via candidature', 'Ancien'])
    expect(exchanges[0]).toMatchObject({
      kind: 'call',
      jobApplicationId,
      jobApplicationTitle: 'Mission Alpha',
      contactId,
      contactName: 'Hélène Martin',
      occurredAt: new Date('2026-10-05T10:00:00Z'),
    })
    expect(exchanges[2]).toMatchObject({ jobApplicationId: null, jobApplicationTitle: null })
  })

  it('lists exchanges of an agency through contacts and job applications', async () => {
    const user = await createTestUser()
    const contactOfAgencyId = await insertContactOrFail(user, { intermediaryName: 'Société Conseil' })
    const contactElsewhereId = await insertContactOrFail(user, { fullName: 'Paul Durand', intermediaryName: 'Autre Agence' })
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Mission Alpha',
      intermediaryName: 'Société Conseil',
      contactName: 'Paul Durand',
      endClientName: 'BNP Paribas AM',
      endClientParentName: 'BNP Paribas',
    })
    await recordContactExchange(user.client, user.userId, contactOfAgencyId, exchangeInput({ summary: 'Via contact', occurredAt: new Date('2026-10-02T10:00:00Z') }))
    await recordContactExchange(
      user.client,
      user.userId,
      contactElsewhereId,
      exchangeInput({ summary: 'Via candidature', jobApplicationId, occurredAt: new Date('2026-10-03T10:00:00Z') }),
    )
    await recordContactExchange(user.client, user.userId, contactElsewhereId, exchangeInput({ summary: 'Hors agence' }))
    const { data: intermediary } = await user.client.from('intermediaries').select('id').eq('name', 'Société Conseil').single()
    const intermediaryId = intermediary?.id ?? ''

    const exchanges = await listExchangesForIntermediary(user.client, user.userId, intermediaryId)

    expect(exchanges.map((exchange) => exchange.summary)).toEqual(['Via candidature', 'Via contact'])
    await expect(listContactListItemsForIntermediary(user.client, user.userId, intermediaryId)).resolves.toMatchObject([
      { id: contactOfAgencyId, intermediaryName: 'Société Conseil' },
    ])
    await expect(listProposedMissionsForIntermediary(user.client, user.userId, intermediaryId)).resolves.toEqual([
      {
        jobApplicationId,
        title: 'Mission Alpha',
        appliedOn: expect.any(Date),
        endClientLabel: 'BNP Paribas AM (BNP Paribas)',
        contactName: 'Paul Durand',
        status: 'applied',
      },
    ])
    await expect(findIntermediaryListItem(user.client, user.userId, intermediaryId)).resolves.toMatchObject({
      ok: true,
      data: { id: intermediaryId, name: 'Société Conseil', kind: null, contactCount: 1, proposedMissionCount: 1 },
    })
  })

  it('lists proposed missions of a contact, newest first', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Ancienne',
      contactName: 'Hélène Martin',
      appliedOn: new Date('2026-09-01T10:00:00Z'),
    })
    await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Récente',
      contactName: 'Hélène Martin',
      appliedOn: new Date('2026-10-01T10:00:00Z'),
    })

    const missions = await listProposedMissionsForContact(user.client, user.userId, contactId)

    expect(missions.map((mission) => mission.title)).toEqual(['Récente', 'Ancienne'])
  })

  it('records an exchange without job application', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)

    await expect(
      recordContactExchange(user.client, user.userId, contactId, exchangeInput({ summary: 'Café' })),
    ).resolves.toEqual({ ok: true, data: null })

    const exchanges = await listExchangesForContact(user.client, user.userId, contactId)
    expect(exchanges).toMatchObject([{ summary: 'Café', jobApplicationId: null, contactId }])
  })

  it('refuses an exchange with a job application of another contact', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    await insertContactOrFail(user, { fullName: 'Paul Durand' })
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Paul Durand' })

    await expect(
      recordContactExchange(user.client, user.userId, contactId, exchangeInput({ jobApplicationId })),
    ).resolves.toEqual({ ok: false, errorMessage: CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE })

    const { data: insertedEntries } = await user.client.from('activity_log_entries').select('id').eq('summary', 'Point rapide')
    expect(insertedEntries).toEqual([])
  })

  it('clears todo snoozes when an exchange is recorded on a job application', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Hélène Martin' })
    for (const alertKind of ['follow_up_due', 'no_news_suggestion', 'job_spec_missing'] as const) {
      await snoozeJobApplicationAlert(user.client, user.userId, { jobApplicationId, alertKind, snoozeDays: 7 }, new Date())
    }

    await recordContactExchange(user.client, user.userId, contactId, exchangeInput({ jobApplicationId }))

    const remainingSnoozes = await listActiveAlertSnoozes(user.client, user.userId, new Date())
    expect(remainingSnoozes.map((snooze) => snooze.alertKind)).toEqual(['job_spec_missing'])
  })

  it('returns not found for a contact or agency of another user', async () => {
    const owner = await createTestUser()
    const stranger = await createTestUser()
    const contactId = await insertContactOrFail(owner, { intermediaryName: 'Société Conseil' })
    const { data: intermediary } = await owner.client.from('intermediaries').select('id').single()
    const intermediaryId = intermediary?.id ?? ''

    await expect(findContactProfile(stranger.client, stranger.userId, contactId)).resolves.toEqual({
      ok: false,
      errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact,
    })
    await expect(findIntermediaryListItem(stranger.client, stranger.userId, intermediaryId)).resolves.toEqual({
      ok: false,
      errorMessage: ENTITY_NOT_FOUND_MESSAGES.intermediary,
    })
    await expect(
      saveContactProfile(stranger.client, stranger.userId, contactId, buildContactProfileInput()),
    ).resolves.toEqual({ ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact })
    await expect(
      recordContactExchange(stranger.client, stranger.userId, contactId, exchangeInput()),
    ).resolves.toEqual({ ok: false, errorMessage: ENTITY_NOT_FOUND_MESSAGES.contact })
    await expect(deleteContactRow(stranger.client, contactId)).resolves.toBe(false)
    await expect(deleteContactRow(owner.client, contactId)).resolves.toBe(true)
  })

  it('suggests contacts with their agency and details', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user, {
      phone: '0612345678',
      email: 'helene@example.com',
      intermediaryName: 'Société Conseil',
    })
    await insertContactOrFail(user, { fullName: 'Hélène Sans Agence' })

    const suggestions = await searchEntitySuggestions(user.client, user.userId, { entityKind: 'contact', query: 'helene' })

    expect(suggestions).toEqual([
      {
        id: contactId,
        name: 'Hélène Martin',
        label: 'Hélène Martin · Société Conseil',
        parentName: null,
        contactDetails: { phone: '0612345678', email: 'helene@example.com', linkedinUrl: null },
      },
      {
        id: expect.any(String),
        name: 'Hélène Sans Agence',
        label: 'Hélène Sans Agence',
        parentName: null,
        contactDetails: { phone: null, email: null, linkedinUrl: null },
      },
    ])
  })
})
