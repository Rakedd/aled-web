/**
 * @jest-environment node
 */
import { saveEndClientNotes } from '@/server/repositories/client-brief-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import type { FreeclutchSupabaseClient } from '@/server/supabase/freeclutch-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { updateEndClientNotes } from './client-brief-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/client-brief-repository', () => ({ saveEndClientNotes: jest.fn() }))

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const fakeSupabaseClient = {} as FreeclutchSupabaseClient

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
  jest.mocked(saveEndClientNotes).mockResolvedValue({ ok: true, data: null })
})

describe('updateEndClientNotes', () => {
  it('stores trimmed notes, and empty notes as null', async () => {
    await updateEndClientNotes(END_CLIENT_ID, '  Parler de Kafka  ')
    await updateEndClientNotes(END_CLIENT_ID, '   ')

    expect(saveEndClientNotes).toHaveBeenNthCalledWith(1, fakeSupabaseClient, 'user-1', END_CLIENT_ID, 'Parler de Kafka')
    expect(saveEndClientNotes).toHaveBeenNthCalledWith(2, fakeSupabaseClient, 'user-1', END_CLIENT_ID, null)
  })

  it('refuses notes that are not text or too long', async () => {
    expect(await updateEndClientNotes(END_CLIENT_ID, 42 as unknown as string)).toEqual({
      ok: false,
      errorMessage: 'Notes invalides',
    })
    expect(await updateEndClientNotes(END_CLIENT_ID, 'a'.repeat(10_001))).toEqual({
      ok: false,
      errorMessage: 'Notes : 10000 caractères maximum',
    })
    expect(saveEndClientNotes).not.toHaveBeenCalled()
  })
})
