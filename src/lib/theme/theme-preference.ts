export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_STORAGE_KEY = 'aled-theme'

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export const THEME_COLOR_META_NAME = 'theme-color'

export const PAGE_BACKGROUND_CUSTOM_PROPERTY = '--background'

export const THEME_ATTRIBUTE = 'data-theme'

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  light: 'Clair',
  dark: 'Sombre',
  system: 'Système',
}

const isThemePreference = (value: string | null): value is ThemePreference =>
  THEME_PREFERENCES.some((themePreference) => themePreference === value)

export const parseThemePreference = (storedValue: string | null): ThemePreference =>
  isThemePreference(storedValue) ? storedValue : DEFAULT_THEME_PREFERENCE

export const resolveTheme = (preference: ThemePreference, prefersDarkColorScheme: boolean): ResolvedTheme => {
  if (preference !== 'system') return preference
  return prefersDarkColorScheme ? 'dark' : 'light'
}

const findOrCreateThemeColorMeta = (): HTMLMetaElement => {
  const existingThemeColorMeta = document.head.querySelector<HTMLMetaElement>(`meta[name="${THEME_COLOR_META_NAME}"]`)
  if (existingThemeColorMeta) return existingThemeColorMeta
  const createdThemeColorMeta = document.createElement('meta')
  createdThemeColorMeta.name = THEME_COLOR_META_NAME
  document.head.appendChild(createdThemeColorMeta)
  return createdThemeColorMeta
}

export const applyResolvedTheme = (resolvedTheme: ResolvedTheme) => {
  const rootElement = document.documentElement
  rootElement.setAttribute(THEME_ATTRIBUTE, resolvedTheme)
  const pageBackgroundColor = window
    .getComputedStyle(rootElement)
    .getPropertyValue(PAGE_BACKGROUND_CUSTOM_PROPERTY)
    .trim()
  if (pageBackgroundColor) findOrCreateThemeColorMeta().content = pageBackgroundColor
}

const prefersReducedMotion = () => (window.matchMedia ? window.matchMedia(REDUCED_MOTION_QUERY).matches : false)

const shouldAnimateThemeChange = (resolvedTheme: ResolvedTheme) =>
  typeof document.startViewTransition === 'function' &&
  document.documentElement.getAttribute(THEME_ATTRIBUTE) !== resolvedTheme &&
  !prefersReducedMotion()

const applyResolvedThemeWithTransition = (resolvedTheme: ResolvedTheme) => {
  if (!shouldAnimateThemeChange(resolvedTheme)) {
    applyResolvedTheme(resolvedTheme)
    return
  }
  document.startViewTransition(() => applyResolvedTheme(resolvedTheme))
}

export type ThemePreferenceStore = {
  read: () => ThemePreference
  save: (preference: ThemePreference) => void
  subscribe: (listener: () => void) => () => void
}

const themePreferenceListeners = new Set<() => void>()

let unstoredThemePreference: ThemePreference | null = null

const readStoredThemePreference = (): ThemePreference => {
  if (unstoredThemePreference !== null) return unstoredThemePreference
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

const writeStoredThemePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    unstoredThemePreference = null
  } catch (storageError) {
    unstoredThemePreference = preference
    console.warn('Unable to remember the theme preference', storageError)
  }
}

const handleStorageEvent = (event: StorageEvent) => {
  if (event.key !== THEME_STORAGE_KEY) return
  unstoredThemePreference = null
  const newPreference = parseThemePreference(event.newValue)
  const prefersDarkColorScheme = window.matchMedia ? window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches : false
  applyResolvedTheme(resolveTheme(newPreference, prefersDarkColorScheme))
  themePreferenceListeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', handleStorageEvent)
}

export const browserThemePreferenceStore: ThemePreferenceStore = {
  read: readStoredThemePreference,
  save: (preference) => {
    writeStoredThemePreference(preference)
    const prefersDarkColorScheme = window.matchMedia ? window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches : false
    applyResolvedThemeWithTransition(resolveTheme(preference, prefersDarkColorScheme))
    themePreferenceListeners.forEach((listener) => listener())
  },
  subscribe: (listener) => {
    themePreferenceListeners.add(listener)
    return () => {
      themePreferenceListeners.delete(listener)
    }
  },
}
