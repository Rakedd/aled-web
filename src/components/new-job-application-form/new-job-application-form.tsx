'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent, ReactNode } from 'react'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_PASTED_TEXT_LENGTH } from '@/domain/job-posting-extraction'
import { JOB_APPLICATION_STATUS_LABELS, type JobApplicationStatus } from '@/domain/job-application-status'
import { useController } from './controller'
import type { NewJobApplicationFormProps, TextFormValueName } from './interfaces'

const SOURCE_SUGGESTIONS = ['Free-Work', 'Collective', 'LeHibou', 'Malt', 'LinkedIn', 'Bouche-à-oreille', 'Autre']
const SOURCE_SUGGESTIONS_LIST_ID = 'new-job-application-source-suggestions'
const ALL_STATUSES = Object.keys(JOB_APPLICATION_STATUS_LABELS) as JobApplicationStatus[]
const CONTROL_CLASS_NAME =
  'rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const isJobApplicationStatus = (candidate: string): candidate is JobApplicationStatus =>
  ALL_STATUSES.some((status) => status === candidate)

const FormField = ({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
)

export const NewJobApplicationForm = ({
  extractJobPosting,
  createJobApplication,
  searchEntities,
}: NewJobApplicationFormProps) => {
  const router = useRouter()
  const {
    step,
    pastedText,
    setPastedText,
    formValues,
    errorMessage,
    isExtracting,
    isSubmitting,
    extract,
    switchToManualEntry,
    setTextFormValue,
    setStatus,
    setStack,
    submit,
  } = useController({ extractJobPosting, createJobApplication, navigateTo: router.push })

  const errorAlert = errorMessage && (
    <p role="alert" className="text-sm text-destructive">
      {errorMessage}
    </p>
  )

  const renderTextInput = (
    valueName: TextFormValueName,
    label: string,
    inputProps: ComponentProps<typeof Input> = {},
  ) => (
    <FormField htmlFor={`new-job-application-${valueName}`} label={label}>
      <Input
        id={`new-job-application-${valueName}`}
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
    <FormField htmlFor={`new-job-application-${valueName}`} label={label}>
      <EntityAutocomplete
        id={`new-job-application-${valueName}`}
        entityKind={entityKind}
        value={formValues[valueName]}
        onChange={(value) => setTextFormValue(valueName, value)}
        searchEntities={searchEntities}
      />
    </FormField>
  )

  if (step === 'paste') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-job-application-pasted-text">Texte de l&apos;annonce</Label>
          <textarea
            id="new-job-application-pasted-text"
            rows={12}
            maxLength={MAX_PASTED_TEXT_LENGTH + 1}
            className={`${CONTROL_CLASS_NAME} min-h-48 w-full resize-y`}
            placeholder="Colle ici l'annonce ou le message reçu"
            value={pastedText}
            onChange={(changeEvent) => setPastedText(changeEvent.target.value)}
            disabled={isExtracting}
          />
        </div>
        {errorAlert}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void extract()} disabled={isExtracting}>
            {isExtracting ? 'Analyse en cours…' : 'Pré-remplir'}
          </Button>
          <Button type="button" variant="outline" onClick={switchToManualEntry} disabled={isExtracting}>
            Saisie manuelle
          </Button>
        </div>
        {isExtracting && (
          <p role="status" className="text-sm text-muted-foreground">
            Claude lit l&apos;annonce, cela peut prendre jusqu&apos;à deux minutes.
          </p>
        )}
      </div>
    )
  }

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      {errorAlert}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{renderTextInput('title', 'Titre de la mission *', { required: true })}</div>
        {renderTextInput('source', 'Source', { list: SOURCE_SUGGESTIONS_LIST_ID })}
        <datalist id={SOURCE_SUGGESTIONS_LIST_ID}>
          {SOURCE_SUGGESTIONS.map((sourceSuggestion) => (
            <option key={sourceSuggestion} value={sourceSuggestion} />
          ))}
        </datalist>
        {renderTextInput('postingUrl', "Lien de l'annonce", { type: 'url', inputMode: 'url', placeholder: 'https://' })}
        {renderEntityField('intermediaryName', 'intermediary', 'Intermédiaire')}
        {renderEntityField('contactName', 'contact', 'Contact')}
        {renderTextInput('contactEmail', 'E-mail du contact', { type: 'email', inputMode: 'email' })}
        {renderTextInput('contactPhone', 'Téléphone du contact', { type: 'tel', inputMode: 'tel' })}
        {renderEntityField('endClientName', 'end_client', 'Client final')}
        {renderTextInput('endClientParentName', 'Groupe du client final')}
        {renderTextInput('postedDailyRate', 'TJM annoncé (€)', { type: 'number', inputMode: 'numeric', min: 0 })}
        {renderTextInput('location', 'Lieu')}
        {renderTextInput('remotePolicy', 'Télétravail')}
        {renderTextInput('desiredStart', 'Démarrage')}
        {renderTextInput('duration', 'Durée')}
        {renderTextInput('appliedOn', 'Date de candidature', { type: 'date' })}
        <FormField htmlFor="new-job-application-status" label="Statut">
          <select
            id="new-job-application-status"
            className={`${CONTROL_CLASS_NAME} h-8 py-0`}
            value={formValues.status}
            onChange={(changeEvent) => {
              if (isJobApplicationStatus(changeEvent.target.value)) setStatus(changeEvent.target.value)
            }}
          >
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_APPLICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Technologies</legend>
        <StackChipsEditor stack={formValues.stack} onChange={setStack} />
      </fieldset>
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer la candidature'}
      </Button>
    </form>
  )
}
