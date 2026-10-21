'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent } from 'react'
import { EntityAutocomplete } from '@/components/entity-autocomplete'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useController } from './controller'
import type { NewContactFormProps, NewContactFormValues } from './interfaces'

export const NewContactForm = ({ createContact, searchEntities }: NewContactFormProps) => {
  const router = useRouter()
  const { formValues, errorMessage, isSubmitting, setFormValue, submit } = useController({
    createContact,
    navigateTo: router.push,
  })

  const renderTextInput = (
    valueName: keyof NewContactFormValues,
    label: string,
    inputProps: ComponentProps<typeof Input> = {},
  ) => (
    <FormField htmlFor={`new-contact-${valueName}`} label={label}>
      <Input
        id={`new-contact-${valueName}`}
        value={formValues[valueName]}
        onChange={(changeEvent) => setFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {renderTextInput('fullName', 'Nom *', { required: true })}
        <FormField htmlFor="new-contact-intermediaryName" label="Agence">
          <EntityAutocomplete
            id="new-contact-intermediaryName"
            entityKind="intermediary"
            value={formValues.intermediaryName}
            onChange={(value) => setFormValue('intermediaryName', value)}
            searchEntities={searchEntities}
          />
        </FormField>
        {renderTextInput('phone', 'Téléphone', { type: 'tel', inputMode: 'tel' })}
        {renderTextInput('email', 'E-mail', { type: 'email', inputMode: 'email' })}
        {renderTextInput('linkedinUrl', 'LinkedIn', { type: 'url', inputMode: 'url', placeholder: 'https://' })}
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le contact'}
      </Button>
    </form>
  )
}
