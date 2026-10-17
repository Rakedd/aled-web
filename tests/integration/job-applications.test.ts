import { randomUUID } from 'node:crypto'
import {
  listActivityLogEntriesForJobApplication,
  recordActivityLogEntry,
} from '@/server/repositories/activity-log-repository'
import { listActiveAlertSnoozes, snoozeJobApplicationAlert } from '@/server/repositories/alert-snoozes-repository'
import {
  changeJobApplicationStatusRow,
  findJobApplicationOverview,
  listJobApplicationOverviews,
  updateJobApplicationRow,
} from '@/server/repositories/job-applications-repository'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`job-applications-${randomUUID()}@test.local`)

describe('job applications repository', () => {
  it('creates a job application and reads it back with every field mapped', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      title: 'Lead React',
      postedDailyRate: 550,
      appliedOn: new Date('2026-10-16T22:00:00Z'),
      actualStartDate: new Date('2026-11-01T23:00:00Z'),
      stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
      intermediaryName: 'Agence X',
      contactName: 'Jean Dupont',
      endClientName: 'Banque Z',
    })

    const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)

    expect(overviewResult).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: jobApplicationId,
        userId: user.userId,
        title: 'Lead React',
        status: 'applied',
        postedDailyRate: 550,
        appliedOn: new Date('2026-10-16T22:00:00Z'),
        actualStartDate: new Date('2026-11-01T23:00:00Z'),
        stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
        lastActivityAt: null,
        hasJobSpec: false,
        intermediaryName: 'Agence X',
        contactName: 'Jean Dupont',
        endClientName: 'Banque Z',
        endClientParentName: null,
        endClientLabel: 'Banque Z',
      }),
    })
    expect(overviewResult.ok && overviewResult.data.createdAt).toBeInstanceOf(Date)
  })

  it('reuses the same intermediary whatever the case and spacing of its name', async () => {
    const user = await createTestUser()
    const firstJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      intermediaryName: 'Agence X',
    })
    const secondJobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      intermediaryName: 'agence x ',
    })

    const { data: intermediaries } = await user.client.from('intermediaries').select('id, name').eq('user_id', user.userId)
    expect(intermediaries).toHaveLength(1)
    expect(intermediaries?.[0].name).toBe('Agence X')

    const overviews = await listJobApplicationOverviews(user.client, user.userId)
    const intermediaryIds = overviews
      .filter((overview) => [firstJobApplicationId, secondJobApplicationId].includes(overview.id))
      .map((overview) => overview.intermediaryId)
    expect(intermediaryIds).toEqual([intermediaries?.[0].id, intermediaries?.[0].id])
  })

  it('fills the e-mail and phone of an existing contact only when they are empty', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Jean Dupont', contactEmail: 'jean@agence-x.fr' })
    await createJobApplicationOrFail(user.client, user.userId, {
      contactName: 'jean dupont',
      contactEmail: 'autre@agence-x.fr',
      contactPhone: '06 12 34 56 78',
    })

    const { data: contacts } = await user.client.from('contacts').select('full_name, email, phone').eq('user_id', user.userId)
    expect(contacts).toEqual([{ full_name: 'Jean Dupont', email: 'jean@agence-x.fr', phone: '06 12 34 56 78' }])
  })

  it('updates only the provided fields and clears an entity set to null', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      notes: 'Première note',
      intermediaryName: 'Agence X',
      endClientName: 'Banque Z',
    })

    await expect(
      updateJobApplicationRow(user.client, user.userId, jobApplicationId, {
        requestedDailyRate: 650,
        intermediaryName: null,
      }),
    ).resolves.toEqual({ ok: true, data: null })

    const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewResult).toMatchObject({
      ok: true,
      data: { requestedDailyRate: 650, notes: 'Première note', intermediaryName: null, endClientName: 'Banque Z' },
    })
  })

  it('logs a status change made through an update', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    await updateJobApplicationRow(user.client, user.userId, jobApplicationId, { status: 'cv_submitted' })

    const activityLogResult = await listActivityLogEntriesForJobApplication(user.client, user.userId, jobApplicationId)
    expect(activityLogResult).toMatchObject({
      ok: true,
      data: [{ kind: 'status_change', summary: 'Statut : Postulé → CV positionné' }],
    })
  })

  it('changes the status with exactly one status_change entry and clears the snoozes', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { status: 'intermediary_contact' })
    await snoozeJobApplicationAlert(
      user.client,
      user.userId,
      { jobApplicationId, alertKind: 'follow_up_due', snoozeDays: 3 },
      new Date(),
    )

    await expect(changeJobApplicationStatusRow(user.client, user.userId, jobApplicationId, 'cv_submitted')).resolves.toEqual({
      ok: true,
      data: null,
    })

    const { data: statusChangeEntries } = await user.client
      .from('activity_log_entries')
      .select('kind, summary')
      .eq('job_application_id', jobApplicationId)
    expect(statusChangeEntries).toEqual([{ kind: 'status_change', summary: 'Statut : Échange intermédiaire → CV positionné' }])
    await expect(listActiveAlertSnoozes(user.client, user.userId, new Date())).resolves.toEqual([])
    await expect(findJobApplicationOverview(user.client, user.userId, jobApplicationId)).resolves.toMatchObject({
      ok: true,
      data: { status: 'cv_submitted' },
    })
  })

  it('does not log anything when the status does not change', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    await changeJobApplicationStatusRow(user.client, user.userId, jobApplicationId, 'applied')

    await expect(listActivityLogEntriesForJobApplication(user.client, user.userId, jobApplicationId)).resolves.toEqual({
      ok: true,
      data: [],
    })
  })

  it('updates lastActivityAt and clears the snoozes when an activity is logged', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await snoozeJobApplicationAlert(
      user.client,
      user.userId,
      { jobApplicationId, alertKind: 'no_news_suggestion', snoozeDays: 7 },
      new Date(),
    )
    const occurredAt = new Date('2026-10-15T09:30:00Z')

    await expect(
      recordActivityLogEntry(user.client, user.userId, jobApplicationId, { kind: 'call', summary: 'Appel avec Jean', occurredAt }),
    ).resolves.toEqual({ ok: true, data: null })

    const overviews = await listJobApplicationOverviews(user.client, user.userId)
    expect(overviews.find((overview) => overview.id === jobApplicationId)?.lastActivityAt).toEqual(occurredAt)
    await expect(listActiveAlertSnoozes(user.client, user.userId, new Date())).resolves.toEqual([])
  })

  it('lists activity log entries from the most recent to the oldest', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await recordActivityLogEntry(user.client, user.userId, jobApplicationId, {
      kind: 'call',
      summary: 'Premier appel',
      occurredAt: new Date('2026-10-10T09:00:00Z'),
    })
    await recordActivityLogEntry(user.client, user.userId, jobApplicationId, {
      kind: 'email',
      summary: 'Relance',
      occurredAt: new Date('2026-10-14T09:00:00Z'),
    })

    const activityLogResult = await listActivityLogEntriesForJobApplication(user.client, user.userId, jobApplicationId)

    expect(activityLogResult).toEqual({
      ok: true,
      data: [
        {
          id: expect.any(String),
          jobApplicationId,
          kind: 'email',
          summary: 'Relance',
          occurredAt: new Date('2026-10-14T09:00:00Z'),
        },
        {
          id: expect.any(String),
          jobApplicationId,
          kind: 'call',
          summary: 'Premier appel',
          occurredAt: new Date('2026-10-10T09:00:00Z'),
        },
      ],
    })
  })

  it('snoozes an alert for the given number of Paris calendar days', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const now = new Date()

    await expect(
      snoozeJobApplicationAlert(user.client, user.userId, { jobApplicationId, alertKind: 'job_spec_missing', snoozeDays: 3 }, now),
    ).resolves.toEqual({ ok: true, data: null })
    await snoozeJobApplicationAlert(user.client, user.userId, { jobApplicationId, alertKind: 'job_spec_missing', snoozeDays: 7 }, now)

    const activeSnoozes = await listActiveAlertSnoozes(user.client, user.userId, now)
    expect(activeSnoozes).toHaveLength(1)
    expect(activeSnoozes[0]).toMatchObject({ jobApplicationId, alertKind: 'job_spec_missing' })
    const snoozedHours = (activeSnoozes[0].snoozedUntil.getTime() - now.getTime()) / 3_600_000
    expect(snoozedHours).toBeGreaterThanOrEqual(7 * 24 - 1)
    expect(snoozedHours).toBeLessThanOrEqual(7 * 24 + 1)
  })

  it('refuses to snooze an upcoming interview', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    await expect(
      snoozeJobApplicationAlert(
        user.client,
        user.userId,
        { jobApplicationId, alertKind: 'upcoming_interview', snoozeDays: 3 },
        new Date(),
      ),
    ).resolves.toEqual({ ok: false, errorMessage: 'Un entretien à venir ne peut pas être reporté' })
    await expect(listActiveAlertSnoozes(user.client, user.userId, new Date())).resolves.toEqual([])
  })

  it("rejects every call made with another user's job application id and modifies nothing", async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId, { title: 'Mission du propriétaire' })
    const notFound = { ok: false, errorMessage: 'Candidature introuvable' }

    await expect(findJobApplicationOverview(intruder.client, intruder.userId, jobApplicationId)).resolves.toEqual(notFound)
    await expect(
      updateJobApplicationRow(intruder.client, intruder.userId, jobApplicationId, { title: 'Piratée', intermediaryName: 'Agence pirate' }),
    ).resolves.toEqual(notFound)
    await expect(
      changeJobApplicationStatusRow(intruder.client, intruder.userId, jobApplicationId, 'ko_cv'),
    ).resolves.toEqual(notFound)
    await expect(
      recordActivityLogEntry(intruder.client, intruder.userId, jobApplicationId, { kind: 'call', summary: 'Forgé' }),
    ).resolves.toEqual(notFound)
    await expect(
      listActivityLogEntriesForJobApplication(intruder.client, intruder.userId, jobApplicationId),
    ).resolves.toEqual(notFound)
    await expect(
      snoozeJobApplicationAlert(
        intruder.client,
        intruder.userId,
        { jobApplicationId, alertKind: 'follow_up_due', snoozeDays: 3 },
        new Date(),
      ),
    ).resolves.toEqual(notFound)

    await expect(findJobApplicationOverview(owner.client, owner.userId, jobApplicationId)).resolves.toMatchObject({
      ok: true,
      data: { title: 'Mission du propriétaire', status: 'applied', intermediaryName: null, lastActivityAt: null },
    })
    await expect(listActiveAlertSnoozes(owner.client, owner.userId, new Date())).resolves.toEqual([])
    const { data: intruderIntermediaries } = await intruder.client.from('intermediaries').select('id')
    expect(intruderIntermediaries).toEqual([])
    await expect(listJobApplicationOverviews(intruder.client, intruder.userId)).resolves.toEqual([])
  })

  it("never lists another user's job applications even when queried with that user's id", async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    await createJobApplicationOrFail(owner.client, owner.userId)

    await expect(listJobApplicationOverviews(intruder.client, owner.userId)).resolves.toEqual([])
  })
})
