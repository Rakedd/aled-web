/**
 * @jest-environment node
 */
import { toCallApiError } from '@/domain/call-log'
import type { JobApplicationInput } from '@/domain/job-application'
import { buildJobApplicationInputFromMobileRequest } from '@/domain/mobile-job-application-request'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { createJobApplicationForMobileUser } from './create-job-application-for-mobile-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/job-applications-repository', () => ({ insertJobApplication: jest.fn() }))

const supabase = {} as FreeclutchSupabaseClient
const userId = 'user-1'
const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const buildInput = (): JobApplicationInput => {
  const buildResult = buildJobApplicationInputFromMobileRequest({ title: 'Lead dev' }, new Date('2026-10-23T10:00:00Z'))
  if (!buildResult.ok) throw new Error(buildResult.errorMessage)
  return buildResult.data
}

describe('createJobApplicationForMobileUser', () => {
  beforeEach(() => jest.resetAllMocks())

  it('inserts the job application for the user and answers its id', async () => {
    jest.mocked(insertJobApplication).mockResolvedValue({ ok: true, data: { id: JOB_APPLICATION_ID } })
    const input = buildInput()
    expect(await createJobApplicationForMobileUser(supabase, userId, input)).toEqual({
      ok: true,
      data: { jobApplicationId: JOB_APPLICATION_ID },
    })
    expect(insertJobApplication).toHaveBeenCalledWith(supabase, userId, input)
  })

  it('answers a rejection with the repository wording', async () => {
    jest.mocked(insertJobApplication).mockResolvedValue({ ok: false, errorMessage: 'Groupe invalide' })
    expect(await createJobApplicationForMobileUser(supabase, userId, buildInput())).toEqual({
      ok: false,
      error: toCallApiError('rejected', 'Groupe invalide'),
    })
  })

  it('lets a database failure reach the route', async () => {
    jest.mocked(insertJobApplication).mockRejectedValue(new Error('database down'))
    await expect(createJobApplicationForMobileUser(supabase, userId, buildInput())).rejects.toThrow('database down')
  })
})
