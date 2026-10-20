import type { ThemePreference, ThemePreferenceStore } from '@/lib/theme/theme-preference'

export type ThemeMenuProps = {
  themePreferenceStore?: ThemePreferenceStore
}

export type ThemeMenuController = {
  themePreference: ThemePreference
  selectThemePreference: (value: string) => void
}
