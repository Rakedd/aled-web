import type { FormEvent } from 'react'
import { PdfDropZone } from '@/components/pdf-drop-zone'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { MAXIMUM_CV_LABEL_LENGTH } from '@/domain/cv-library'
import { useController } from './controller'
import type { AddCvFormProps } from './interfaces'

const LABEL_INPUT_ID = 'add-cv-label'
const PDF_INPUT_ID = 'add-cv-pdf'

export const AddCvForm = ({ createCv, onCreated, onCancel }: AddCvFormProps) => {
  const { label, setLabel, pdfFile, selectPdfFile, errorMessage, isSubmitting, submit } = useController({
    createCv,
    onCreated,
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-card p-4">
      <TextField
        id={LABEL_INPUT_ID}
        label="Nom du CV"
        value={label}
        onValueChange={setLabel}
        maxLength={MAXIMUM_CV_LABEL_LENGTH}
        disabled={isSubmitting}
      />
      <PdfDropZone
        inputId={PDF_INPUT_ID}
        label="Fichier PDF"
        selectedFileName={pdfFile?.name ?? null}
        isDisabled={isSubmitting}
        onSelectFile={selectPdfFile}
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ajout…' : 'Ajouter'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
