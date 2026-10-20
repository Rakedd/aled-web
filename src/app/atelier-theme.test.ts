import fs from 'fs'
import path from 'path'

const GLOBALS_CSS = fs.readFileSync(path.join(__dirname, 'globals.css'), 'utf8')
const MINIMUM_TEXT_CONTRAST = 4.5

const extractRootColours = (): Record<string, string> => {
  const rootBlock = /:root\s*{([^}]*)}/.exec(GLOBALS_CSS)?.[1] ?? ''
  const colours: Record<string, string> = {}
  for (const match of rootBlock.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    colours[match[1]] = match[2]
  }
  return colours
}

const toLinearChannel = (channel: number) => {
  const ratio = channel / 255
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

const getRelativeLuminance = (hexColour: string) => {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    toLinearChannel(parseInt(hexColour.slice(start, start + 2), 16)),
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const getContrastRatio = (firstColour: string, secondColour: string) => {
  const [lighter, darker] = [getRelativeLuminance(firstColour), getRelativeLuminance(secondColour)].sort(
    (first, second) => second - first,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

const listTsxFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listTsxFiles(entryPath)
    return entry.name.endsWith('.tsx') ? [entryPath] : []
  })

const WHITE = '#FFFFFF'

const CONTRAST_PAIRS: Array<[string, string]> = [
  ['ink', 'sage'],
  ['ink-secondary', 'sage'],
  ['ink-muted', 'sage'],
  ['ink-muted', WHITE],
  ['ink-muted', 'surface-soft'],
  ['ink-muted', 'hairline'],
  [WHITE, 'forest'],
  ['on-forest', 'forest'],
  ['forest', 'hairline'],
  ['forest', WHITE],
  ['ink', 'peach'],
  ['ink-secondary', 'peach'],
  ['ink', 'lilac'],
  ['ink-muted', 'lilac'],
  ['peach-ink', 'peach-tint'],
  ['clay', 'clay-soft'],
  ['clay', 'clay-tint'],
  [WHITE, 'ink'],
  ['peach', 'ink'],
  ['on-forest', 'ink'],
]

describe('atelier theme', () => {
  const rootColours = extractRootColours()
  const resolveColour = (nameOrHex: string) => (nameOrHex.startsWith('#') ? nameOrHex : rootColours[nameOrHex])

  it.each(CONTRAST_PAIRS)('%s on %s reaches the minimum text contrast', (foreground, background) => {
    expect(resolveColour(foreground)).toBeDefined()
    expect(resolveColour(background)).toBeDefined()
    expect(getContrastRatio(resolveColour(foreground), resolveColour(background))).toBeGreaterThanOrEqual(
      MINIMUM_TEXT_CONTRAST,
    )
  })

  it('outlines focused controls of ink surfaces in a light token', () => {
    const darkSurfaceFocusUtility = /@utility focus-ring-on-dark\s*{([\s\S]*?)\n}/.exec(GLOBALS_CSS)?.[1] ?? ''
    expect(darkSurfaceFocusUtility).toMatch(/:focus-visible\s*{[^}]*outline:\s*2px solid var\(--on-forest\)/)
    expect(darkSurfaceFocusUtility).toMatch(/outline-offset:\s*2px/)
  })

  it('gives the ink Claude key card the light focus outline', () => {
    const preferencesPage = fs.readFileSync(path.join(__dirname, '(app)', 'preferences', 'page.tsx'), 'utf8')
    const apiKeySectionClassName = /aria-labelledby="settings-api-key-title" className="([^"]*)"/.exec(preferencesPage)?.[1]
    expect(apiKeySectionClassName?.split(' ')).toEqual(expect.arrayContaining(['bg-ink', 'focus-ring-on-dark']))
  })

  it('does not ship a dark mode in the stylesheet', () => {
    expect(GLOBALS_CSS).not.toContain('.dark')
    expect(GLOBALS_CSS).not.toContain('@custom-variant dark')
  })

  it('does not use dark variants in any component', () => {
    const filesWithDarkVariant = listTsxFiles(path.join(__dirname, '..')).filter((filePath) =>
      fs.readFileSync(filePath, 'utf8').includes('dark:'),
    )
    expect(filesWithDarkVariant.map((filePath) => path.relative(__dirname, filePath))).toEqual([])
  })
})
