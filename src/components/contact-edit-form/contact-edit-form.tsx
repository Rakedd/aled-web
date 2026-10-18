'use client'

import { BlockForm } from '@/components/block-form'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { TextField } from '@/components/text-field'
import { useController } from './controller'
import type { ContactEditFormProps } from './interfaces'

const CONTACT_NAME_INPUT_ID = 'contact-edit-contactName'
const DETAILS_HINT_ID = 'contact-edit-details-hint'
const NEW_CONTACT_HINT = "Enregistre d'abord le nouveau contact pour modifier ses coordonnées."
const MISSING_CONTACT_HINT = "Renseigne et enregistre d'abord un contact pour ajouter ses coordonnées."
const UNAVAILABLE_DETAILS_HINT = 'Les coordonnées de ce contact sont indisponibles pour le moment.'

export const ContactEditForm = ({ searchEntities, ...controllerParameters }: ContactEditFormProps) => {
  const {
    formValues,
    setFormValue,
    areContactDetailsDisabled,
    isContactNameEdited,
    isSaving,
    errorMessage,
    save,
    cancel,
  } = useController(controllerParameters)

  const readDetailsHint = (): string => {
    if (isContactNameEdited) return NEW_CONTACT_HINT
    return controllerParameters.jobApplication.contactId === null ? MISSING_CONTACT_HINT : UNAVAILABLE_DETAILS_HINT
  }

  const detailsDescriptionId = areContactDetailsDisabled ? DETAILS_HINT_ID : undefined

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={cancel}>
      <FormField htmlFor={CONTACT_NAME_INPUT_ID} label="Nom">
        <EntityAutocomplete
          id={CONTACT_NAME_INPUT_ID}
          entityKind="contact"
          value={formValues.contactName}
          onChange={(value) => setFormValue('contactName', value)}
          searchEntities={searchEntities}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="contact-edit-phone"
          label="Téléphone"
          type="tel"
          inputMode="tel"
          disabled={areContactDetailsDisabled}
          aria-describedby={detailsDescriptionId}
          value={formValues.phone}
          onValueChange={(value) => setFormValue('phone', value)}
        />
        <TextField
          id="contact-edit-email"
          label="E-mail"
          type="email"
          inputMode="email"
          disabled={areContactDetailsDisabled}
          aria-describedby={detailsDescriptionId}
          value={formValues.email}
          onValueChange={(value) => setFormValue('email', value)}
        />
        <TextField
          id="contact-edit-linkedinUrl"
          label="LinkedIn"
          type="url"
          inputMode="url"
          placeholder="https://"
          disabled={areContactDetailsDisabled}
          aria-describedby={detailsDescriptionId}
          value={formValues.linkedinUrl}
          onValueChange={(value) => setFormValue('linkedinUrl', value)}
        />
      </div>
      {areContactDetailsDisabled && (
        <p id={DETAILS_HINT_ID} className="text-xs text-muted-foreground">
          {readDetailsHint()}
        </p>
      )}
    </BlockForm>
  )
}
