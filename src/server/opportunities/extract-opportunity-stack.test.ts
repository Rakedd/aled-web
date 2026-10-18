/**
 * @jest-environment node
 */
import Anthropic from '@anthropic-ai/sdk'
import type { StackItem } from '@/domain/types'
import { extractOpportunityStack } from './extract-opportunity-stack'

jest.mock('server-only', () => ({}))

const description = 'Mission confidentielle : React, TypeScript et Scrum chez un grand compte'

const createDependencies = (apiKey: string | null, extractedStack: StackItem[] = []) => ({
  getApiKey: jest.fn().mockResolvedValue(apiKey),
  extract: jest.fn().mockResolvedValue(extractedStack),
})

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('extractOpportunityStack', () => {
  it('returns an empty stack without calling the extraction when the user has no Claude key', async () => {
    const dependencies = createDependencies(null)

    await expect(extractOpportunityStack(dependencies, description)).resolves.toEqual([])
    expect(dependencies.extract).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it.each([null, '', '   '])('returns an empty stack without any call when the description is %p', async (blankDescription) => {
    const dependencies = createDependencies('sk-ant-api03-key')

    await expect(extractOpportunityStack(dependencies, blankDescription)).resolves.toEqual([])
    expect(dependencies.getApiKey).not.toHaveBeenCalled()
    expect(dependencies.extract).not.toHaveBeenCalled()
  })

  it('extracts the stack from the description with the user key', async () => {
    const dependencies = createDependencies('sk-ant-api03-key')

    await extractOpportunityStack(dependencies, description)

    expect(dependencies.extract).toHaveBeenCalledWith('sk-ant-api03-key', description)
  })

  it('tags the extracted items as coming from the posting', async () => {
    const dependencies = createDependencies('sk-ant-api03-key', [
      { name: 'React', category: 'framework', origin: 'job_spec' },
      { name: 'Scrum', category: 'method', origin: 'job_spec' },
    ])

    await expect(extractOpportunityStack(dependencies, description)).resolves.toEqual([
      { name: 'React', category: 'framework', origin: 'posting' },
      { name: 'Scrum', category: 'method', origin: 'posting' },
    ])
  })

  it('returns an empty stack and logs only the kind of error when the extraction fails', async () => {
    const dependencies = createDependencies('sk-ant-api03-key')
    dependencies.extract.mockRejectedValue(new Anthropic.RateLimitError(429, {}, description, new Headers()))

    await expect(extractOpportunityStack(dependencies, description)).resolves.toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith('Opportunity stack extraction failed', {
      aiErrorKind: 'rate_limited',
      httpStatus: 429,
      errorName: 'RateLimitError',
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(description)
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('sk-ant-api03-key')
  })

  it('returns an empty stack when reading the key fails', async () => {
    const dependencies = createDependencies(null)
    dependencies.getApiKey.mockRejectedValue(new Error('Decryption failure'))

    await expect(extractOpportunityStack(dependencies, description)).resolves.toEqual([])
    expect(dependencies.extract).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Opportunity stack extraction failed',
      expect.objectContaining({ aiErrorKind: 'unknown' }),
    )
  })
})
