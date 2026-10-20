import {
  browserThemePreferenceStore,
  parseThemePreference,
  resolveTheme,
  THEME_PREFERENCE_LABELS,
} from './theme-preference'

const stubDeviceColorScheme = (prefersDarkColorScheme: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: prefersDarkColorScheme })
}

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.head.querySelector('meta[name="theme-color"]')?.remove()
})

describe('parseThemePreference', () => {
  it('keeps a known preference', () => {
    expect(parseThemePreference('dark')).toBe('dark')
  })

  it('falls back to system when nothing is stored', () => {
    expect(parseThemePreference(null)).toBe('system')
  })

  it('falls back to system for an unknown value', () => {
    expect(parseThemePreference('sepia')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows a dark device in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('follows a light device in system mode', () => {
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('keeps an explicit choice whatever the device prefers', () => {
    expect(resolveTheme('light', true)).toBe('light')
  })
})

describe('THEME_PREFERENCE_LABELS', () => {
  it('names every preference in French', () => {
    expect(THEME_PREFERENCE_LABELS).toEqual({ light: 'Clair', dark: 'Sombre', system: 'Système' })
  })
})

describe('browserThemePreferenceStore', () => {
  it('saves, applies and notifies a dark choice', () => {
    stubDeviceColorScheme(false)
    const listener = jest.fn()
    const unsubscribe = browserThemePreferenceStore.subscribe(listener)

    browserThemePreferenceStore.save('dark')
    unsubscribe()

    expect(localStorage.getItem('aled-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', () => {
    stubDeviceColorScheme(false)
    const listener = jest.fn()
    browserThemePreferenceStore.subscribe(listener)()

    browserThemePreferenceStore.save('light')

    expect(listener).not.toHaveBeenCalled()
  })

  it('applies the device theme when saving system', () => {
    stubDeviceColorScheme(true)

    browserThemePreferenceStore.save('system')

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('updates the theme-color meta with the computed page background', () => {
    stubDeviceColorScheme(false)
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (propertyName: string) => (propertyName === '--background' ? ' canvas ' : ''),
    } as CSSStyleDeclaration)

    browserThemePreferenceStore.save('dark')

    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', 'canvas')
  })

  it('reads the stored preference', () => {
    localStorage.setItem('aled-theme', 'light')

    expect(browserThemePreferenceStore.read()).toBe('light')
  })

  it('reads system when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(browserThemePreferenceStore.read()).toBe('system')
  })

  it('still applies the theme and warns when storage refuses to save', () => {
    stubDeviceColorScheme(false)
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    browserThemePreferenceStore.save('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
  })

  it('reads the last chosen preference when storage is blocked', () => {
    stubDeviceColorScheme(false)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    browserThemePreferenceStore.save('light')

    expect(browserThemePreferenceStore.read()).toBe('light')
  })

  it('applies a stored dark choice even when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    browserThemePreferenceStore.save('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('defaults to light in system mode when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    browserThemePreferenceStore.save('system')

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
