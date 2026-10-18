import type { ReactNode } from 'react'

export type AppShellProps = {
  userEmail: string
  signOut: () => Promise<void>
  opportunitiesToProcessCount: number
  children: ReactNode
}

export type AppShellNavigationItem = {
  label: string
  href: string
  isActiveForPathname: (pathname: string) => boolean
  showsOpportunitiesToProcessCount?: boolean
}
