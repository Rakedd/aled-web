import type { ReactNode } from 'react'

export type AppShellProps = {
  userEmail: string
  signOut: () => Promise<void>
  children: ReactNode
}

export type AppShellNavigationItem = {
  label: string
  href: string
  isActiveForPathname: (pathname: string) => boolean
}
