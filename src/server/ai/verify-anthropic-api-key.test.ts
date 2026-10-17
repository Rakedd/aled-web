/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicClient } from './create-anthropic-client'
import { verifyAnthropicApiKey } from './verify-anthropic-api-key'

jest.mock('server-only', () => ({}))
jest.mock('./create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))

const retrieveModel = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createAnthropicClient).mockReturnValue({ models: { retrieve: retrieveModel } } as unknown as Anthropic)
})

describe('verifyAnthropicApiKey', () => {
  it('accepts a key that can retrieve the extraction model', async () => {
    retrieveModel.mockResolvedValue({ id: 'claude-haiku-5-5' })
    await expect(verifyAnthropicApiKey('sk-ant-valid')).resolves.toBe(true)
    expect(createAnthropicClient).toHaveBeenCalledWith('sk-ant-valid')
    expect(retrieveModel.mock.calls[0][0]).toBe('claude-haiku-5-5')
  })

  it('rejects a key that Claude does not authenticate', async () => {
    retrieveModel.mockRejectedValue(new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()))
    await expect(verifyAnthropicApiKey('sk-ant-invalid')).resolves.toBe(false)
  })

  it('rejects a key without permission', async () => {
    retrieveModel.mockRejectedValue(new Anthropic.PermissionDeniedError(403, {}, 'forbidden', new Headers()))
    await expect(verifyAnthropicApiKey('sk-ant-forbidden')).resolves.toBe(false)
  })

  it('rethrows other failures so the user is asked to retry instead of being told the key is invalid', async () => {
    const serverError = new Anthropic.InternalServerError(500, {}, 'overloaded', new Headers())
    retrieveModel.mockRejectedValue(serverError)
    await expect(verifyAnthropicApiKey('sk-ant-valid')).rejects.toBe(serverError)
  })
})
