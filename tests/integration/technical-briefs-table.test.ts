import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/server/supabase/database-types'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

type TestUser = { client: SupabaseClient<Database>; userId: string }

const UNIQUE_VIOLATION_CODE = '23505'
const FOREIGN_KEY_VIOLATION_CODE = '23503'
const ROW_LEVEL_SECURITY_VIOLATION_CODE = '42501'

const createTestUser = (): Promise<TestUser> => createSignedInTestClient(`technical-briefs-table-${randomUUID()}@test.local`)

const insertCvVersionOrFail = async (user: TestUser): Promise<string> => {
  const versionId = randomUUID()
  const { error } = await user.client.from('cv_versions').insert({
    id: versionId,
    user_id: user.userId,
    label: 'CV envoyé',
    storage_path: `${user.userId}/${versionId}.pdf`,
    file_name: 'cv.pdf',
    byte_size: 1024,
  })
  if (error) throw error
  return versionId
}

const buildTechnicalBriefInsert = (
  user: TestUser,
  jobApplicationId: string,
  overrides: Partial<Database['public']['Tables']['technical_briefs']['Insert']> = {},
): Database['public']['Tables']['technical_briefs']['Insert'] => ({
  user_id: user.userId,
  job_application_id: jobApplicationId,
  language: 'fr',
  cv_version_id: null,
  cv_label: 'CV envoyé',
  cv_uploaded_at: '2026-10-20T09:00:00+00:00',
  content: { missions: [] },
  generated_at: '2026-10-23T09:00:00+00:00',
  ...overrides,
})

const insertTechnicalBriefOrFail = async (
  user: TestUser,
  jobApplicationId: string,
  overrides: Partial<Database['public']['Tables']['technical_briefs']['Insert']> = {},
): Promise<string> => {
  const { data, error } = await user.client
    .from('technical_briefs')
    .insert(buildTechnicalBriefInsert(user, jobApplicationId, overrides))
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const findTechnicalBriefsWithServiceRole = async (jobApplicationId: string) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('technical_briefs')
    .select('id, cv_version_id')
    .eq('job_application_id', jobApplicationId)
  if (error) throw error
  return data
}

describe('technical briefs table', () => {
  it('lets a user write and read only their own technical briefs', async () => {
    const userA = await createTestUser()
    const userB = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(userA.client, userA.userId)
    const briefId = await insertTechnicalBriefOrFail(userA, jobApplicationId)

    const { data: briefsReadByB } = await userB.client.from('technical_briefs').select('id').eq('id', briefId)
    const { error: foreignInsertError } = await userB.client
      .from('technical_briefs')
      .insert(buildTechnicalBriefInsert(userB, jobApplicationId))
    const { error: impersonationError } = await userB.client
      .from('technical_briefs')
      .insert(buildTechnicalBriefInsert(userA, jobApplicationId, { language: 'en' }))

    expect(briefsReadByB).toEqual([])
    expect(foreignInsertError?.code).toBe(FOREIGN_KEY_VIOLATION_CODE)
    expect(impersonationError?.code).toBe(ROW_LEVEL_SECURITY_VIOLATION_CODE)
    const { data: briefsReadByA } = await userA.client.from('technical_briefs').select('id').eq('id', briefId)
    expect(briefsReadByA).toEqual([{ id: briefId }])
  })

  it('deletes the technical briefs with their job application', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await insertTechnicalBriefOrFail(user, jobApplicationId)

    const { error } = await user.client.from('job_applications').delete().eq('id', jobApplicationId)

    expect(error).toBeNull()
    expect(await findTechnicalBriefsWithServiceRole(jobApplicationId)).toEqual([])
  })

  it('keeps the technical brief and clears cv_version_id when the cv version is deleted', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const versionId = await insertCvVersionOrFail(user)
    const briefId = await insertTechnicalBriefOrFail(user, jobApplicationId, { cv_version_id: versionId })

    const { error } = await user.client.from('cv_versions').delete().eq('id', versionId)

    expect(error).toBeNull()
    expect(await findTechnicalBriefsWithServiceRole(jobApplicationId)).toEqual([{ id: briefId, cv_version_id: null }])
  })

  it('refuses a second brief for the same job application and language', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await insertTechnicalBriefOrFail(user, jobApplicationId)

    const { error } = await user.client.from('technical_briefs').insert(buildTechnicalBriefInsert(user, jobApplicationId))

    expect(error?.code).toBe(UNIQUE_VIOLATION_CODE)
  })
})
