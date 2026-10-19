'use client'

import { BlockForm } from '@/components/block-form'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { TextField } from '@/components/text-field'
import { INTERMEDIARY_KIND_LABELS, INTERMEDIARY_KINDS } from '@/domain/entities'
import { useController } from './controller'
import type { HeaderEditFormProps } from './interfaces'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'

const INTERMEDIARY_NAME_INPUT_ID = 'header-edit-intermediaryName'
const INTERMEDIARY_KIND_SELECT_ID = 'header-edit-intermediaryKind'
const END_CLIENT_NAME_INPUT_ID = 'header-edit-endClientName'
const NEW_INTERMEDIARY_KIND_HINT = "Enregistre d'abord le nouvel intermédiaire pour choisir son type."

export const HeaderEditForm = ({ searchEntities, ...controllerParameters }: HeaderEditFormProps) => {
  const {
    formValues,
    setFormValue,
    isEndClientParentDisabled,
    isIntermediaryKindDisabled,
    isSaving,
    errorMessage,
    save,
    cancel,
  } = useController(controllerParameters)

  const shouldExplainIntermediaryKind =
    controllerParameters.jobApplication.intermediaryId !== null &&
    isIntermediaryKindDisabled &&
    formValues.intermediaryName.trim().length > 0

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={cancel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="header-edit-title"
            label="Titre de la mission *"
            required
            value={formValues.title}
            onValueChange={(value) => setFormValue('title', value)}
          />
        </div>
        <TextField
          id="header-edit-source"
          label="Source"
          value={formValues.source}
          onValueChange={(value) => setFormValue('source', value)}
        />
        <TextField
          id="header-edit-postingUrl"
          label="Lien de l'annonce"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={formValues.postingUrl}
          onValueChange={(value) => setFormValue('postingUrl', value)}
        />
        <FormField htmlFor={INTERMEDIARY_NAME_INPUT_ID} label="Intermédiaire">
          <EntityAutocomplete
            id={INTERMEDIARY_NAME_INPUT_ID}
            entityKind="intermediary"
            value={formValues.intermediaryName}
            onChange={(value) => setFormValue('intermediaryName', value)}
            searchEntities={searchEntities}
          />
        </FormField>
        <FormField
          htmlFor={INTERMEDIARY_KIND_SELECT_ID}
          label="Type d'intermédiaire"
          hint={shouldExplainIntermediaryKind ? NEW_INTERMEDIARY_KIND_HINT : undefined}
        >
          <select
            id={INTERMEDIARY_KIND_SELECT_ID}
            className={cn(NATIVE_SELECT_CLASS_NAME, 'w-full min-w-0')}
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
        <FormField htmlFor={END_CLIENT_NAME_INPUT_ID} label="Client final">
          <EntityAutocomplete
            id={END_CLIENT_NAME_INPUT_ID}
            entityKind="end_client"
            value={formValues.endClientName}
            onChange={(value) => setFormValue('endClientName', value)}
            onSelectSuggestion={(suggestion) => setFormValue('endClientParentName', suggestion.parentName ?? '')}
            searchEntities={searchEntities}
          />
        </FormField>
        <TextField
          id="header-edit-endClientParentName"
          label="Groupe du client final"
          disabled={isEndClientParentDisabled}
          value={formValues.endClientParentName}
          onValueChange={(value) => setFormValue('endClientParentName', value)}
        />
        <TextField
          id="header-edit-appliedOn"
          label="Date de candidature"
          type="date"
          value={formValues.appliedOn}
          onValueChange={(value) => setFormValue('appliedOn', value)}
        />
      </div>
    </BlockForm>
  )
}
