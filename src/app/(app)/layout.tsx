import { AppShell } from '@/components/app-shell'
import { signOut } from '@/server/actions/auth-actions'
import { countOpportunitiesToProcess } from '@/server/actions/opportunity-actions'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

const AuthenticatedAppLayout = async ({ children }: LayoutProps<'/'>) => {
  const [authenticatedUser, opportunitiesToProcessCountResult] = await Promise.all([
    getAuthenticatedUser(),
    countOpportunitiesToProcess(),
  ])

  return (
    <AppShell
      userEmail={authenticatedUser.email}
      signOut={signOut}
      opportunitiesToProcessCount={opportunitiesToProcessCountResult.ok ? opportunitiesToProcessCountResult.data : 0}
    >
      {children}
    </AppShell>
  )
}

export default AuthenticatedAppLayout
