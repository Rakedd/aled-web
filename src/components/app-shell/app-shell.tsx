'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppShellNavigationItem, AppShellProps } from './interfaces'

const NAVIGATION_ITEMS: AppShellNavigationItem[] = [
  {
    label: 'Candidatures',
    href: '/',
    isActiveForPathname: (pathname) => pathname === '/' || pathname.startsWith('/candidatures'),
  },
  { label: 'Calendrier', href: '/calendar', isActiveForPathname: (pathname) => pathname.startsWith('/calendar') },
  { label: 'Réglages', href: '/settings', isActiveForPathname: (pathname) => pathname.startsWith('/settings') },
]

export const AppShell = ({ userEmail, signOut, children }: AppShellProps) => {
  const pathname = usePathname()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-semibold">
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
