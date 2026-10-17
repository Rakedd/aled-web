/**
 * @jest-environment node
 */
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { recordActivityLogEntry } from './activity-log-repository'
import { resolveJobApplicationEntityColumns } from './entities-repository'
import { updateJobApplicationRow } from './job-applications-repository'

jest.mock('server-only', () => ({}))
jest.mock('./activity-log-repository', () => ({ recordActivityLogEntry: jest.fn() }))
jest.mock('./entities-repository', () => ({ resolveJobApplicationEntityColumns: jest.fn() }))

const jobApplicationId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'

const overviewRow = {
  id: jobApplicationId,
  user_id: 'user-1',
  title: 'Développeur React',
  source: null,
  posting_url: null,
  posting_raw_text: null,
  status: 'applied',
  intermediary_id: null,
  contact_id: null,
  end_client_id: null,
  posted_daily_rate: null,
  requested_daily_rate: null,
  location: null,
  remote_policy: null,
  desired_start: null,
  duration: null,
  applied_on: '2026-10-01',
  notes: null,
  actual_start_date: null,
  stack: [],
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  last_activity_at: null,
  has_job_spec: false,
  intermediary_name: null,
  contact_name: null,
  end_client_name: null,
  end_client_parent_name: null,
}

const createFakeSupabaseClient = (statusUpdateResult: { id: string } | null) => {
  const queryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    update: jest.fn(),
    maybeSingle: jest
      .fn()
      .mockResolvedValueOnce({ data: overviewRow, error: null })
      .mockResolvedValueOnce({ data: { status: 'applied' }, error: null })
      .mockResolvedValueOnce({ data: statusUpdateResult, error: null }),
    then: jest.fn((resolve: (result: { error: null }) => unknown) => resolve({ error: null })),
  }
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)
  const supabaseClient = { from: jest.fn().mockReturnValue(queryBuilder) } as unknown as FreeclutchSupabaseClient
  return { supabaseClient, queryBuilder }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveJobApplicationEntityColumns).mockResolvedValue({ ok: true, data: {} })
  jest.mocked(recordActivityLogEntry).mockResolvedValue({ ok: true, data: null })
})

describe('updateJobApplicationRow', () => {
  it('saves nothing else when the status change loses a race', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClient(null)

    await expect(
      updateJobApplicationRow(supabaseClient, 'user-1', jobApplicationId, {
        status: 'cv_submitted',
        notes: 'Rappeler lundi',
        intermediaryName: 'Agence X',
      }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Le statut a changé entre-temps. Recharge la page et réessaie.' })
    expect(queryBuilder.update).toHaveBeenCalledTimes(1)
    expect(queryBuilder.update).toHaveBeenCalledWith({ status: 'cv_submitted' })
    expect(resolveJobApplicationEntityColumns).not.toHaveBeenCalled()
    expect(recordActivityLogEntry).not.toHaveBeenCalled()
  })

  it('changes the status before saving the other fields', async () => {
    const { supabaseClient, queryBuilder } = createFakeSupabaseClient({ id: jobApplicationId })

    await expect(
      updateJobApplicationRow(supabaseClient, 'user-1', jobApplicationId, { status: 'cv_submitted', notes: 'Rappeler lundi' }),
    ).resolves.toEqual({ ok: true, data: null })
    expect(queryBuilder.update.mock.calls).toEqual([[{ status: 'cv_submitted' }], [{ notes: 'Rappeler lundi' }]])
    expect(jest.mocked(recordActivityLogEntry).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(resolveJobApplicationEntityColumns).mock.invocationCallOrder[0],
    )
  })
})
