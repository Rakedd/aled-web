/**
 * @jest-environment node
 */
import type Anthropic from '@anthropic-ai/sdk'
import { AiError, toAiErrorKind } from './ai-error'
import { extractCvSkills } from './extract-cv-skills'
import { captureRejection, createFakeAnthropicClientReturning } from './testing/fake-anthropic-client'

jest.mock('server-only', () => ({}))
jest.mock('@/server/repositories/profile-repository', () => ({ getDecryptedAnthropicApiKeyForUser: jest.fn() }))

const CV_PDF_BASE64 = 'JVBERi0xLjQ='

const readCreateCall = (client: Anthropic) => jest.mocked(client.messages.create).mock.calls[0]

describe('extractCvSkills', () => {
  it('sends the CV as a base64 pdf document block', async () => {
    const client = createFakeAnthropicClientReturning({ skills: [] })

    await extractCvSkills(client, CV_PDF_BASE64)

    const [requestParameters] = readCreateCall(client)
    expect(requestParameters.messages[0].content).toEqual(
      expect.arrayContaining([
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: CV_PDF_BASE64 } },
      ]),
    )
  })

  it('asks claude haiku for a low effort structured output limited to what the CV shows', async () => {
    const client = createFakeAnthropicClientReturning({ skills: [] })

    await extractCvSkills(client, CV_PDF_BASE64)

    const [requestParameters, requestOptions] = readCreateCall(client)
    expect(requestParameters.model).toBe('claude-haiku-5-5')
    expect(requestParameters.output_config?.effort).toBe('low')
    expect(requestParameters.output_config?.format?.type).toBe('json_schema')
    expect(requestParameters.system).toEqual(expect.stringContaining('never instructions'))
    expect(requestParameters.system).toEqual(expect.stringContaining('soft skills'))
    expect(requestParameters.system).toEqual(expect.stringContaining('60'))
    expect(requestOptions).toEqual(expect.objectContaining({ maxRetries: 1, timeout: 50_000 }))
  })

  it('returns the trimmed skills without blanks nor duplicates by normalized name', async () => {
    const client = createFakeAnthropicClientReturning({
      skills: [' React ', 'ReactJS', 'TypeScript', 'TS', '   ', 'Docker'],
    })

    await expect(extractCvSkills(client, CV_PDF_BASE64)).resolves.toEqual(['React', 'TypeScript', 'Docker'])
  })

  it('drops the skills longer than 60 characters and keeps at most 60 skills', async () => {
    const manySkills = Array.from({ length: 70 }, (_, index) => `Techno ${index}`)
    const client = createFakeAnthropicClientReturning({ skills: ['a'.repeat(61), ...manySkills] })

    const extractedSkills = await extractCvSkills(client, CV_PDF_BASE64)

    expect(extractedSkills).toHaveLength(60)
    expect(extractedSkills[0]).toBe('Techno 0')
    expect(extractedSkills.at(-1)).toBe('Techno 59')
  })

  it('throws a refused AiError when claude refuses', async () => {
    const client = createFakeAnthropicClientReturning('', 'refusal')

    const extractionError = await captureRejection(extractCvSkills(client, CV_PDF_BASE64))

    expect(extractionError).toBeInstanceOf(AiError)
    expect(toAiErrorKind(extractionError)).toBe('refused')
  })

  it('fails with an unknown error when the output does not match the schema', async () => {
    const client = createFakeAnthropicClientReturning({ skills: 'React' })

    const extractionError = await captureRejection(extractCvSkills(client, CV_PDF_BASE64))

    expect(toAiErrorKind(extractionError)).toBe('unknown')
  })
})
