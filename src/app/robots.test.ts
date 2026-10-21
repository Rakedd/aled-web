import robots from './robots'

describe('app robots.txt', () => {
  it('keeps every crawler out of the app', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } })
  })
})
