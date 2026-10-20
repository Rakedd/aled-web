import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JOB_APPLICATION_NOT_FOUND_MESSAGE } from '@/domain/job-application'
import { JOB_SPECS_BUCKET } from '@/domain/job-spec'
import { EMPTY_OPPORTUNITY_FILTERS } from '@/domain/opportunity-filters'
import { deleteJobApplication } from '@/server/actions/job-application-actions'
import { listOpportunities, saveOpportunityFilters } from '@/server/actions/opportunity-actions'
import { recordActivityLogEntry } from '@/server/repositories/activity-log-repository'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { saveJobSpecContent, uploadJobSpecPdfFile } from '@/server/repositories/job-specs-repository'
import { upsertOpportunityDecision } from '@/server/repositories/opportunity-decisions-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

type SeededJobApplication = { jobApplicationId: string; endClientId: string; storagePath: string }

const CHILD_TABLES = ['activity_log_entries', 'interviews', 'alert_snoozes', 'job_specs', 'interview_questions'] as const

const createTestUser = (): Promise<TestUser> =>
  createSignedInTestClient(`delete-job-application-${randomUUID()}@test.local`)

const actAs = (user: TestUser): void => {
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
}

const failOnError = ({ error }: { error: { message: string } | null }): void => {
  if (error) throw new Error(error.message)
}

const findEndClientIdOrFail = async (user: TestUser, jobApplicationId: string): Promise<string> => {
  const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
  if (!overviewResult.ok || overviewResult.data.endClientId === null) throw new Error('Expected an end client')
  return overviewResult.data.endClientId
}

const seedJobApplicationWithEverything = async (user: TestUser): Promise<SeededJobApplication> => {
  const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
    endClientName: `Client ${randomUUID()}`,
  })
  const endClientId = await findEndClientIdOrFail(user, jobApplicationId)
  await recordActivityLogEntry(user.client, user.userId, jobApplicationId, { kind: 'call', summary: 'Appel avec le recruteur' })
  failOnError(
    await user.client.from('interviews').insert({
      user_id: user.userId,
      job_application_id: jobApplicationId,
      starts_at: '2026-10-25T09:00:00+00:00',
      kind: 'client',
      format: 'video',
    }),
  )
  failOnError(
    await user.client.from('alert_snoozes').insert({
      user_id: user.userId,
      job_application_id: jobApplicationId,
      alert_kind: 'follow_up_due',
      snoozed_until: '2026-10-30T09:00:00+00:00',
    }),
  )
  failOnError(
    await user.client.from('interview_questions').insert({
      user_id: user.userId,
      job_application_id: jobApplicationId,
      language: 'fr',
      questions: ['Quelle est la taille de l’équipe ?'],
      generated_at: '2026-10-18T09:00:00+00:00',
    }),
  )
  failOnError(
    await user.client.from('end_client_briefs').insert({
      user_id: user.userId,
      end_client_id: endClientId,
      language: 'fr',
      markdown: '## Chiffres clés',
      sources: [],
      generated_at: '2026-10-18T09:00:00+00:00',
    }),
  )
  const storagePath = await uploadJobSpecPdfFile(
    user.client,
    user.userId,
    jobApplicationId,
    new TextEncoder().encode('%PDF-1.7 fiche métier'),
  )
  const saveResult = await saveJobSpecContent(user.client, user.userId, jobApplicationId, { sourceKind: 'pdf', storagePath }, null)
  if (!saveResult.ok) throw new Error(saveResult.errorMessage)
  return { jobApplicationId, endClientId, storagePath }
}

const countRowsForJobApplication = async (
  tableName: (typeof CHILD_TABLES)[number],
  jobApplicationId: string,
): Promise<number> => {
  const { count, error } = await createServiceRoleTestClient()
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('job_application_id', jobApplicationId)
  if (error) throw error
  return count ?? 0
}

const countEveryChildRow = async (jobApplicationId: string): Promise<Record<string, number>> => {
  const childRowCounts = await Promise.all(
    CHILD_TABLES.map(async (tableName) => [tableName, await countRowsForJobApplication(tableName, jobApplicationId)]),
  )
  return Object.fromEntries(childRowCounts)
}

const isJobApplicationStored = async (jobApplicationId: string): Promise<boolean> => {
  const { data, error } = await createServiceRoleTestClient()
    .from('job_applications')
    .select('id')
    .eq('id', jobApplicationId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

const listStoredFileNames = async (storageFolder: string): Promise<string[]> => {
  const { data, error } = await createServiceRoleTestClient().storage.from(JOB_SPECS_BUCKET).list(storageFolder)
  if (error) throw error
  return data.map((storedFile) => storedFile.name)
}

const toStorageFolder = (storagePath: string): string => storagePath.slice(0, storagePath.lastIndexOf('/'))

const toFileName = (storagePath: string): string => storagePath.slice(storagePath.lastIndexOf('/') + 1)

const seedOpportunityOrFail = async (title: string): Promise<string> => {
  const externalId = randomUUID()
  const { data, error } = await createServiceRoleTestClient()
    .from('opportunities')
    .insert({
      source: 'free-work',
      external_id: externalId,
      url: `https://www.free-work.com/fr/tech-it/job-mission/${externalId}`,
      title,
      title_normalized: title.toLowerCase(),
      company: 'Agence X',
      description: 'Mission longue',
      skills: ['React'],
      published_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const listToProcessOpportunityIdsOrFail = async (): Promise<string[]> => {
  const listingResult = await listOpportunities('to_process', null, '')
  if (!listingResult.ok) throw new Error(listingResult.errorMessage)
  return listingResult.data.items.map((listItem) => listItem.id)
}

const buildUniqueKeyword = (): string => `tok${randomUUID().replaceAll('-', '').slice(0, 12)}`

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('deleteJobApplication', () => {
  it('deletes the application with its log, interviews, snoozes, job spec, questions and pdf but keeps the client brief', async () => {
    const user = await createTestUser()
    actAs(user)
    const { jobApplicationId, endClientId, storagePath } = await seedJobApplicationWithEverything(user)
    expect(await listStoredFileNames(toStorageFolder(storagePath))).toEqual([toFileName(storagePath)])

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({ ok: true, data: null })

    expect(await isJobApplicationStored(jobApplicationId)).toBe(false)
    expect(await countEveryChildRow(jobApplicationId)).toEqual({
      activity_log_entries: 0,
      interviews: 0,
      alert_snoozes: 0,
      job_specs: 0,
      interview_questions: 0,
    })
    expect(await listStoredFileNames(toStorageFolder(storagePath))).toEqual([])
    const { data: remainingBriefs } = await user.client
      .from('end_client_briefs')
      .select('markdown')
      .eq('end_client_id', endClientId)
    expect(remainingBriefs).toEqual([{ markdown: '## Chiffres clés' }])
  })

  it('puts the opportunity the application came from back in « À traiter »', async () => {
    const user = await createTestUser()
    actAs(user)
    const keyword = buildUniqueKeyword()
    const opportunityId = await seedOpportunityOrFail(`Développeur React ${keyword}`)
    const filtersSaveResult = await saveOpportunityFilters({
      ...EMPTY_OPPORTUNITY_FILTERS,
      includeKeywords: [keyword],
    })
    if (!filtersSaveResult.ok) throw new Error(filtersSaveResult.errorMessage)
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { source: 'Free-Work' })
    const decisionResult = await upsertOpportunityDecision(user.client, user.userId, {
      opportunityId,
      decision: 'applied',
      jobApplicationId,
    })
    if (!decisionResult.ok) throw new Error(decisionResult.errorMessage)
    expect(await listToProcessOpportunityIdsOrFail()).toEqual([])

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({ ok: true, data: null })

    expect(await listToProcessOpportunityIdsOrFail()).toEqual([opportunityId])
    const { data: remainingDecisions } = await createServiceRoleTestClient()
      .from('opportunity_decisions')
      .select('id')
      .eq('user_id', user.userId)
      .eq('opportunity_id', opportunityId)
    expect(remainingDecisions).toEqual([])
  })

  it("refuses to let B delete A's application and deletes nothing", async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    actAs(userA)
    const { jobApplicationId, storagePath } = await seedJobApplicationWithEverything(userA)
    const opportunityId = await seedOpportunityOrFail(`Développeur React ${buildUniqueKeyword()}`)
    const decisionResult = await upsertOpportunityDecision(userA.client, userA.userId, {
      opportunityId,
      decision: 'applied',
      jobApplicationId,
    })
    if (!decisionResult.ok) throw new Error(decisionResult.errorMessage)
    actAs(userB)

    await expect(deleteJobApplication(jobApplicationId)).resolves.toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })

    expect(await isJobApplicationStored(jobApplicationId)).toBe(true)
    expect(await countEveryChildRow(jobApplicationId)).toEqual({
      activity_log_entries: 1,
      interviews: 1,
      alert_snoozes: 1,
      job_specs: 1,
      interview_questions: 1,
    })
    expect(await listStoredFileNames(toStorageFolder(storagePath))).toEqual([toFileName(storagePath)])
    const { data: remainingDecisions } = await createServiceRoleTestClient()
      .from('opportunity_decisions')
      .select('decision, job_application_id')
      .eq('user_id', userA.userId)
      .eq('opportunity_id', opportunityId)
    expect(remainingDecisions).toEqual([{ decision: 'applied', job_application_id: jobApplicationId }])
  })

  it('answers « Candidature introuvable » for an unknown id', async () => {
    const user = await createTestUser()
    actAs(user)

    await expect(deleteJobApplication(randomUUID())).resolves.toEqual({
      ok: false,
      errorMessage: JOB_APPLICATION_NOT_FOUND_MESSAGE,
    })
  })
})
