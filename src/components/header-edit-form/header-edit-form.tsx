'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent } from 'react'
import { BlockFormActions } from '@/components/block-form-actions'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { INTERMEDIARY_KIND_LABELS, INTERMEDIARY_KINDS } from '@/domain/entities'
import { useController } from './controller'
import type { HeaderEditFormProps, HeaderEditFormValueName } from './interfaces'

const INTERMEDIARY_KIND_SELECT_ID = 'header-edit-intermediaryKind'
const NEW_INTERMEDIARY_KIND_HINT = "Enregistre d'abord le nouvel intermédiaire pour choisir son type."

export const HeaderEditForm = ({
  jobApplication,
  updateJobApplication,
  setEndClientParent,
  updateIntermediaryKind,
  searchEntities,
  onClose,
}: HeaderEditFormProps) => {
  const router = useRouter()
  const {
    formValues,
    setFormValue,
    isEndClientParentDisabled,
    isIntermediaryKindDisabled,
    isSaving,
    errorMessage,
    save,
    cancel,
  } = useController({
    jobApplication,
    updateJobApplication,
    setEndClientParent,
    updateIntermediaryKind,
    onDataChanged: router.refresh,
    onClose,
  })

  const renderTextInput = (
    valueName: HeaderEditFormValueName,
    label: string,
    inputProps: ComponentProps<typeof Input> = {},
  ) => (
    <FormField htmlFor={`header-edit-${valueName}`} label={label}>
      <Input
        id={`header-edit-${valueName}`}
        value={formValues[valueName]}
        onChange={(changeEvent) => setFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const renderEntityField = (
    valueName: 'intermediaryName' | 'endClientName',
    entityKind: 'intermediary' | 'end_client',
    label: string,
  ) => (
    <FormField htmlFor={`header-edit-${valueName}`} label={label}>
      <EntityAutocomplete
        id={`header-edit-${valueName}`}
        entityKind={entityKind}
        value={formValues[valueName]}
        onChange={(value) => setFormValue(valueName, value)}
        onSelectSuggestion={
          entityKind === 'end_client'
            ? (suggestion) => setFormValue('endClientParentName', suggestion.parentName ?? '')
            : undefined
        }
        searchEntities={searchEntities}
      />
    </FormField>
  )

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void save()
  }

  const shouldExplainIntermediaryKind =
    jobApplication.intermediaryId !== null && isIntermediaryKindDisabled && formValues.intermediaryName.trim().length > 0

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{renderTextInput('title', 'Titre de la mission *', { required: true })}</div>
        {renderTextInput('source', 'Source')}
        {renderTextInput('postingUrl', "Lien de l'annonce", { type: 'url', inputMode: 'url', placeholder: 'https://' })}
        {renderEntityField('intermediaryName', 'intermediary', 'Intermédiaire')}
        <FormField
          htmlFor={INTERMEDIARY_KIND_SELECT_ID}
          label="Type d'intermédiaire"
          hint={shouldExplainIntermediaryKind ? NEW_INTERMEDIARY_KIND_HINT : undefined}
        >
          <select
            id={INTERMEDIARY_KIND_SELECT_ID}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
            value={formValues.intermediaryKind}
            disabled={isIntermediaryKindDisabled}
            onChange={(changeEvent) => setFormValue('intermediaryKind', changeEvent.target.value)}
          >
            <option value="" disabled>
              Non précisé
            </option>
            {INTERMEDIARY_KINDS.map((intermediaryKindOption) => (
              <option key={intermediaryKindOption} value={intermediaryKindOption}>
                {INTERMEDIARY_KIND_LABELS[intermediaryKindOption]}
              </option>
            ))}
          </select>
        </FormField>
        {renderEntityField('endClientName', 'end_client', 'Client final')}
        {renderTextInput('endClientParentName', 'Groupe du client final', { disabled: isEndClientParentDisabled })}
        {renderTextInput('appliedOn', 'Date de candidature', { type: 'date' })}
      </div>
      <BlockFormActions isSaving={isSaving} errorMessage={errorMessage} onCancel={cancel} />
    </form>
  )
}
