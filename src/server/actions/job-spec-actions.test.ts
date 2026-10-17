/**
 * @jest-environment node
 */
import type { StackItem } from '@/domain/types'
import { extractJobSpecStack } from '@/server/ai/extract-job-spec-stack'
import { isJobApplicationOwnedByUser } from '@/server/repositories/job-application-ownership'
import {
  findJobSpecStoragePath,
  saveJobSpecContent,
  storePendingJobSpecStack,
  uploadJobSpecPdfFile,
} from '@/server/repositories/job-specs-repository'
import { getDecryptedAnthropicApiKeyForUser } from '@/server/repositories/profile-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { saveJobSpecText, uploadJobSpecPdf } from './job-spec-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('@/server/repositories/job-application-ownership', () => ({ isJobApplicationOwnedByUser: jest.fn() }))
jest.mock('@/server/ai/extract-job-spec-stack', () => ({ extractJobSpecStack: jest.fn() }))
jest.mock('@/server/repositories/job-specs-repository', () => ({
  findJobSpecStoragePath: jest.fn(),
  uploadJobSpecPdfFile: jest.fn(),
  saveJobSpecContent: jest.fn(),
  storePendingJobSpecStack: jest.fn(),
}))

const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'
const fakeSupabaseClient = {} as FreeclutchSupabaseClient
const extractedStack: StackItem[] = [{ name: 'ConfidentialFramework', category: 'framework', origin: 'job_spec' }]

const createPdfFormData = (): FormData => {
  const formData = new FormData()
  formData.append('jobSpecPdf', new File(['%PDF-1.7'], 'fiche.pdf', { type: 'application/pdf' }))
  return formData
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(isJobApplicationOwnedByUser).mockResolvedValue(true)
  jest.mocked(findJobSpecStoragePath).mockResolvedValue('user-1/application/previous.pdf')
  jest.mocked(uploadJobSpecPdfFile).mockResolvedValue('user-1/application/new.pdf')
  jest.mocked(saveJobSpecContent).mockResolvedValue({ ok: true, data: null })
  jest.mocked(storePendingJobSpecStack).mockResolvedValue(undefined)
  jest.mocked(getDecryptedAnthropicApiKeyForUser).mockResolvedValue('sk-ant-test-key')
  jest.mocked(extractJobSpecStack).mockResolvedValue(extractedStack)
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('uploadJobSpecPdf', () => {
  it('reads the previous storage path before uploading, then hands it over for cleanup', async () => {
    await uploadJobSpecPdf(JOB_APPLICATION_ID, createPdfFormData())
    const previousPathReadOrder = jest.mocked(findJobSpecStoragePath).mock.invocationCallOrder[0]
    const uploadOrder = jest.mocked(uploadJobSpecPdfFile).mock.invocationCallOrder[0]
    expect(previousPathReadOrder).toBeLessThan(uploadOrder)
    expect(saveJobSpecContent).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      JOB_APPLICATION_ID,
      { sourceKind: 'pdf', storagePath: 'user-1/application/new.pdf' },
      'user-1/application/previous.pdf',
    )
  })

  it('uploads nothing when the previous storage path cannot be read', async () => {
    jest.mocked(findJobSpecStoragePath).mockRejectedValue(new Error('Repository operation failed'))
    const uploadResult = await uploadJobSpecPdf(JOB_APPLICATION_ID, createPdfFormData())
    expect(uploadResult.ok).toBe(false)
    expect(uploadJobSpecPdfFile).not.toHaveBeenCalled()
  })

  it('still reports the saved job spec with its extracted stack when storing the draft fails', async () => {
    jest.mocked(storePendingJobSpecStack).mockRejectedValue(new Error('Repository operation failed with code 500'))
    const uploadResult = await uploadJobSpecPdf(JOB_APPLICATION_ID, createPdfFormData())
    expect(uploadResult).toEqual({ ok: true, data: { pendingStack: extractedStack, aiErrorMessage: null } })
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('ConfidentialFramework')
  })
})

describe('saveJobSpecText', () => {
  it('hands the previous storage path over so that the old pdf is removed', async () => {
    await saveJobSpecText(JOB_APPLICATION_ID, 'Stack : React')
    expect(saveJobSpecContent).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      JOB_APPLICATION_ID,
      { sourceKind: 'text', rawText: 'Stack : React' },
      'user-1/application/previous.pdf',
    )
  })

  it('still reports the saved job spec when storing the draft fails', async () => {
    jest.mocked(storePendingJobSpecStack).mockRejectedValue(new Error('Repository operation failed with code 500'))
    const saveResult = await saveJobSpecText(JOB_APPLICATION_ID, 'Stack : React')
    expect(saveResult).toEqual({ ok: true, data: { pendingStack: extractedStack, aiErrorMessage: null } })
  })
})
