'use client'

import { BlockForm } from '@/components/block-form'
import { FormField } from '@/components/form-field'
import { PdfDropZone } from '@/components/pdf-drop-zone'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { MAXIMUM_CV_LABEL_LENGTH } from '@/domain/cv-library'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { useController } from './controller'
import type { SentCvEditFormProps, SentCvSource } from './interfaces'

const LIBRARY_SELECT_ID = 'sent-cv-edit-library'
const TAILORED_LABEL_INPUT_ID = 'sent-cv-edit-tailored-label'
const TAILORED_PDF_INPUT_ID = 'sent-cv-edit-tailored-pdf'

const SOURCE_CHOICES: { source: SentCvSource; label: string }[] = [
  { source: 'library', label: 'Choisir dans ma bibliothèque' },
  { source: 'tailored', label: 'Déposer un CV sur mesure' },
]

export const SentCvEditForm = ({ sentCv, cvOptions, onClose, ...controllerParameters }: SentCvEditFormProps) => {
  const {
    source,
    setSource,
    selectedCvId,
    setSelectedCvId,
    tailoredLabel,
    setTailoredLabel,
    tailoredPdfFile,
    selectTailoredPdfFile,
    isAddedToLibrary,
    setIsAddedToLibrary,
    libraryNoticeMessage,
    errorMessage,
    isSaving,
    save,
    detach,
  } = useController({ cvOptions, onClose, ...controllerParameters })

  if (libraryNoticeMessage !== null) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 text-sm">
        <p>{libraryNoticeMessage}</p>
        <Button type="button" onClick={onClose}>
          OK
        </Button>
      </div>
    )
  }

  return (
    <BlockForm isSaving={isSaving} errorMessage={errorMessage} onSave={save} onCancel={onClose}>
      <fieldset className="flex flex-col gap-2" disabled={isSaving}>
        <legend className="sr-only">Origine du CV</legend>
        {SOURCE_CHOICES.map((choice) => (
          <label key={choice.source} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sent-cv-source"
              checked={source === choice.source}
              onChange={() => setSource(choice.source)}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>
      {source === 'library' ? (
        <FormField
          htmlFor={LIBRARY_SELECT_ID}
          label="CV de ma bibliothèque"
          hint={cvOptions.length === 0 ? "Ta bibliothèque n'a pas encore de CV." : undefined}
        >
          <select
            id={LIBRARY_SELECT_ID}
            className={NATIVE_SELECT_CLASS_NAME}
            value={selectedCvId}
            disabled={isSaving}
            onChange={(changeEvent) => setSelectedCvId(changeEvent.target.value)}
          >
            <option value="">Choisir un CV</option>
            {cvOptions.map((cvOption) => (
              <option key={cvOption.id} value={cvOption.id}>
                {cvOption.label}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <>
          <PdfDropZone
            inputId={TAILORED_PDF_INPUT_ID}
            label="Fichier PDF"
            selectedFileName={tailoredPdfFile?.name ?? null}
            isDisabled={isSaving}
            onSelectFile={selectTailoredPdfFile}
          />
          <TextField
            id={TAILORED_LABEL_INPUT_ID}
            label="Nom du CV"
            value={tailoredLabel}
            onValueChange={setTailoredLabel}
            maxLength={MAXIMUM_CV_LABEL_LENGTH}
            disabled={isSaving}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAddedToLibrary}
              disabled={isSaving}
              onChange={(changeEvent) => setIsAddedToLibrary(changeEvent.target.checked)}
            />
            {"L'ajouter aussi à ma bibliothèque"}
          </label>
        </>
      )}
      {sentCv !== null && (
        <Button type="button" variant="link" className="self-start px-0" disabled={isSaving} onClick={() => void detach()}>
          Retirer le CV envoyé
        </Button>
      )}
    </BlockForm>
  )
}
