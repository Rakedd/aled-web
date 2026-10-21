/** @jest-environment node */
import { readLightThemeColour } from './read-light-theme-colour'

describe('readLightThemeColour', () => {
  it('reads a colour token of the light theme', () => {
    expect(readLightThemeColour('brand-tile')).toBe('#1F5C46')
    expect(readLightThemeColour('peach')).toBe('#FFB48A')
  })

  it('follows a token that points to another token', () => {
    expect(readLightThemeColour('foreground')).toBe('#16231D')
  })

  it('refuses an unknown token', () => {
    expect(() => readLightThemeColour('inexistant')).toThrow('Unknown light theme colour token --inexistant')
  })
})
