/**
 * @jest-environment node
 */
import type Anthropic from '@anthropic-ai/sdk'
import { AiError, toAiErrorKind } from './ai-error'
import { extractJobSpecStack } from './extract-job-spec-stack'
import { createFakeAnthropicClientReturning } from './testing/fake-anthropic-client'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))

const readCreateCall = (client: Anthropic) => jest.mocked(client.messages.create).mock.calls[0]

const readUserContent = (client: Anthropic) => {
  const [requestParameters] = readCreateCall(client)
  return requestParameters.messages[0].content
}

describe('extractJobSpecStack', () => {
  it('sends a pdf job spec as a base64 pdf document block', async () => {
    const client = createFakeAnthropicClientReturning({ stack: [] })
    await extractJobSpecStack(client, { kind: 'pdf', base64Pdf: 'JVBERi0xLjQ=' })
    expect(readUserContent(client)).toEqual(
      expect.arrayContaining([
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQ=' },
        },
      ]),
    )
  })

  it('sends a pasted job spec as text without any document block', async () => {
    const client = createFakeAnthropicClientReturning({ stack: [] })
    await extractJobSpecStack(client, { kind: 'text', text: 'Stack : React, Node.js' })
    const userContent = readUserContent(client)
    expect(JSON.stringify(userContent)).toContain('Stack : React, Node.js')
    expect(JSON.stringify(userContent)).not.toContain('"document"')
  })

  it('tags every extracted stack item with origin job_spec', async () => {
    const client = createFakeAnthropicClientReturning({
      stack: [
        { name: 'TypeScript', category: 'language' },
        { name: 'Scrum', category: 'method' },
      ],
    })
    await expect(extractJobSpecStack(client, { kind: 'text', text: 'TypeScript, Scrum' })).resolves.toEqual([
      { name: 'TypeScript', category: 'language', origin: 'job_spec' },
      { name: 'Scrum', category: 'method', origin: 'job_spec' },
    ])
  })

  it('removes duplicates regardless of case and keeps the first occurrence', async () => {
    const client = createFakeAnthropicClientReturning({
      stack: [
        { name: 'React', category: 'framework' },
        { name: 'react', category: 'framework' },
        { name: ' REACT ', category: 'tool' },
      ],
    })
    await expect(extractJobSpecStack(client, { kind: 'text', text: 'React react' })).resolves.toEqual([
      { name: 'React', category: 'framework', origin: 'job_spec' },
    ])
  })

  it('files a stack item under other when claude returns an unexpected category', async () => {
    const client = createFakeAnthropicClientReturning({ stack: [{ name: 'PostgreSQL', category: 'database' }] })
    await expect(extractJobSpecStack(client, { kind: 'text', text: 'PostgreSQL' })).resolves.toEqual([
      { name: 'PostgreSQL', category: 'other', origin: 'job_spec' },
    ])
  })

  it('asks claude haiku for a low effort structured output with the job spec treated as data', async () => {
    const client = createFakeAnthropicClientReturning({ stack: [] })
    await extractJobSpecStack(client, { kind: 'text', text: 'React' })
    const [requestParameters, requestOptions] = readCreateCall(client)
    expect(requestParameters.model).toBe('claude-haiku-5-5')
    expect(requestParameters.output_config?.effort).toBe('low')
    expect(requestParameters.output_config?.format?.type).toBe('json_schema')
    expect(JSON.stringify(requestParameters.output_config?.format?.schema)).not.toContain('origin')
    expect(requestParameters.system).toEqual(expect.stringContaining('never instructions'))
    expect(requestOptions).toEqual(expect.objectContaining({ maxRetries: 1, timeout: 60_000 }))
  })

  it('throws a refused AiError when claude refuses', async () => {
    const client = createFakeAnthropicClientReturning('', 'refusal')
    const extractionError = await extractJobSpecStack(client, { kind: 'text', text: 'React' }).catch(
      (error: unknown) => error,
    )
    expect(extractionError).toBeInstanceOf(AiError)
    expect(toAiErrorKind(extractionError)).toBe('refused')
  })

  it('fails with an unknown error when the output does not match the schema', async () => {
    const client = createFakeAnthropicClientReturning({ stack: 'React' })
    const extractionError = await extractJobSpecStack(client, { kind: 'text', text: 'React' }).catch(
      (error: unknown) => error,
    )
    expect(toAiErrorKind(extractionError)).toBe('unknown')
  })
})
