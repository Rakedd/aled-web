import { THEME_INIT_SCRIPT } from './theme-init-script'

type ColorSchemeChangeListener = (event: { matches: boolean }) => void

const setUpDevice = (prefersDarkColorScheme: boolean) => {
  const colorSchemeChangeListeners: ColorSchemeChangeListener[] = []
  const darkColorSchemeQuery = {
    matches: prefersDarkColorScheme,
    addEventListener: (_eventName: string, listener: ColorSchemeChangeListener) => {
      colorSchemeChangeListeners.push(listener)
    },
  }
  window.matchMedia = jest.fn().mockReturnValue(darkColorSchemeQuery)
  jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (propertyName: string) => (propertyName === '--background' ? 'canvas' : ''),
  } as CSSStyleDeclaration)

  const changeDeviceColorScheme = (prefersDark: boolean) => {
    darkColorSchemeQuery.matches = prefersDark
    colorSchemeChangeListeners.forEach((listener) => listener({ matches: prefersDark }))
  }

  return { changeDeviceColorScheme }
}

const runThemeInitScript = () => new Function(THEME_INIT_SCRIPT)()

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.head.querySelector('meta[name="theme-color"]')?.remove()
})

describe('THEME_INIT_SCRIPT', () => {
  it('applies the dark theme on a dark device when nothing is stored', () => {
    setUpDevice(true)

    runThemeInitScript()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to the device theme without throwing when storage is unavailable', () => {
    setUpDevice(true)
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(runThemeInitScript).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('keeps a stored light choice on a dark device', () => {
    setUpDevice(true)
    localStorage.setItem('aled-theme', 'light')

    runThemeInitScript()

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('treats an invalid stored value as system', () => {
    setUpDevice(true)
    localStorage.setItem('aled-theme', 'sepia')

    runThemeInitScript()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('follows the device live in system mode', () => {
    const { changeDeviceColorScheme } = setUpDevice(true)
    runThemeInitScript()

    changeDeviceColorScheme(false)

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('ignores device changes when a theme is chosen explicitly', () => {
    const { changeDeviceColorScheme } = setUpDevice(true)
    localStorage.setItem('aled-theme', 'dark')
    runThemeInitScript()

    changeDeviceColorScheme(false)

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('sets the theme-color meta to the computed page background', () => {
    setUpDevice(false)

    runThemeInitScript()

    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', 'canvas')
  })

  it('contains no hex colour and no closing script tag', () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(THEME_INIT_SCRIPT).not.toContain('</script>')
  })

  it('retries setting the theme-color meta on DOMContentLoaded when --background is empty', () => {
    setUpDevice(false)
    const getPropertyValueSpy = jest.fn()
    getPropertyValueSpy.mockReturnValueOnce('')
    getPropertyValueSpy.mockReturnValueOnce(' canvas ')
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: getPropertyValueSpy,
    } as unknown as CSSStyleDeclaration)

    runThemeInitScript()
    expect(document.head.querySelector('meta[name="theme-color"]')).toBeNull()

    document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', 'canvas')
  })

  it('applies a stored dark choice even when matchMedia is unavailable', () => {
    localStorage.setItem('aled-theme', 'dark')
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    runThemeInitScript()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('defaults to light in system mode when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia

    runThemeInitScript()

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
