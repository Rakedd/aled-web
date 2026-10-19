/**
 * @jest-environment node
 */
import { toQuestionsRequestOptions } from './prepare-interview'

jest.mock('server-only', () => ({}))

describe('toQuestionsRequestOptions', () => {
  it('keeps the retry and the thirty second timeout with exactly sixty five seconds left', () => {
    expect(toQuestionsRequestOptions(65_000)).toEqual({ maxRetries: 1, timeout: 30_000 })
  })

  it('drops the retry just below sixty five seconds left', () => {
    expect(toQuestionsRequestOptions(64_999)).toEqual({ maxRetries: 0, timeout: 30_000 })
  })

  it('asks once within the remaining time with exactly ten seconds left', () => {
    expect(toQuestionsRequestOptions(10_000)).toEqual({ maxRetries: 0, timeout: 10_000 })
  })

  it('skips the questions when less than ten seconds are left', () => {
    expect(toQuestionsRequestOptions(9_999)).toBeNull()
  })
})
