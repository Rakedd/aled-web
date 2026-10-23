/**
 * @jest-environment node
 */
import { AiError, toAiErrorKind } from './ai-error'
import { extractJobPosting } from './extract-job-posting'
import { createFakeAnthropicClientReturning, emptyExtraction } from './testing/fake-anthropic-client'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))
jest.mock('./create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))

const readCreateCall = (client: ReturnType<typeof createFakeAnthropicClientReturning>) =>
  jest.mocked(client.messages.create).mock.calls[0]

describe('extractJobPosting', () => {
  it('returns all-null fields without throwing for an unrelated text', async () => {
    const client = createFakeAnthropicClientReturning({
      title: null,
      intermediaryName: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      endClientName: null,
      postedDailyRate: null,
      location: null,
      remotePolicy: null,
      desiredStart: null,
      duration: null,
      stack: [],
    })
    await expect(extractJobPosting(client, 'Salut, dispo pour un café ?')).resolves.toMatchObject({
      title: null,
      stack: [],
    })
  })

  it('tags every extracted stack item with origin posting', async () => {
    const client = createFakeAnthropicClientReturning({
      ...emptyExtraction,
      stack: [{ name: 'React', category: 'framework' }],
    })
    const result = await extractJobPosting(client, 'Mission React')
    expect(result.stack).toEqual([{ name: 'React', category: 'framework', origin: 'posting' }])
  })

  it('files a stack item under other when claude returns an unexpected category', async () => {
    const client = createFakeAnthropicClientReturning({
      ...emptyExtraction,
      stack: [{ name: 'PostgreSQL', category: 'database' }],
    })
    const result = await extractJobPosting(client, 'Mission PostgreSQL')
    expect(result.stack).toEqual([{ name: 'PostgreSQL', category: 'other', origin: 'posting' }])
  })

  it('returns every extracted field', async () => {
    const modelExtraction = {
      title: 'Développeur React senior',
      intermediaryName: 'Talentis',
      contactName: 'Julie Martin',
      contactEmail: 'julie@talentis.fr',
      contactPhone: '06 12 34 56 78',
      endClientName: 'BNP Paribas AM',
      postedDailyRate: 600,
      location: 'Paris',
      remotePolicy: '2 jours de télétravail',
      desiredStart: 'ASAP',
      duration: '6 mois',
      stack: [],
    }
    const client = createFakeAnthropicClientReturning(modelExtraction)
    await expect(extractJobPosting(client, 'Mission React chez BNP Paribas AM')).resolves.toEqual(modelExtraction)
  })

  it('asks claude haiku for a low effort structured output with the posting as data', async () => {
    const client = createFakeAnthropicClientReturning(emptyExtraction)
    await extractJobPosting(client, 'Mission React')
    const [requestParameters, requestOptions] = readCreateCall(client)
    expect(requestParameters.model).toBe('claude-haiku-5-5')
    expect(requestParameters.output_config?.effort).toBe('low')
    expect(requestParameters.output_config?.format?.type).toBe('json_schema')
    expect(JSON.stringify(requestParameters.messages)).toContain('Mission React')
    expect(requestParameters.system).toEqual(expect.stringContaining('null'))
    expect(requestOptions).toEqual(expect.objectContaining({ maxRetries: 1 }))
  })

  it('waits one minute per attempt and retries once by default', async () => {
    const client = createFakeAnthropicClientReturning(emptyExtraction)
    await extractJobPosting(client, 'Mission React')
    const [, requestOptions] = readCreateCall(client)
    expect(requestOptions).toEqual({ maxRetries: 1, timeout: 60_000 })
  })

  it('applies the request limits given by a caller with a shorter time budget', async () => {
    const client = createFakeAnthropicClientReturning(emptyExtraction)
    await extractJobPosting(client, 'Mission React', { timeoutInMilliseconds: 50_000, maxRetries: 0 })
    const [, requestOptions] = readCreateCall(client)
    expect(requestOptions).toEqual({ maxRetries: 0, timeout: 50_000 })
  })

  it('does not ask the model for the stack item origin', async () => {
    const client = createFakeAnthropicClientReturning(emptyExtraction)
    await extractJobPosting(client, 'Mission React')
    const [requestParameters] = readCreateCall(client)
    expect(JSON.stringify(requestParameters.output_config?.format?.schema)).not.toContain('origin')
  })

  it('throws a refused AiError when claude refuses, before reading the content', async () => {
    const client = createFakeAnthropicClientReturning('', 'refusal')
    const extractionError = await extractJobPosting(client, 'Mission React').catch((error: unknown) => error)
    expect(extractionError).toBeInstanceOf(AiError)
    expect(toAiErrorKind(extractionError)).toBe('refused')
  })

  it('fails with an unknown error when the output does not match the schema', async () => {
    const client = createFakeAnthropicClientReturning({ title: 42 })
    const extractionError = await extractJobPosting(client, 'Mission React').catch((error: unknown) => error)
    expect(toAiErrorKind(extractionError)).toBe('unknown')
  })
})
