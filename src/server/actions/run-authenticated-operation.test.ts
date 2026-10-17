/**
 * @jest-environment node
 */
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import { runAuthenticatedOperation } from './run-authenticated-operation'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
})

describe('runAuthenticatedOperation', () => {
  it('runs the operation for the authenticated user with the validated arguments', async () => {
    const operation = jest.fn().mockResolvedValue({ ok: true, data: 'done' })

    await expect(
      runAuthenticatedOperation({
        operationName: 'testOperation',
        failureMessage: 'Échec',
        validateArguments: () => ({ ok: true, data: { jobApplicationId: 'job-1' } }),
        operation,
      }),
    ).resolves.toEqual({ ok: true, data: 'done' })
    expect(operation).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', { jobApplicationId: 'job-1' })
  })

  it('authenticates before validating and returns the validation error without running the operation', async () => {
    const operation = jest.fn()
    const validateArguments = jest.fn().mockReturnValue({ ok: false, errorMessage: 'Candidature introuvable' })

    await expect(
      runAuthenticatedOperation({ operationName: 'testOperation', failureMessage: 'Échec', validateArguments, operation }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Candidature introuvable' })
    expect(getAuthenticatedUser).toHaveBeenCalled()
    expect(jest.mocked(getAuthenticatedUser).mock.invocationCallOrder[0]).toBeLessThan(
      validateArguments.mock.invocationCallOrder[0],
    )
    expect(operation).not.toHaveBeenCalled()
  })

  it('lets the login redirect of an unauthenticated user propagate', async () => {
    const redirectError = new Error('NEXT_REDIRECT')
    jest.mocked(getAuthenticatedUser).mockRejectedValue(redirectError)
    const operation = jest.fn()

    await expect(
      runAuthenticatedOperation({
        operationName: 'testOperation',
        failureMessage: 'Échec',
        validateArguments: () => ({ ok: true, data: null }),
        operation,
      }),
    ).rejects.toBe(redirectError)
    expect(operation).not.toHaveBeenCalled()
  })

  it('logs an unexpected failure without its details and returns the generic message', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      runAuthenticatedOperation({
        operationName: 'testOperation',
        failureMessage: 'Échec',
        validateArguments: () => ({ ok: true, data: null }),
        operation: () => Promise.reject(new Error('Repository operation failed with code 42P01')),
      }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Échec' })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Action testOperation failed', {
      errorMessage: 'Repository operation failed with code 42P01',
    })
    consoleErrorSpy.mockRestore()
  })
})
