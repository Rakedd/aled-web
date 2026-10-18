'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent } from 'react'
import { BlockFormActions } from '@/components/block-form-actions'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { useController } from './controller'
import type { ContactEditFormProps, ContactEditFormValueName } from './interfaces'

const CONTACT_NAME_INPUT_ID = 'contact-edit-contactName'
const DETAILS_HINT_ID = 'contact-edit-details-hint'
const NEW_CONTACT_HINT = "Enregistre d'abord le nouveau contact pour modifier ses coordonnées."
const MISSING_CONTACT_HINT = "Renseigne et enregistre d'abord un contact pour ajouter ses coordonnées."
const UNAVAILABLE_DETAILS_HINT = 'Les coordonnées de ce contact sont indisponibles pour le moment.'

export const ContactEditForm = ({
  jobApplication,
  contactDetails,
  updateJobApplication,
  updateContactDetails,
  searchEntities,
  onClose,
}: ContactEditFormProps) => {
  const router = useRouter()
  const {
    formValues,
    setFormValue,
    areContactDetailsDisabled,
    isContactNameEdited,
    isSaving,
    errorMessage,
    save,
    cancel,
  } = useController({
    jobApplication,
    contactDetails,
    updateJobApplication,
    updateContactDetails,
    onDataChanged: router.refresh,
    onClose,
  })

  const renderDetailInput = (
    valueName: Exclude<ContactEditFormValueName, 'contactName'>,
    label: string,
    inputProps: ComponentProps<typeof Input>,
  ) => (
    <FormField htmlFor={`contact-edit-${valueName}`} label={label}>
      <Input
        id={`contact-edit-${valueName}`}
        value={formValues[valueName]}
        disabled={areContactDetailsDisabled}
        aria-describedby={areContactDetailsDisabled ? DETAILS_HINT_ID : undefined}
        onChange={(changeEvent) => setFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const readDetailsHint = (): string => {
    if (isContactNameEdited) return NEW_CONTACT_HINT
    return jobApplication.contactId === null ? MISSING_CONTACT_HINT : UNAVAILABLE_DETAILS_HINT
  }

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void save()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        {renderDetailInput('phone', 'Téléphone', { type: 'tel', inputMode: 'tel' })}
        {renderDetailInput('email', 'E-mail', { type: 'email', inputMode: 'email' })}
        {renderDetailInput('linkedinUrl', 'LinkedIn', { type: 'url', inputMode: 'url', placeholder: 'https://' })}
      </div>
      {areContactDetailsDisabled && (
        <p id={DETAILS_HINT_ID} className="text-xs text-muted-foreground">
          {readDetailsHint()}
        </p>
      )}
      <BlockFormActions isSaving={isSaving} errorMessage={errorMessage} onCancel={cancel} />
    </form>
  )
}
