'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, FormEvent } from 'react'
import { BlockFormActions } from '@/components/block-form-actions'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { useController } from './controller'
import type { MissionDetailsFormProps, MissionDetailsFormValueName } from './interfaces'

const NOTES_TEXTAREA_ID = 'mission-details-notes'

export const MissionDetailsForm = ({ jobApplication, updateJobApplication, onClose }: MissionDetailsFormProps) => {
  const router = useRouter()
  const { formValues, setFormValue, isSaving, errorMessage, save, cancel } = useController({
    jobApplication,
    updateJobApplication,
    onDataChanged: router.refresh,
    onClose,
  })

  const renderTextInput = (
    valueName: MissionDetailsFormValueName,
    label: string,
    inputProps: ComponentProps<typeof Input> = {},
  ) => (
    <FormField htmlFor={`mission-details-${valueName}`} label={label}>
      <Input
        id={`mission-details-${valueName}`}
        value={formValues[valueName]}
        onChange={(changeEvent) => setFormValue(valueName, changeEvent.target.value)}
        {...inputProps}
      />
    </FormField>
  )

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void save()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {renderTextInput('postedDailyRate', 'TJM annoncé (€)', { inputMode: 'numeric' })}
        {renderTextInput('requestedDailyRate', 'TJM demandé (€)', { inputMode: 'numeric' })}
        {renderTextInput('location', 'Lieu')}
        {renderTextInput('remotePolicy', 'Présentiel / télétravail')}
        {renderTextInput('desiredStart', 'Démarrage souhaité')}
        {renderTextInput('actualStartDate', 'Démarrage effectif', { type: 'date' })}
        {renderTextInput('duration', 'Durée')}
      </div>
      <FormField htmlFor={NOTES_TEXTAREA_ID} label="Notes">
        <textarea
          id={NOTES_TEXTAREA_ID}
          rows={4}
          className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          value={formValues.notes}
          onChange={(changeEvent) => setFormValue('notes', changeEvent.target.value)}
        />
      </FormField>
      <BlockFormActions isSaving={isSaving} errorMessage={errorMessage} onCancel={cancel} />
    </form>
  )
}
