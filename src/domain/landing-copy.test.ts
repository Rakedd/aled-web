import { LANDING_COPY } from './landing-copy'

const SERIALIZED_LANDING_COPY = JSON.stringify(LANDING_COPY)

describe('LANDING_COPY', () => {
  it('never says freelance', () => {
    expect(SERIALIZED_LANDING_COPY).not.toMatch(/freelance/i)
  })

  it('never names another platform', () => {
    expect(SERIALIZED_LANDING_COPY).not.toMatch(/free-work|malt|collective/i)
  })

  it('walks through seven steps up to the first day', () => {
    expect(LANDING_COPY.journey.steps).toHaveLength(7)
    expect(LANDING_COPY.journey.steps.at(-1)?.title).toBe('Premier jour')
  })
})
