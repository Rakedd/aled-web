import fs from 'fs'
import path from 'path'

const GLOBALS_CSS = fs.readFileSync(path.join(__dirname, 'globals.css'), 'utf8')
const MINIMUM_TEXT_CONTRAST = 4.5
const MINIMUM_POPOVER_HIGHLIGHT_CONTRAST = 1.5

const resolveThemeColours = (theme: 'light' | 'dark' = 'light'): Record<string, string> => {
  const rootBlock = /:root\s*{([^}]*)}/.exec(GLOBALS_CSS)?.[1] ?? ''
  const darkBlock = theme === 'dark' ? (/:root\[data-theme='dark'\]\s*{([^}]*)}/.exec(GLOBALS_CSS)?.[1] ?? '') : ''
  const declaredValues: Record<string, string> = {}
  for (const match of rootBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    declaredValues[match[1]] = match[2].trim()
  }
  if (theme === 'dark') {
    for (const match of darkBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
      declaredValues[match[1]] = match[2].trim()
    }
  }
  const resolveValue = (value: string): string | undefined => {
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value
    const referencedName = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1]
    return referencedName === undefined ? undefined : resolveValue(declaredValues[referencedName] ?? '')
  }
  const colours: Record<string, string> = {}
  for (const [name, value] of Object.entries(declaredValues)) {
    const resolvedColour = resolveValue(value)
    if (resolvedColour !== undefined) colours[name] = resolvedColour
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

const listSourceFiles = (directory: string, extensions: string[]): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(entryPath, extensions)
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [entryPath] : []
  })

const listTsxFiles = (directory: string) => listSourceFiles(directory, ['.tsx'])

const LIGHT_THEME_COLOURS: Record<string, string> = {
  sage: '#F2F4F1',
  card: '#FFFFFF',
  'surface-soft': '#F7F9F7',
  hairline: '#E6ECE8',
  'hairline-strong': '#DDE3DE',
  'control-border': '#C9D3CC',
  ink: '#16231D',
  'ink-secondary': '#3B4A42',
  'ink-muted': '#55625B',
  primary: '#1F5C46',
  'primary-foreground': '#FFFFFF',
  'accent-text': '#1F5C46',
  'brand-tile': '#1F5C46',
  'on-brand-tile': '#FFFFFF',
  'on-brand-tile-secondary': '#CFE3D8',
  'deep-surface': '#16231D',
  'on-deep-surface': '#FFFFFF',
  'on-deep-surface-secondary': '#E6ECE8',
  'on-deep-surface-soft': '#CFE3D8',
  peach: '#FFB48A',
  'on-peach': '#16231D',
  'peach-tint': '#FFF1E8',
  'peach-soft': '#FFF1E8',
  'peach-ink': '#8A4B1F',
  lilac: '#DCD6F7',
  'on-lilac': '#16231D',
  'lilac-tint': '#F2F0FC',
  'lilac-soft': '#F2F0FC',
  'on-lilac-soft': '#16231D',
  'lilac-panel': '#DCD6F7',
  'forest-soft': '#E6ECE8',
  'on-forest-soft': '#1F5C46',
  clay: '#8A3B32',
  'clay-soft': '#F1E3E1',
  'clay-tint': '#FBF1EF',
  popover: '#FFFFFF',
  'popover-highlight': '#F7F9F7',
  'menu-counter': '#FFB48A',
  'on-menu-counter': '#16231D',
  'settings-navigation-active': '#16231D',
  'on-settings-navigation-active': '#FFFFFF',
  background: '#F2F4F1',
  foreground: '#16231D',
  ring: '#1F5C46',
  destructive: '#8A3B32',
  muted: '#F7F9F7',
  input: '#C9D3CC',
}

const DARK_THEME_COLOURS: Record<string, string> = {
  sage: '#171513',
  card: '#211E1B',
  'surface-soft': '#2A2622',
  hairline: '#34302B',
  'hairline-strong': '#3C3732',
  'control-border': '#423D37',
  ink: '#F1ECE6',
  'ink-secondary': '#C8BFB5',
  'ink-muted': '#A0968B',
  primary: '#E9A27C',
  'primary-foreground': '#1A120C',
  'accent-text': '#EDB08E',
  'brand-tile': '#2D4B3B',
  'on-brand-tile': '#F1ECE6',
  'on-brand-tile-secondary': '#D3DDCF',
  'deep-surface': '#100E0C',
  'on-deep-surface': '#F1ECE6',
  'on-deep-surface-secondary': '#C8BFB5',
  'on-deep-surface-soft': '#C8BFB5',
  peach: '#E9A27C',
  'on-peach': '#1A120C',
  'peach-tint': '#2D221A',
  'peach-soft': '#3A2A1E',
  'peach-ink': '#F2B48E',
  lilac: '#C9BFE6',
  'on-lilac': '#15132A',
  'lilac-tint': '#231F2C',
  'lilac-soft': '#2B2638',
  'on-lilac-soft': '#D4CEF5',
  'lilac-panel': '#2B2638',
  'forest-soft': '#26302A',
  'on-forest-soft': '#A9CBA9',
  clay: '#F1A79D',
  'clay-soft': '#3A2420',
  'clay-tint': '#2D1E1B',
  popover: '#2A2622',
  'popover-highlight': '#4A433C',
  'menu-counter': '#C9BFE6',
  'on-menu-counter': '#15132A',
  'settings-navigation-active': '#E9A27C',
  'on-settings-navigation-active': '#1A120C',
  background: '#171513',
  ring: '#E9A27C',
  destructive: '#F1A79D',
  muted: '#2A2622',
}

const ROLE_CONTRAST_PAIRS: Array<[string, string]> = [
  ['ink', 'sage'],
  ['ink-secondary', 'sage'],
  ['ink-muted', 'sage'],
  ['ink', 'card'],
  ['ink-muted', 'card'],
  ['ink-muted', 'surface-soft'],
  ['ink', 'hairline'],
  ['ink-muted', 'hairline'],
  ['ink', 'popover'],
  ['ink', 'popover-highlight'],
  ['primary-foreground', 'primary'],
  ['accent-text', 'card'],
  ['accent-text', 'sage'],
  ['accent-text', 'surface-soft'],
  ['on-brand-tile', 'brand-tile'],
  ['on-brand-tile-secondary', 'brand-tile'],
  ['on-deep-surface', 'deep-surface'],
  ['on-deep-surface-secondary', 'deep-surface'],
  ['on-deep-surface-soft', 'deep-surface'],
  ['peach', 'deep-surface'],
  ['on-peach', 'peach'],
  ['on-lilac', 'lilac'],
  ['ink', 'peach-tint'],
  ['ink-muted', 'peach-tint'],
  ['peach-ink', 'peach-soft'],
  ['ink', 'lilac-tint'],
  ['ink-muted', 'lilac-tint'],
  ['on-lilac-soft', 'lilac-soft'],
  ['ink', 'lilac-panel'],
  ['ink-secondary', 'lilac-panel'],
  ['ink-muted', 'lilac-panel'],
  ['destructive', 'lilac-panel'],
  ['accent-text', 'lilac-panel'],
  ['on-forest-soft', 'forest-soft'],
  ['clay', 'clay-soft'],
  ['clay', 'clay-tint'],
  ['ink', 'clay-tint'],
  ['ink-muted', 'clay-tint'],
  ['destructive', 'card'],
  ['destructive', 'sage'],
  ['on-menu-counter', 'menu-counter'],
  ['on-settings-navigation-active', 'settings-navigation-active'],
]

const RETIRED_COLOUR_CLASS_PATTERNS = [
  /\b(bg|text|border|ring|outline|fill)-(forest|on-forest)\b(?!-)/,
  /\b(bg|ring|border|fill|outline)-ink\b(?![-/])/,
  /\btext-primary\b(?!-)/,
  /\btext-hairline\b/,
]

describe('atelier theme', () => {
  const lightThemeColours = resolveThemeColours('light')

  it('keeps every light colour at its current value', () => {
    expect(lightThemeColours).toMatchObject(LIGHT_THEME_COLOURS)
  })

  it('pins every dark colour from the spec', () => {
    expect(resolveThemeColours('dark')).toMatchObject(DARK_THEME_COLOURS)
  })

  describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
    const themeColours = theme === 'light' ? LIGHT_THEME_COLOURS : DARK_THEME_COLOURS

    it.each(ROLE_CONTRAST_PAIRS)('%s on %s reaches the minimum text contrast', (foreground, background) => {
      expect(themeColours[foreground]).toBeDefined()
      expect(themeColours[background]).toBeDefined()
      expect(getContrastRatio(themeColours[foreground], themeColours[background])).toBeGreaterThanOrEqual(
        MINIMUM_TEXT_CONTRAST,
      )
    })

    it('keeps focus indicators visible', () => {
      const focusPairs: Array<[string, string]> = [
        ['primary', 'card'],
        ['primary', 'sage'],
        ['on-deep-surface-soft', 'deep-surface'],
      ]
      focusPairs.forEach(([foreground, background]) => {
        expect(getContrastRatio(themeColours[foreground], themeColours[background])).toBeGreaterThanOrEqual(3)
      })
    })

    it('outlines highlighted popup options visibly', () => {
      const highlightOutlinePairs: Array<[string, string]> = [
        ['ring', 'popover'],
        ['ring', 'popover-highlight'],
        ['ring', 'forest-soft'],
      ]
      highlightOutlinePairs.forEach(([outline, background]) => {
        expect(getContrastRatio(themeColours[outline], themeColours[background])).toBeGreaterThanOrEqual(3)
      })
    })
  })

  it('separates the dark popover highlight from the popover', () => {
    expect(getContrastRatio(DARK_THEME_COLOURS['popover-highlight'], DARK_THEME_COLOURS.popover)).toBeGreaterThanOrEqual(
      MINIMUM_POPOVER_HIGHLIGHT_CONTRAST,
    )
  })

  it('highlights popup options with the popover highlight token and an outline', () => {
    const popupFiles = listTsxFiles(path.join(__dirname, '..')).filter(
      (filePath) => !/\.test\.tsx$/.test(filePath) && fs.readFileSync(filePath, 'utf8').includes('bg-popover'),
    )
    expect(popupFiles.length).toBeGreaterThan(0)
    popupFiles.forEach((filePath) => {
      const sourceCode = fs.readFileSync(filePath, 'utf8')
      expect(sourceCode).not.toMatch(/(aria-selected|data-highlighted|focus-visible|hover):bg-muted\b/)
      expect(sourceCode).toMatch(/(aria-selected|data-highlighted):bg-popover-highlight\b/)
      expect(sourceCode).toMatch(/(aria-selected|data-highlighted):outline-ring\b/)
    })
  })

  it('exposes every role token as a Tailwind colour', () => {
    const themeInlineBlock = /@theme inline\s*{([^}]*)}/.exec(GLOBALS_CSS)?.[1] ?? ''
    const roleTokens = [
      'sage',
      'card',
      'surface-soft',
      'ink',
      'ink-secondary',
      'ink-muted',
      'hairline',
      'hairline-strong',
      'control-border',
      'accent-text',
      'brand-tile',
      'on-brand-tile',
      'on-brand-tile-secondary',
      'deep-surface',
      'on-deep-surface',
      'on-deep-surface-secondary',
      'on-deep-surface-soft',
      'peach',
      'on-peach',
      'peach-tint',
      'peach-soft',
      'peach-ink',
      'lilac',
      'on-lilac',
      'lilac-tint',
      'lilac-soft',
      'on-lilac-soft',
      'lilac-panel',
      'forest-soft',
      'on-forest-soft',
      'clay',
      'clay-soft',
      'clay-tint',
      'popover-highlight',
      'menu-counter',
      'on-menu-counter',
      'settings-navigation-active',
      'on-settings-navigation-active',
    ]
    roleTokens.forEach((token) => {
      const colorVariablePattern = new RegExp(`--color-${token}:\\s*var\\(--${token}\\)`)
      expect(themeInlineBlock).toMatch(colorVariablePattern)
    })
  })

  it('no component uses a retired colour class', () => {
    const sourceFiles = listSourceFiles(path.join(__dirname, '..'), ['.ts', '.tsx', '.css']).filter(
      (filePath) => !/\.test\.(tsx?|css)$/.test(filePath) && !filePath.endsWith('globals.css'),
    )
    const filesWithRetiredClass = sourceFiles.filter((filePath) => {
      const sourceCode = fs.readFileSync(filePath, 'utf8')
      return RETIRED_COLOUR_CLASS_PATTERNS.some((pattern) => pattern.test(sourceCode))
    })
    expect(filesWithRetiredClass.map((filePath) => path.relative(__dirname, filePath))).toEqual([])
  })

  it('outlines focused controls of deep surfaces in a light token', () => {
    const darkSurfaceFocusUtility = /@utility focus-ring-on-dark\s*{([\s\S]*?)\n}/.exec(GLOBALS_CSS)?.[1] ?? ''
    expect(darkSurfaceFocusUtility).toMatch(/:focus-visible\s*{[^}]*outline:\s*2px solid var\(--on-deep-surface-soft\)/)
    expect(darkSurfaceFocusUtility).toMatch(/outline-offset:\s*2px/)
  })

  it('gives the deep surface Claude key card the light focus outline', () => {
    const preferencesPage = fs.readFileSync(path.join(__dirname, '(app)', 'preferences', 'page.tsx'), 'utf8')
    const apiKeySectionClassName = /aria-labelledby="settings-api-key-title" className="([^"]*)"/.exec(preferencesPage)?.[1]
    expect(apiKeySectionClassName?.split(' ')).toEqual(expect.arrayContaining(['bg-deep-surface', 'focus-ring-on-dark']))
  })

  it('sets every page title in the shared Manrope heading scale', () => {
    const pageFiles = listTsxFiles(__dirname).filter((filePath) => filePath.endsWith('page.tsx'))
    const pageFilesWithLightTitle = pageFiles.filter((filePath) =>
      /<h1 className="[^"]*font-(semibold|bold)\b/.test(fs.readFileSync(filePath, 'utf8')),
    )
    expect(pageFilesWithLightTitle.map((filePath) => path.relative(__dirname, filePath))).toEqual([])
  })

  it('ships one dark token block and no dark variant', () => {
    const darkBlockMatches = [...GLOBALS_CSS.matchAll(/:root\[data-theme='dark'\]/g)]
    expect(darkBlockMatches).toHaveLength(1)
    expect(GLOBALS_CSS).not.toContain('.dark')
    expect(GLOBALS_CSS).not.toContain('@custom-variant dark')
  })

  it('does not use dark variants in any component', () => {
    const filesWithDarkVariant = listTsxFiles(path.join(__dirname, '..')).filter((filePath) =>
      fs.readFileSync(filePath, 'utf8').includes('dark:'),
    )
    expect(filesWithDarkVariant.map((filePath) => path.relative(__dirname, filePath))).toEqual([])
  })

  it('keeps hex colours inside globals.css', () => {
    const sourceFiles = listSourceFiles(path.join(__dirname, '..'), ['.ts', '.tsx', '.css']).filter(
      (filePath) => !/\.test\.(tsx?|css)$/.test(filePath) && !filePath.endsWith('globals.css'),
    )
    const filesWithHex = sourceFiles.filter((filePath) => {
      const sourceCode = fs.readFileSync(filePath, 'utf8')
      return /#[0-9A-Fa-f]{3,8}\b/.test(sourceCode)
    })
    expect(filesWithHex.map((filePath) => path.relative(__dirname, filePath))).toEqual([])
  })
})
