import type { Metadata } from 'next'
import Image from 'next/image'
import { NewPasswordForm } from '@/components/new-password-form'
import { updatePassword } from '@/server/actions/auth-actions'

export const metadata: Metadata = { title: 'Nouveau mot de passe · Aled' }

const NewPasswordPage = () => (
  <main className="flex flex-1 flex-col lg:flex-row">
    <section className="flex flex-col justify-center gap-4 bg-brand-tile px-6 py-10 text-on-brand-tile-secondary lg:w-1/2 lg:px-16 lg:py-20">
      <Image src="/brand/aled-logo-on-dark.png" alt="Aled" width={107} height={48} />
      <h1 className="font-heading text-3xl font-extrabold text-on-brand-tile lg:text-5xl">
        Trouver du travail sans traverser la rue.
      </h1>
      <p className="max-w-md text-base">
        Candidatures, entretiens, briefs et nouvelles missions Free-Work et Collective, sans rien oublier.
      </p>
    </section>
    <section className="flex flex-1 items-center justify-center px-4 py-10 lg:w-1/2">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-card p-6">
        <h2 className="font-heading text-2xl font-bold text-ink">Nouveau mot de passe</h2>
        <NewPasswordForm updatePassword={updatePassword} />
      </div>
    </section>
  </main>
)

export default NewPasswordPage
