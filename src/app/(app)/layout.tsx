import { AppShell } from '@/components/app-shell'
import { signOut } from '@/server/actions/auth-actions'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'

const AuthenticatedAppLayout = async ({ children }: LayoutProps<'/'>) => {
  const authenticatedUser = await getAuthenticatedUser()

  return (
    <AppShell userEmail={authenticatedUser.email} signOut={signOut}>
      {children}
    </AppShell>
  )
}

export default AuthenticatedAppLayout
