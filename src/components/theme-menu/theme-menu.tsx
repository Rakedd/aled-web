'use client'

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Check, Moon, Monitor, Sun } from 'lucide-react'
import { browserThemePreferenceStore, THEME_PREFERENCE_LABELS } from '@/lib/theme/theme-preference'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { ThemeMenuProps } from './interfaces'

const THEME_ICONS: Record<string, typeof Sun> = {}
THEME_ICONS.light = Sun
THEME_ICONS.dark = Moon
THEME_ICONS.system = Monitor

export const ThemeMenu = ({ themePreferenceStore = browserThemePreferenceStore }: ThemeMenuProps) => {
  const { themePreference, selectThemePreference } = useController({ themePreferenceStore })
  const [open, setOpen] = useState(false)
  const Icon = THEME_ICONS[themePreference]

  const handleValueChange = (value: string) => {
    selectThemePreference(value)
    setOpen(false)
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger render={<Button variant="outline" size="icon" aria-label="Thème" />}>
        <Icon strokeWidth={1.75} aria-hidden data-icon={themePreference === 'light' ? 'sun' : themePreference === 'dark' ? 'moon' : 'monitor'} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className="rounded-2xl border border-hairline bg-popover p-1.5" aria-label="Thème">
            <Menu.RadioGroup value={themePreference} onValueChange={handleValueChange}>
              {(['light', 'dark', 'system'] as const).map((preference) => {
                const PreferenceIcon = THEME_ICONS[preference]
                const isChecked = themePreference === preference
                return (
                  <Menu.RadioItem
                    key={preference}
                    value={preference}
                    className={cn(
                      'h-11 flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer outline-none focus-visible:bg-muted',
                      isChecked && 'bg-forest-soft text-on-forest-soft',
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
