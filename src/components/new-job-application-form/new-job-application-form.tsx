'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent } from 'react'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Pill } from '@/components/pill'
import { PillToggle } from '@/components/pill-toggle'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_PASTED_TEXT_LENGTH } from '@/domain/job-posting-extraction'
import {
  ALL_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_LABELS,
  isJobApplicationStatus,
} from '@/domain/job-application-status'
import { NATIVE_SELECT_CLASS_NAME, TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { NewJobApplicationFormProps, TextFormValueName } from './interfaces'

const SOURCE_SUGGESTIONS = ['Free-Work', 'Collective', 'LeHibou', 'Malt', 'LinkedIn', 'Bouche-à-oreille', 'Autre']

export const NewJobApplicationForm = ({
  extractJobPosting,
  createJobApplication,
  searchEntities,
  hasAnthropicApiKey,
}: NewJobApplicationFormProps) => {
  const router = useRouter()
  const {
    step,
    pastedText,
    setPastedText,
    formValues,
    errorMessage,
    isExtracting,
    hasExtractionFailed,
    isPrefilledByClaude,
    isSubmitting,
    extract,
    switchToManualEntry,
    setTextFormValue,
    setStatus,
    setStack,
    submit,
  } = useController({
    extractJobPosting,
    createJobApplication,
    navigateTo: router.push,
    hasAnthropicApiKey,
  })

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
        onSelectSuggestion={
          entityKind === 'end_client'
            ? (suggestion) => setTextFormValue('endClientParentName', suggestion.parentName ?? '')
            : undefined
        }
        searchEntities={searchEntities}
      />
    </FormField>
  )

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  const retryExtractionButton = hasExtractionFailed && (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      onClick={() => void extract()}
      disabled={isExtracting || isSubmitting}
    >
      {isExtracting ? 'Analyse en cours…' : 'Réessayer le pré-remplissage'}
    </Button>
  )

  const pasteColumn =
    step === 'paste' ? (
      <>
        {!hasAnthropicApiKey && <MissingAnthropicApiKeyNotice featureDescription="le pré-remplissage de l'annonce" />}
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-job-application-pasted-text">Texte de l&apos;annonce</Label>
          <textarea
            id="new-job-application-pasted-text"
            rows={12}
            maxLength={MAX_PASTED_TEXT_LENGTH + 1}
            className={cn(TEXTAREA_CLASS_NAME, 'min-h-48 w-full resize-y')}
            placeholder="Colle ici l'annonce ou le message reçu"
            value={pastedText}
            onChange={(changeEvent) => setPastedText(changeEvent.target.value)}
            disabled={isExtracting}
          />
        </div>
        {errorAlert}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void extract()} disabled={isExtracting || !hasAnthropicApiKey}>
            {isExtracting ? 'Analyse en cours…' : "Pré-remplir avec l'IA"}
          </Button>
          <Button type="button" variant="outline" onClick={switchToManualEntry} disabled={isExtracting}>
            Saisie manuelle
          </Button>
        </div>
        {isExtracting && (
          <p role="status" className="text-sm text-ink-secondary">
            Claude lit l&apos;annonce, cela peut prendre jusqu&apos;à deux minutes.
          </p>
        )}
      </>
    ) : (
      <>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-job-application-postingRawText">Texte de l&apos;annonce</Label>
          <textarea
            id="new-job-application-postingRawText"
            rows={12}
            maxLength={MAX_PASTED_TEXT_LENGTH + 1}
            className={cn(TEXTAREA_CLASS_NAME, 'min-h-48 w-full resize-y')}
            value={formValues.postingRawText}
            onChange={(changeEvent) => setTextFormValue('postingRawText', changeEvent.target.value)}
            disabled={isExtracting}
          />
        </div>
        {retryExtractionButton}
      </>
    )

  const verifyColumnContent =
    step === 'paste' ? (
      <p className="text-sm text-ink-secondary">
        Le formulaire apparaît ici après le pré-remplissage ou en saisie manuelle.
      </p>
    ) : (
      <>
        {errorAlert}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">La mission</legend>
          <div className="sm:col-span-2">{renderTextInput('title', 'Titre de la mission *', { required: true })}</div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            {renderTextInput('source', 'Source')}
            <div className="flex flex-wrap gap-2">
              {SOURCE_SUGGESTIONS.map((sourceSuggestion) => (
                <PillToggle
                  key={sourceSuggestion}
                  isPressed={formValues.source === sourceSuggestion}
                  onPressedChange={() => setTextFormValue('source', sourceSuggestion)}
                >
                  {sourceSuggestion}
                </PillToggle>
              ))}
            </div>
          </div>
          {renderTextInput('postingUrl', "Lien de l'annonce", { type: 'url', inputMode: 'url', placeholder: 'https://' })}
          <FormField htmlFor="new-job-application-status" label="Statut">
            <select
              id="new-job-application-status"
              className={NATIVE_SELECT_CLASS_NAME}
              value={formValues.status}
              onChange={(changeEvent) => {
                if (isJobApplicationStatus(changeEvent.target.value)) setStatus(changeEvent.target.value)
              }}
            >
              {ALL_JOB_APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {JOB_APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FormField>
          {renderTextInput('appliedOn', 'Date de candidature', { type: 'date' })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Les personnes</legend>
          {renderEntityField('intermediaryName', 'intermediary', 'Intermédiaire')}
          {renderEntityField('contactName', 'contact', 'Contact')}
          {renderTextInput('contactEmail', 'E-mail du contact', { type: 'email', inputMode: 'email' })}
          {renderTextInput('contactPhone', 'Téléphone du contact', { type: 'tel', inputMode: 'tel' })}
          {renderEntityField('endClientName', 'end_client', 'Client final')}
          {renderTextInput('endClientParentName', 'Groupe du client final')}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Les conditions</legend>
          {renderTextInput('postedDailyRate', 'TJM annoncé (€)', { inputMode: 'numeric' })}
          {renderTextInput('location', 'Lieu')}
          {renderTextInput('remotePolicy', 'Télétravail')}
          {renderTextInput('desiredStart', 'Démarrage')}
          {renderTextInput('duration', 'Durée')}
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">Technologies</legend>
          <StackChipsEditor stack={formValues.stack} origin="posting" onChange={setStack} />
        </fieldset>
        <Button type="submit" className="self-start" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : 'Créer la candidature'}
        </Button>
      </>
    )

  const columns = (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="flex flex-col gap-4 rounded-2xl bg-lilac-panel p-6">
        <h2 className="font-heading text-lg font-bold text-ink">1 · Colle l&apos;annonce</h2>
        {pasteColumn}
      </section>
      <section className="flex flex-col gap-6 rounded-2xl bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-bold text-ink">2 · Vérifie</h2>
          {step === 'form' && isPrefilledByClaude && <Pill tone="lilac">Pré-rempli par Claude</Pill>}
        </div>
        {verifyColumnContent}
      </section>
    </div>
  )

  if (step === 'paste') return columns

  return (
    <form noValidate onSubmit={handleSubmit}>
      {columns}
    </form>
  )
}
