'use client'

import { BlockForm } from '@/components/block-form'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { TextField } from '@/components/text-field'
import { TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { ContactProfileFormProps } from './interfaces'

const FULL_NAME_INPUT_ID = 'contact-profile-fullName'
const INTERMEDIARY_NAME_INPUT_ID = 'contact-profile-intermediaryName'
const NOTES_TEXTAREA_ID = 'contact-profile-notes'

export const ContactProfileForm = ({ searchEntities, ...controllerParameters }: ContactProfileFormProps) => {
  const { formValues, setFormValue, isSaving, errorMessage, save, cancel } = useController(controllerParameters)

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={cancel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={FULL_NAME_INPUT_ID}
          label="Nom"
          value={formValues.fullName}
          onValueChange={(value) => setFormValue('fullName', value)}
        />
        <FormField htmlFor={INTERMEDIARY_NAME_INPUT_ID} label="Agence">
          <EntityAutocomplete
            id={INTERMEDIARY_NAME_INPUT_ID}
            entityKind="intermediary"
            value={formValues.intermediaryName}
            onChange={(value) => setFormValue('intermediaryName', value)}
            searchEntities={searchEntities}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="contact-profile-phone"
          label="Téléphone"
          type="tel"
          inputMode="tel"
          value={formValues.phone}
          onValueChange={(value) => setFormValue('phone', value)}
        />
        <TextField
          id="contact-profile-email"
          label="E-mail"
          type="email"
          inputMode="email"
          value={formValues.email}
          onValueChange={(value) => setFormValue('email', value)}
        />
        <TextField
          id="contact-profile-linkedinUrl"
          label="LinkedIn"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={formValues.linkedinUrl}
          onValueChange={(value) => setFormValue('linkedinUrl', value)}
        />
      </div>
      <TextField
        id="contact-profile-referredBy"
        label="Recommandé par"
        value={formValues.referredBy}
        onValueChange={(value) => setFormValue('referredBy', value)}
      />
      <FormField htmlFor={NOTES_TEXTAREA_ID} label="Notes">
        <textarea
          id={NOTES_TEXTAREA_ID}
          rows={5}
          className={cn(TEXTAREA_CLASS_NAME, 'min-h-24 w-full resize-y')}
          value={formValues.notes}
          onChange={(changeEvent) => setFormValue('notes', changeEvent.target.value)}
        />
      </FormField>
    </BlockForm>
  )
}
