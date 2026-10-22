import { randomUUID } from 'node:crypto'
import type { RecordCallInput } from '@/domain/call-log'
import type { ContactProfileInput } from '@/domain/contacts'
import { CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE } from '@/domain/contacts'
import { CONTACT_NAME_ALREADY_TAKEN_MESSAGE, ENTITY_NOT_FOUND_MESSAGES } from '@/domain/entities'
import { formatParisCalendarDate } from '@/domain/paris-time'
import { recordCall } from '@/server/calls/record-call'
import { insertContact, listContactListItems, findContactProfile } from '@/server/repositories/contacts-repository'
import { createCvFromVersion, findSentCvVersionId, storeCvVersion } from '@/server/repositories/cvs-repository'
import { listExchangesForContact } from '@/server/repositories/exchanges-repository'
import { findJobApplicationOverview, listJobApplicationItems } from '@/server/repositories/job-applications-repository'
import { createSignedInTestClient } from './create-test-user'
import { buildJobApplicationInput, createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`record-call-${randomUUID()}@test.local`)

type TestUser = Awaited<ReturnType<typeof createTestUser>>

const buildProfile = (overrides: Partial<ContactProfileInput> = {}): ContactProfileInput => ({
  fullName: 'Hélène Martin',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
  ...overrides,
})

const emptyDetails = { phone: null, email: null, linkedinUrl: null }
const callDate = new Date('2026-10-20T14:00:00.000Z')

const buildInput = (overrides: Partial<RecordCallInput> = {}): RecordCallInput => ({
  contact: { kind: 'new', profile: buildProfile() },
  contactDetails: emptyDetails,
  userEditedContactFields: [],
  exchange: { summary: 'Point sur la mission', occurredAt: callDate },
  jobApplication: null,
  existingJobApplicationId: null,
  ...overrides,
})

const insertContactOrFail = async (user: TestUser, overrides: Partial<ContactProfileInput> = {}): Promise<string> => {
  const insertion = await insertContact(user.client, user.userId, buildProfile(overrides))
  if (!insertion.ok) throw new Error(insertion.errorMessage)
  return insertion.data.id
}

const recordOrFail = async (user: TestUser, input: RecordCallInput) => {
  const outcome = await recordCall(user.client, user.userId, input)
  if (!outcome.ok) throw new Error(outcome.error.message)
  return outcome.data
}

const findOverviewOrFail = async (user: TestUser, jobApplicationId: string | null) => {
  if (jobApplicationId === null) throw new Error('Expected a job application id')
  const lookup = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
  if (!lookup.ok) throw new Error(lookup.errorMessage)
  return lookup.data
}

const addCvOrFail = async (user: TestUser, label: string): Promise<{ cvId: string; versionId: string }> => {
  const versionId = await storeCvVersion(user.client, user.userId, {
    cvId: null,
    label,
    pdfBytes: new TextEncoder().encode(`%PDF-1.7 ${label}`),
    fileName: `${label}.pdf`,
  })
  const creation = await createCvFromVersion(user.client, user.userId, label, versionId)
  if (!creation.ok) throw new Error(creation.errorMessage)
  return { cvId: creation.data.id, versionId }
}

describe('recordCall', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('records a call on an existing contact, filling only empty details', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user, { phone: '0611111111' })

    await recordOrFail(
      user,
      buildInput({
        contact: { kind: 'existing', contactId },
        contactDetails: { phone: '0622222222', email: 'helene@agence.fr', linkedinUrl: null },
      }),
    )

    const profile = await findContactProfile(user.client, user.userId, contactId)
    expect(profile).toMatchObject({ ok: true, data: { phone: '0611111111', email: 'helene@agence.fr' } })
  })

  it('overwrites a detail the user edited', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user, { phone: '0611111111' })

    await recordOrFail(
      user,
      buildInput({
        contact: { kind: 'existing', contactId },
        contactDetails: { phone: '0622222222', email: null, linkedinUrl: null },
        userEditedContactFields: ['phone'],
      }),
    )

    const profile = await findContactProfile(user.client, user.userId, contactId)
    expect(profile).toMatchObject({ ok: true, data: { phone: '0622222222' } })
  })

  it('creates a new contact attached to its agency', async () => {
    const user = await createTestUser()

    const result = await recordOrFail(
      user,
      buildInput({ contact: { kind: 'new', profile: buildProfile({ intermediaryName: 'Hays' }) } }),
    )

    const profile = await findContactProfile(user.client, user.userId, result.contactId)
    expect(profile).toMatchObject({ ok: true, data: { fullName: 'Hélène Martin', intermediaryName: 'Hays' } })
  })

  it('creates the job application with the contact, agency, end client, status, source Appel and call date', async () => {
    const user = await createTestUser()

    const result = await recordOrFail(
      user,
      buildInput({
        contact: { kind: 'new', profile: buildProfile({ intermediaryName: 'Hays' }) },
        jobApplication: {
          input: buildJobApplicationInput({
            title: 'Mission React',
            source: 'Appel',
            status: 'cv_submitted',
            intermediaryName: 'Hays',
            endClientName: 'Total',
            appliedOn: callDate,
          }),
          sentCvId: null,
        },
      }),
    )

    const overview = await findOverviewOrFail(user, result.jobApplicationId)
    expect(overview).toMatchObject({
      title: 'Mission React',
      source: 'Appel',
      status: 'cv_submitted',
      contactName: 'Hélène Martin',
      intermediaryName: 'Hays',
      endClientName: 'Total',
    })
    expect(formatParisCalendarDate(overview.appliedOn)).toBe('2026-10-20')
  })

  it('creates a job application with the KO après échange status', async () => {
    const user = await createTestUser()

    const result = await recordOrFail(
      user,
      buildInput({
        jobApplication: { input: buildJobApplicationInput({ status: 'ko_after_contact', source: 'Appel' }), sentCvId: null },
      }),
    )

    const overview = await findOverviewOrFail(user, result.jobApplicationId)
    expect(overview).toMatchObject({ status: 'ko_after_contact' })
  })

  it('sends the current version of the chosen cv', async () => {
    const user = await createTestUser()
    const { cvId, versionId } = await addCvOrFail(user, 'CV React')

    const result = await recordOrFail(
      user,
      buildInput({ jobApplication: { input: buildJobApplicationInput({ source: 'Appel' }), sentCvId: cvId } }),
    )

    await expect(findSentCvVersionId(user.client, user.userId, result.jobApplicationId ?? '')).resolves.toBe(versionId)
  })

  it('creates the job application without cv when the cv belongs to another user', async () => {
    const user = await createTestUser()
    const otherUser = await createTestUser()
    const { cvId } = await addCvOrFail(otherUser, 'CV autre')

    const result = await recordOrFail(
      user,
      buildInput({ jobApplication: { input: buildJobApplicationInput({ source: 'Appel' }), sentCvId: cvId } }),
    )

    expect(result.jobApplicationId).not.toBeNull()
    await expect(findSentCvVersionId(user.client, user.userId, result.jobApplicationId ?? '')).resolves.toBeNull()
  })

  it('shows the call in the contact history, linked to its job application', async () => {
    const user = await createTestUser()

    const result = await recordOrFail(
      user,
      buildInput({ jobApplication: { input: buildJobApplicationInput({ source: 'Appel' }), sentCvId: null } }),
    )

    const exchanges = await listExchangesForContact(user.client, user.userId, result.contactId)
    expect(exchanges).toHaveLength(1)
    expect(exchanges[0]).toMatchObject({
      kind: 'call',
      summary: 'Point sur la mission',
      jobApplicationId: result.jobApplicationId,
    })
  })

  it('refuses a contact of another user and writes nothing', async () => {
    const user = await createTestUser()
    const otherUser = await createTestUser()
    const foreignContactId = await insertContactOrFail(otherUser)

    const outcome = await recordCall(
      user.client,
      user.userId,
      buildInput({
        contact: { kind: 'existing', contactId: foreignContactId },
        jobApplication: { input: buildJobApplicationInput({ source: 'Appel' }), sentCvId: null },
      }),
    )

    expect(outcome).toMatchObject({ ok: false, error: { kind: 'not_found', message: ENTITY_NOT_FOUND_MESSAGES.contact, createdContactId: null, createdJobApplicationId: null } })
    await expect(listJobApplicationItems(user.client, user.userId)).resolves.toHaveLength(0)
    await expect(listExchangesForContact(otherUser.client, otherUser.userId, foreignContactId)).resolves.toHaveLength(0)
  })

  it('refuses a new contact whose name is already taken', async () => {
    const user = await createTestUser()
    await insertContactOrFail(user)

    const outcome = await recordCall(user.client, user.userId, buildInput())

    expect(outcome).toMatchObject({ ok: false, error: { kind: 'rejected', message: CONTACT_NAME_ALREADY_TAKEN_MESSAGE } })
  })

  it('refuses an existing job application of another user and writes nothing', async () => {
    const user = await createTestUser()
    const otherUser = await createTestUser()
    const contactId = await insertContactOrFail(user, { phone: '0611111111' })
    const foreignJobApplicationId = await createJobApplicationOrFail(otherUser.client, otherUser.userId)

    const outcome = await recordCall(
      user.client,
      user.userId,
      buildInput({
        contact: { kind: 'existing', contactId },
        contactDetails: { phone: '0622222222', email: 'helene@agence.fr', linkedinUrl: null },
        userEditedContactFields: ['phone'],
        existingJobApplicationId: foreignJobApplicationId,
      }),
    )

    expect(outcome).toMatchObject({
      ok: false,
      error: { kind: 'rejected', message: CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE },
    })
    await expect(findContactProfile(user.client, user.userId, contactId)).resolves.toMatchObject({
      ok: true,
      data: { phone: '0611111111', email: null },
    })
    await expect(listExchangesForContact(user.client, user.userId, contactId)).resolves.toHaveLength(0)
    await expect(listJobApplicationItems(otherUser.client, otherUser.userId)).resolves.toHaveLength(1)
  })

  it('refuses an existing job application of another contact without touching the contact', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user, { phone: '0611111111' })
    const otherContactName = 'Paul Durand'
    await insertContactOrFail(user, { fullName: otherContactName })
    const otherContactJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      contactName: otherContactName,
    })

    const outcome = await recordCall(
      user.client,
      user.userId,
      buildInput({
        contact: { kind: 'existing', contactId },
        contactDetails: { phone: '0622222222', email: 'helene@agence.fr', linkedinUrl: null },
        userEditedContactFields: ['phone'],
        existingJobApplicationId: otherContactJobApplicationId,
      }),
    )

    expect(outcome).toMatchObject({
      ok: false,
      error: { kind: 'rejected', message: CONTACT_EXCHANGE_JOB_APPLICATION_MISMATCH_MESSAGE },
    })
    await expect(findContactProfile(user.client, user.userId, contactId)).resolves.toMatchObject({
      ok: true,
      data: { phone: '0611111111', email: null },
    })
    await expect(listExchangesForContact(user.client, user.userId, contactId)).resolves.toHaveLength(0)
  })

  it('reuses the created contact and job application on retry without duplicates', async () => {
    const user = await createTestUser()
    const contactId = await insertContactOrFail(user)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      source: 'Appel',
      contactName: 'Hélène Martin',
    })

    const result = await recordOrFail(
      user,
      buildInput({ contact: { kind: 'existing', contactId }, existingJobApplicationId: jobApplicationId }),
    )

    expect(result).toEqual({ contactId, jobApplicationId })
    await expect(listContactListItems(user.client, user.userId)).resolves.toHaveLength(1)
    await expect(listJobApplicationItems(user.client, user.userId)).resolves.toHaveLength(1)
    const exchanges = await listExchangesForContact(user.client, user.userId, contactId)
    expect(exchanges).toHaveLength(1)
    expect(exchanges[0]).toMatchObject({ jobApplicationId })
  })
})
