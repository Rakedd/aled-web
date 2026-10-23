import { MAXIMUM_NAME_LENGTH } from './person-name'

describe('person name', () => {
  it('limits a first or last name to 100 characters', () => {
    expect(MAXIMUM_NAME_LENGTH).toBe(100)
  })
})
