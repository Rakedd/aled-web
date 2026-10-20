'use client'

import { Menu } from '@base-ui/react/menu'
import { Check, type LucideIcon, Moon, Monitor, Sun } from 'lucide-react'
import {
  browserThemePreferenceStore,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/lib/theme/theme-preference'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { ThemeMenuProps } from './interfaces'

const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const THEME_ICON_NAMES: Record<ThemePreference, string> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
}

export const ThemeMenu = ({ themePreferenceStore = browserThemePreferenceStore }: ThemeMenuProps) => {
  const { themePreference, selectThemePreference } = useController({ themePreferenceStore })
  const Icon = THEME_ICONS[themePreference]

  return (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="outline" size="icon" aria-label="Thème" className="cursor-pointer" />}>
        <Icon strokeWidth={1.75} aria-hidden data-icon={THEME_ICON_NAMES[themePreference]} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50">
          <Menu.Popup className="rounded-2xl border border-hairline bg-popover p-1.5" aria-label="Thème">
            <Menu.RadioGroup value={themePreference} onValueChange={selectThemePreference}>
              {THEME_PREFERENCES.map((preference) => {
                const PreferenceIcon = THEME_ICONS[preference]
                const isChecked = themePreference === preference
                return (
                  <Menu.RadioItem
                    key={preference}
                    value={preference}
                    closeOnClick
                    data-tone={isChecked ? 'forest-soft' : 'popover'}
                    className={cn(
                      'h-11 flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer outline-none data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring data-highlighted:outline-solid',
                      isChecked ? 'bg-forest-soft text-on-forest-soft' : 'data-highlighted:bg-popover-highlight',
                    )}
                  >
                    <PreferenceIcon strokeWidth={1.75} aria-hidden />
                    <span className="flex-1 text-sm font-medium">{THEME_PREFERENCE_LABELS[preference]}</span>
                    <Menu.RadioItemIndicator render={<Check strokeWidth={1.75} aria-hidden />} />
                  </Menu.RadioItem>
                )
              })}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
