import type { Metadata } from 'next'
import { AnthropicApiKeyForm } from '@/components/anthropic-api-key-form'
import { ProfileForm } from '@/components/profile-form'
import { SettingsNavigation } from '@/components/settings-navigation'
import { buttonVariants } from '@/components/ui/button'
import {
  deleteAnthropicApiKey,
  getProfileSettings,
  saveAnthropicApiKey,
  updateProfileSettings,
} from '@/server/actions/settings-actions'

export const metadata: Metadata = { title: 'Préférences · Aled' }

const SettingsPage = async () => {
  const profileSettingsResult = await getProfileSettings()

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Préférences</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-60 lg:shrink-0">
          <SettingsNavigation />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
        {!profileSettingsResult.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {profileSettingsResult.errorMessage}
          </p>
        ) : (
          <>
            <section aria-labelledby="settings-profile-title" className="flex flex-col gap-4 rounded-2xl bg-card p-6">
              <h2 id="settings-profile-title" className="text-lg font-semibold">
                Profil
              </h2>
              <ProfileForm
                initialProfileSettings={profileSettingsResult.data}
                updateProfileSettings={updateProfileSettings}
              />
            </section>
            <section aria-labelledby="settings-api-key-title" className="flex flex-col gap-4 rounded-2xl bg-ink p-6 text-primary-foreground focus-ring-on-dark">
              <div className="flex flex-col gap-1">
                <h2 id="settings-api-key-title" className="text-lg font-semibold">
                  Clé API Claude
                </h2>
                <p className="text-sm text-hairline">
                  Ta clé active le pré-remplissage des candidatures et le brief client. Elle est vérifiée auprès de
                  Claude, stockée chiffrée et n&apos;est jamais réaffichée. Sans clé, tout reste utilisable en saisie
                  manuelle.
                </p>
              </div>
              <AnthropicApiKeyForm
                initialApiKeyLastFour={profileSettingsResult.data.anthropicApiKeyLastFour}
                saveAnthropicApiKey={saveAnthropicApiKey}
                deleteAnthropicApiKey={deleteAnthropicApiKey}
              />
              <p className="rounded-2xl bg-primary-foreground/10 p-3 text-sm text-hairline">
                Conseil : fixe un plafond de dépenses mensuel dans la console Anthropic.
              </p>
            </section>
            <section aria-labelledby="settings-data-title" className="flex flex-col gap-4 rounded-2xl bg-lilac p-6 text-ink">
              <div className="flex flex-col gap-1">
                <h2 id="settings-data-title" className="text-lg font-semibold">
                  Mes données
                </h2>
                <p className="text-sm text-ink-secondary">
                  Télécharge une copie complète de tes données. Ta clé API n&apos;y figure jamais.
                </p>
              </div>
              <a href="/api/export" download className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
                Exporter mes données
              </a>
            </section>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
