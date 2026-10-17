import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AI_ERROR_MESSAGES } from '@/domain/ai-errors'
import type { StackItem } from '@/domain/types'
import {
  confirmJobSpecStack,
  discardPendingJobSpecStack,
  getJobSpec,
  getJobSpecDownloadUrl,
  saveJobSpecText,
  uploadJobSpecPdf,
} from '@/server/actions/job-spec-actions'
import { extractJobSpecStack } from '@/server/ai/extract-job-spec-stack'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { Database } from '@/server/supabase/database-types'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/ai/extract-job-spec-stack', () => ({ extractJobSpecStack: jest.fn() }))

type TestUser = { client: SupabaseClient<Database>; userId: string }

const postingStack: StackItem[] = [{ name: 'Angular', category: 'framework', origin: 'posting' }]
const jobSpecStack: StackItem[] = [
  { name: 'React', category: 'framework', origin: 'job_spec' },
  { name: 'Kafka', category: 'tool', origin: 'job_spec' },
]

const signInAs = async (): Promise<TestUser> => {
  const user = await createSignedInTestClient(`job-specs-${randomUUID()}@test.local`)
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: user.userId, email: 'test@test.local' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(user.client)
  return user
}

const createPdfFormData = (fileContent: string): FormData => {
  const formData = new FormData()
  formData.append('jobSpecPdf', new File([fileContent], 'fiche.pdf', { type: 'application/pdf' }))
  return formData
}

const listStoredJobSpecFiles = async (user: TestUser, jobApplicationId: string): Promise<string[]> => {
  const { data, error } = await user.client.storage.from('job-specs').list(`${user.userId}/${jobApplicationId}`)
  if (error) throw error
  return data.map((storedFile) => storedFile.name)
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-test-key')
  jest.mocked(extractJobSpecStack).mockResolvedValue(jobSpecStack)
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('job spec actions', () => {
  it('refuses a .pdf file that does not start with %PDF- and stores nothing', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)

    const uploadResult = await uploadJobSpecPdf(jobApplicationId, createPdfFormData('<html>not a pdf</html>'))

    expect(uploadResult).toEqual({ ok: false, errorMessage: 'Seuls les PDF sont acceptés' })
    expect(await listStoredJobSpecFiles(user, jobApplicationId)).toEqual([])
    expect(await getJobSpec(jobApplicationId)).toEqual({ ok: true, data: null })
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })

  it('stores the pdf and keeps the extracted stack as a draft without touching the application stack', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { stack: postingStack })

    const uploadResult = await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.7 fiche métier'))

    expect(uploadResult).toEqual({ ok: true, data: { pendingStack: jobSpecStack, aiErrorMessage: null } })
    expect(extractJobSpecStack).toHaveBeenCalledWith(expect.anything(), {
      kind: 'pdf',
      base64Pdf: Buffer.from('%PDF-1.7 fiche métier').toString('base64'),
    })
    expect(await listStoredJobSpecFiles(user, jobApplicationId)).toEqual([expect.stringMatching(/\.pdf$/)])
    expect(await getJobSpec(jobApplicationId)).toEqual({
      ok: true,
      data: { sourceKind: 'pdf', rawText: null, pendingStack: jobSpecStack, updatedAt: expect.any(Date) },
    })
    const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewResult).toMatchObject({ ok: true, data: { stack: postingStack, hasJobSpec: true } })
  })

  it('keeps the job spec and returns the ai error message when the extraction fails', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    jest.mocked(extractJobSpecStack).mockRejectedValue(new Error('boom'))

    const saveResult = await saveJobSpecText(jobApplicationId, '  Mission React et Kafka  ')

    expect(saveResult).toEqual({ ok: true, data: { pendingStack: null, aiErrorMessage: AI_ERROR_MESSAGES.unknown } })
    expect(await getJobSpec(jobApplicationId)).toEqual({
      ok: true,
      data: { sourceKind: 'text', rawText: 'Mission React et Kafka', pendingStack: null, updatedAt: expect.any(Date) },
    })
  })

  it('keeps the job spec and asks for an api key when the user has none', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue(null)

    const uploadResult = await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.4'))

    expect(uploadResult).toEqual({
      ok: true,
      data: { pendingStack: null, aiErrorMessage: AI_ERROR_MESSAGES.missing_api_key },
    })
    expect(await listStoredJobSpecFiles(user, jobApplicationId)).toHaveLength(1)
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })

  it('returns an empty stack without storing a draft when the extraction finds no technology', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    jest.mocked(extractJobSpecStack).mockResolvedValue([])

    const uploadResult = await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.4 scanné'))

    expect(uploadResult).toEqual({ ok: true, data: { pendingStack: [], aiErrorMessage: null } })
    expect(await getJobSpec(jobApplicationId)).toMatchObject({ ok: true, data: { pendingStack: null } })
  })

  it('deletes the previous file from storage when the job spec is replaced', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.4 première version'))
    const [firstFileName] = await listStoredJobSpecFiles(user, jobApplicationId)

    await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.4 seconde version'))
    const filesAfterPdfReplacement = await listStoredJobSpecFiles(user, jobApplicationId)
    expect(filesAfterPdfReplacement).toHaveLength(1)
    expect(filesAfterPdfReplacement[0]).not.toBe(firstFileName)

    await saveJobSpecText(jobApplicationId, 'Fiche métier reçue par mail')
    expect(await listStoredJobSpecFiles(user, jobApplicationId)).toEqual([])
    expect(await getJobSpec(jobApplicationId)).toMatchObject({ ok: true, data: { sourceKind: 'text' } })
  })

  it('replaces the posting stack with the job spec stack on confirmation and clears the draft', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { stack: postingStack })
    await saveJobSpecText(jobApplicationId, 'Stack : React, Kafka')

    const confirmationResult = await confirmJobSpecStack(jobApplicationId, jobSpecStack)

    expect(confirmationResult).toEqual({ ok: true, data: null })
    const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewResult).toMatchObject({ ok: true, data: { stack: jobSpecStack } })
    expect(await getJobSpec(jobApplicationId)).toMatchObject({ ok: true, data: { pendingStack: null } })
  })

  it('discards the draft without touching the application stack', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { stack: postingStack })
    await saveJobSpecText(jobApplicationId, 'Stack : React, Kafka')

    expect(await discardPendingJobSpecStack(jobApplicationId)).toEqual({ ok: true, data: null })

    expect(await getJobSpec(jobApplicationId)).toMatchObject({ ok: true, data: { pendingStack: null } })
    const overviewResult = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewResult).toMatchObject({ ok: true, data: { stack: postingStack } })
  })

  it('gives a signed url that serves the stored pdf', async () => {
    const user = await signInAs()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    await uploadJobSpecPdf(jobApplicationId, createPdfFormData('%PDF-1.4 contenu signé'))

    const downloadUrlResult = await getJobSpecDownloadUrl(jobApplicationId)

    if (!downloadUrlResult.ok) throw new Error(downloadUrlResult.errorMessage)
    const downloadResponse = await fetch(downloadUrlResult.data)
    expect(downloadResponse.status).toBe(200)
    expect(await downloadResponse.text()).toBe('%PDF-1.4 contenu signé')
  })

  it("refuses to attach a job spec to another user's job application and stores nothing", async () => {
    const owner = await signInAs()
    const ownerJobApplicationId = await createJobApplicationOrFail(owner.client, owner.userId)
    const intruder = await signInAs()

    const uploadResult = await uploadJobSpecPdf(ownerJobApplicationId, createPdfFormData('%PDF-1.4'))
    const textResult = await saveJobSpecText(ownerJobApplicationId, 'Stack : React')

    expect(uploadResult).toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
    expect(textResult).toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
    expect(await listStoredJobSpecFiles(intruder, ownerJobApplicationId)).toEqual([])
    expect(extractJobSpecStack).not.toHaveBeenCalled()
  })
})
