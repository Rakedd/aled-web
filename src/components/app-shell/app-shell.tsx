'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={HOME_ROUTE} className="text-lg font-semibold">
            Freeclutch
          </Link>
          <nav aria-label="Navigation principale" className="order-last w-full sm:order-none sm:w-auto">
            <ul className="flex gap-1">
              {NAVIGATION_ITEMS.map((navigationItem) => {
                const isActive = navigationItem.isActiveForPathname(pathname)
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
                      {navigationItem.showsOpportunitiesToProcessCount && opportunitiesToProcessCount > 0 && (
                        <>
                          <span
                            aria-hidden="true"
                            className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
                          >
                            {opportunitiesToProcessCount}
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
            <span className="hidden truncate text-sm text-muted-foreground md:inline">{userEmail}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  )
}
