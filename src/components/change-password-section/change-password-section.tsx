import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { NEW_PASSWORD_ROUTE } from '@/domain/routes'

export const ChangePasswordSection = () => (
  <section aria-labelledby="settings-password-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6">
    <h2 id="settings-password-title" className="text-lg font-semibold">
      Mot de passe
    </h2>
    <Link href={NEW_PASSWORD_ROUTE} className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
      Changer mon mot de passe
    </Link>
  </section>
)
