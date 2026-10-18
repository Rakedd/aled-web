'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FREE_WORK_PREFERENCES_ROUTE, PREFERENCES_ROUTE } from '@/domain/routes'
import { cn } from '@/lib/utils'
import type { SettingsNavigationItem } from './interfaces'

const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = [
  { label: 'Profil', href: PREFERENCES_ROUTE },
  {
    label: 'Opportunités · Free-Work',
    href: FREE_WORK_PREFERENCES_ROUTE,
  },
]

export const SettingsNavigation = () => {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigation des préférences">
      <ul className="flex flex-wrap gap-1">
        {SETTINGS_NAVIGATION_ITEMS.map((navigationItem) => {
          const isActive = pathname === navigationItem.href
          return (
            <li key={navigationItem.href}>
              <Link
                href={navigationItem.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-muted text-foreground',
                )}
              >
                {navigationItem.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
