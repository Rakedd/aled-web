import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobApplicationInput } from '@/domain/job-application'
import { insertJobApplication } from '@/server/repositories/job-applications-repository'
import type { Database } from '@/server/supabase/database-types'

export const buildJobApplicationInput = (overrides: Partial<JobApplicationInput> = {}): JobApplicationInput => ({
  title: 'Développeur React',
  source: 'LinkedIn',
  postingUrl: null,
  postingRawText: null,
  status: 'applied',
  postedDailyRate: null,
  requestedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  appliedOn: new Date('2026-10-01T10:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [],
  intermediaryName: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  endClientName: null,
  endClientParentName: null,
  ...overrides,
})

export const createJobApplicationOrFail = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  overrides: Partial<JobApplicationInput> = {},
): Promise<string> => {
  const insertionResult = await insertJobApplication(supabase, userId, buildJobApplicationInput(overrides))
  if (!insertionResult.ok) throw new Error(insertionResult.errorMessage)
  return insertionResult.data.id
}
