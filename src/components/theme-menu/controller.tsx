import { useSyncExternalStore } from 'react'
import { parseThemePreference, type ThemePreference, type ThemePreferenceStore } from '@/lib/theme/theme-preference'
import type { ThemeMenuController } from './interfaces'

export const useController = (dependencies: { themePreferenceStore: ThemePreferenceStore }): ThemeMenuController => {
  const { themePreferenceStore } = dependencies

  const themePreference = useSyncExternalStore<ThemePreference>(
    themePreferenceStore.subscribe,
    themePreferenceStore.read,
    () => 'system',
  )

  const selectThemePreference = (value: string) => {
    const parsedPreference = parseThemePreference(value)
    themePreferenceStore.save(parsedPreference)
  }

  return {
    themePreference,
    selectThemePreference,
  }
}
