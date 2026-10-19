import { pluralizeFrench } from './french-plural'

describe('pluralizeFrench', () => {
  it.each([
    [0, 'chose'],
    [1, 'chose'],
    [2, 'choses'],
  ])('uses the right form for %i', (count, expectedWord) => {
    expect(pluralizeFrench(count, 'chose', 'choses')).toBe(expectedWord)
  })
})
