'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Pill } from '@/components/pill'
import { ThemeMenu } from '@/components/theme-menu'
import { Button } from '@/components/ui/button'
import { CALENDAR_ROUTE, HOME_ROUTE, JOB_APPLICATIONS_ROUTE, OPPORTUNITIES_ROUTE, PREFERENCES_ROUTE } from '@/domain/routes'
import { cn } from '@/lib/utils'
import type { AppShellNavigationItem, AppShellProps } from './interfaces'

const isPathnameWithinRoute = (pathname: string, route: string): boolean =>
  pathname === route || pathname.startsWith(`${route}/`)

const NAVIGATION_ITEMS: AppShellNavigationItem[] = [
  {
    label: 'Mes candidatures',
    href: JOB_APPLICATIONS_ROUTE,
    isActiveForPathname: (pathname) => isPathnameWithinRoute(pathname, JOB_APPLICATIONS_ROUTE),
  },
  { label: 'Mon calendrier', href: CALENDAR_ROUTE, isActiveForPathname: (pathname) => isPathnameWithinRoute(pathname, CALENDAR_ROUTE) },
  {
    label: 'Mes opportunités',
    href: OPPORTUNITIES_ROUTE,
    isActiveForPathname: (pathname) => isPathnameWithinRoute(pathname, OPPORTUNITIES_ROUTE),
    showsOpportunitiesToProcessCount: true,
  },
  {
    label: 'Préférences',
    href: PREFERENCES_ROUTE,
    isActiveForPathname: (pathname) => isPathnameWithinRoute(pathname, PREFERENCES_ROUTE),
  },
]

export const AppShell = ({ userEmail, signOut, opportunitiesToProcessCount, children }: AppShellProps) => {
  const pathname = usePathname()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="px-4 pt-4">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 rounded-3xl bg-card px-4 py-2 sm:rounded-full sm:px-6">
          <Link
            href={HOME_ROUTE}
            className="block h-9 w-20 shrink-0 bg-(image:--brand-logo) bg-contain bg-left bg-no-repeat"
          >
            <span className="sr-only">Aled</span>
          </Link>
          <nav aria-label="Navigation principale" className="order-last w-full min-w-0 sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-1">
              {NAVIGATION_ITEMS.map((navigationItem) => {
                const isActive = navigationItem.isActiveForPathname(pathname)
                return (
                  <li key={navigationItem.href}>
                    <Link
                      href={navigationItem.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'inline-flex h-9 items-center rounded-full px-3 text-sm whitespace-nowrap font-medium text-ink-muted transition-colors hover:bg-muted hover:text-ink motion-reduce:transition-none',
                        isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                      )}
                    >
                      {navigationItem.label}
                      {navigationItem.showsOpportunitiesToProcessCount && opportunitiesToProcessCount > 0 && (
                        <>
                          <span aria-hidden="true" className="ml-1.5">
                            <Pill tone="counter">{opportunitiesToProcessCount}</Pill>
                          </span>
                          <span className="sr-only">, {opportunitiesToProcessCount} à traiter</span>
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-ink-muted md:inline">{userEmail}</span>
            <ThemeMenu />
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  )
}
