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

export const metadata: Metadata = { title: 'Préférences · Freeclutch' }

const SettingsPage = async () => {
  const profileSettingsResult = await getProfileSettings()

  return (
    <div className="flex w-full max-w-2xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Préférences</h1>
      <SettingsNavigation />
      {!profileSettingsResult.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {profileSettingsResult.errorMessage}
        </p>
      ) : (
        <>
          <section aria-labelledby="settings-profile-title" className="flex flex-col gap-4">
            <h2 id="settings-profile-title" className="text-lg font-semibold">
              Profil
            </h2>
            <ProfileForm
              initialProfileSettings={profileSettingsResult.data}
              updateProfileSettings={updateProfileSettings}
            />
          </section>
          <section aria-labelledby="settings-api-key-title" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="settings-api-key-title" className="text-lg font-semibold">
                Clé API Claude
              </h2>
              <p className="text-sm text-muted-foreground">
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
            <p className="rounded-lg bg-muted p-3 text-sm">
              Conseil : fixe un plafond de dépenses mensuel dans la console Anthropic.
            </p>
          </section>
          <section aria-labelledby="settings-data-title" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="settings-data-title" className="text-lg font-semibold">
                Mes données
              </h2>
              <p className="text-sm text-muted-foreground">
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
  )
}

export default SettingsPage
