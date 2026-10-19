'use client'

import { BlockForm } from '@/components/block-form'
import { FormField } from '@/components/form-field'
import { TextField } from '@/components/text-field'
import { TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { MissionDetailsFormProps } from './interfaces'

const NOTES_TEXTAREA_ID = 'mission-details-notes'

export const MissionDetailsForm = (props: MissionDetailsFormProps) => {
  const { formValues, setFormValue, isSaving, errorMessage, save, cancel } = useController(props)

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={cancel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="mission-details-postedDailyRate"
          label="TJM annoncé (€)"
          inputMode="numeric"
          value={formValues.postedDailyRate}
          onValueChange={(value) => setFormValue('postedDailyRate', value)}
        />
        <TextField
          id="mission-details-requestedDailyRate"
          label="TJM demandé (€)"
          inputMode="numeric"
          value={formValues.requestedDailyRate}
          onValueChange={(value) => setFormValue('requestedDailyRate', value)}
        />
        <TextField
          id="mission-details-location"
          label="Lieu"
          value={formValues.location}
          onValueChange={(value) => setFormValue('location', value)}
        />
        <TextField
          id="mission-details-remotePolicy"
          label="Présentiel / télétravail"
          value={formValues.remotePolicy}
          onValueChange={(value) => setFormValue('remotePolicy', value)}
        />
        <TextField
          id="mission-details-desiredStart"
          label="Démarrage souhaité"
          value={formValues.desiredStart}
          onValueChange={(value) => setFormValue('desiredStart', value)}
        />
        <TextField
          id="mission-details-actualStartDate"
          label="Démarrage effectif"
          type="date"
          value={formValues.actualStartDate}
          onValueChange={(value) => setFormValue('actualStartDate', value)}
        />
        <TextField
          id="mission-details-duration"
          label="Durée"
          value={formValues.duration}
          onValueChange={(value) => setFormValue('duration', value)}
        />
      </div>
      <FormField htmlFor={NOTES_TEXTAREA_ID} label="Notes">
        <textarea
          id={NOTES_TEXTAREA_ID}
          rows={4}
          className={cn(TEXTAREA_CLASS_NAME, 'min-h-24 w-full resize-y')}
          value={formValues.notes}
          onChange={(changeEvent) => setFormValue('notes', changeEvent.target.value)}
        />
      </FormField>
    </BlockForm>
  )
}
