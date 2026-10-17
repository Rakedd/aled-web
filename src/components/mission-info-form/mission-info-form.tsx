'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent, ReactNode } from 'react'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useController } from './controller'
import type { ContactFormValueName, MissionInfoFormProps, MissionInfoTextValueName } from './interfaces'

const FormField = ({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
)

export const MissionInfoForm = ({
  jobApplication,
  updateJobApplication,
  setEndClientParent,
  getContactDetails,
  updateContactDetails,
  searchEntities,
}: MissionInfoFormProps) => {
  const router = useRouter()
  const {
    formValues,
    setTextFormValue,
    setStack,
    hasChanges,
    isEndClientParentDisabled,
    isSaving,
    errorMessage,
    save,
    isContactLoaded,
    contactFormValues,
    setContactFormValue,
    isSavingContact,
    contactErrorMessage,
    saveContact,
  } = useController({
    jobApplication,
    updateJobApplication,
    setEndClientParent,
    getContactDetails,
    updateContactDetails,
    onDataChanged: router.refresh,
  })

  const renderTextInput = (
    valueName: MissionInfoTextValueName,
    label: string,
    inputProps: ComponentProps<typeof Input> = {},
  ) => (
    <FormField htmlFor={`mission-info-${valueName}`} label={label}>
      <Input
        id={`mission-info-${valueName}`}
        value={formValues[valueName]}
        onChange={(changeEvent) => setTextFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const renderEntityField = (
    valueName: 'intermediaryName' | 'contactName' | 'endClientName',
    entityKind: 'intermediary' | 'contact' | 'end_client',
    label: string,
  ) => (
    <FormField htmlFor={`mission-info-${valueName}`} label={label}>
      <EntityAutocomplete
        id={`mission-info-${valueName}`}
        entityKind={entityKind}
        value={formValues[valueName]}
        onChange={(value) => setTextFormValue(valueName, value)}
        onSelectSuggestion={
          entityKind === 'end_client'
            ? (suggestion) => setTextFormValue('endClientParentName', suggestion.parentName ?? '')
            : undefined
        }
        searchEntities={searchEntities}
      />
    </FormField>
  )

  const renderContactInput = (
    valueName: ContactFormValueName,
    label: string,
    inputProps: ComponentProps<typeof Input>,
  ) => (
    <FormField htmlFor={`mission-info-contact-${valueName}`} label={label}>
      <Input
        id={`mission-info-contact-${valueName}`}
        value={contactFormValues?.[valueName] ?? ''}
        onChange={(changeEvent) => setContactFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void save()
  }

  const handleContactSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void saveContact()
  }

  return (
    <section aria-labelledby="mission-info-title" className="flex min-w-0 flex-col gap-6">
      <h2 id="mission-info-title" className="text-lg font-semibold">
        Infos mission
      </h2>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {renderTextInput('title', 'Titre de la mission *', {
              required: true,
            })}
          </div>
          {renderTextInput('source', 'Source')}
          {renderTextInput('postingUrl', "Lien de l'annonce", {
            type: 'url',
            inputMode: 'url',
            placeholder: 'https://',
          })}
          {renderEntityField('intermediaryName', 'intermediary', 'Intermédiaire')}
          {renderEntityField('contactName', 'contact', 'Contact')}
          {renderEntityField('endClientName', 'end_client', 'Client final')}
          {renderTextInput('endClientParentName', 'Groupe du client final', {
            disabled: isEndClientParentDisabled,
          })}
          {renderTextInput('postedDailyRate', 'TJM annoncé (€)', {
            inputMode: 'numeric',
          })}
          {renderTextInput('requestedDailyRate', 'TJM demandé (€)', {
            inputMode: 'numeric',
          })}
          {renderTextInput('location', 'Lieu')}
          {renderTextInput('remotePolicy', 'Télétravail')}
          {renderTextInput('desiredStart', 'Démarrage souhaité')}
          {renderTextInput('duration', 'Durée')}
          {renderTextInput('appliedOn', 'Date de candidature', {
            type: 'date',
          })}
          {renderTextInput('actualStartDate', 'Date de démarrage réelle', {
            type: 'date',
          })}
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Technologies</legend>
          <StackChipsEditor stack={formValues.stack} onChange={setStack} origin="posting" />
        </fieldset>
        <FormField htmlFor="mission-info-notes" label="Notes">
          <textarea
            id="mission-info-notes"
            rows={4}
            className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            value={formValues.notes}
            onChange={(changeEvent) => setTextFormValue('notes', changeEvent.target.value)}
          />
        </FormField>
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <div>
          <Button type="submit" disabled={isSaving || !hasChanges}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
      {jobApplication.contactId !== null && (
        <form noValidate onSubmit={handleContactSubmit} className="flex flex-col gap-4 border-t border-border pt-4">
          <h3 className="text-base font-semibold">Coordonnées de {jobApplication.contactName ?? 'ce contact'}</h3>
          {isContactLoaded && (
            <div className="grid gap-4 sm:grid-cols-3">
              {renderContactInput('phone', 'Téléphone', {
                type: 'tel',
                inputMode: 'tel',
              })}
              {renderContactInput('email', 'E-mail', {
                type: 'email',
                inputMode: 'email',
              })}
              {renderContactInput('linkedinUrl', 'LinkedIn', {
                type: 'url',
                inputMode: 'url',
                placeholder: 'https://',
              })}
            </div>
          )}
          {contactErrorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {contactErrorMessage}
            </p>
          )}
          {isContactLoaded && (
            <div>
              <Button type="submit" variant="outline" disabled={isSavingContact}>
                {isSavingContact ? 'Enregistrement…' : 'Enregistrer le contact'}
              </Button>
            </div>
          )}
        </form>
      )}
      {jobApplication.postingRawText !== null && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Texte original de l&apos;annonce</summary>
          <p className="mt-3 text-sm break-words whitespace-pre-wrap">{jobApplication.postingRawText}</p>
        </details>
      )}
    </section>
  )
}
