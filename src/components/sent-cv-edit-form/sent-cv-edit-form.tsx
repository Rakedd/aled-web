'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
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

export const SentCvEditForm = ({
  sentCv,
  cvOptions,
  hasCvLoadFailed,
  onClose,
  ...controllerParameters
}: SentCvEditFormProps) => {
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
    isDetachDialogOpen,
    setIsDetachDialogOpen,
  } = useController({ cvOptions, onClose, ...controllerParameters })

  const libraryHint = hasCvLoadFailed
    ? 'Impossible de charger tes CV pour le moment.'
    : cvOptions.length === 0
      ? "Ta bibliothèque n'a pas encore de CV."
      : undefined

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
          hint={libraryHint}
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
        <Button
          type="button"
          variant="link"
          className="self-start px-0"
          disabled={isSaving}
          onClick={() => setIsDetachDialogOpen(true)}
        >
          Retirer le CV envoyé
        </Button>
      )}
      <AlertDialog.Root open={isDetachDialogOpen} onOpenChange={setIsDetachDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-card p-6 shadow-xl outline-none">
            <AlertDialog.Title className="text-lg font-semibold">Retirer le CV envoyé ?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">
              Ce CV ne sera plus rattaché à la candidature. Un CV sur mesure sera supprimé.
            </AlertDialog.Description>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDetachDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="button" variant="destructive" onClick={() => void detach()}>
                Retirer
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </BlockForm>
  )
}
