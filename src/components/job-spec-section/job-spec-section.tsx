'use client'

import { useRouter } from 'next/navigation'
import type { DragEvent, FormEvent } from 'react'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { StackChipsEditor } from '@/components/stack-chips-editor'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { buildJobSpecPdfPath, JOB_SPEC_PDF_MIME_TYPE, MAX_JOB_SPEC_PDF_MEGABYTES } from '@/domain/job-spec'
import { formatParisDate } from '@/domain/paris-time'
import { useController } from './controller'
import type { JobSpecSectionProps } from './interfaces'
import { TEXTAREA_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'

const PDF_INPUT_ID = 'job-spec-pdf'
const PASTED_TEXT_ID = 'job-spec-pasted-text'

export const JobSpecSection = ({
  jobApplicationId,
  jobSpec,
  uploadJobSpecPdf,
  saveJobSpecText,
  confirmJobSpecStack,
  discardPendingJobSpecStack,
  hasAnthropicApiKey,
}: JobSpecSectionProps) => {
  const router = useRouter()
  const {
    pastedText,
    setPastedText,
    draftStack,
    setDraftStack,
    noTechnologyFoundMessage,
    aiErrorMessage,
    errorMessage,
    isSubmitting,
    isAnalyzingJobSpec,
    selectPdfFile,
    saveText,
    confirmDraftStack,
    discardDraftStack,
  } = useController({
    jobApplicationId,
    jobSpec,
    uploadJobSpecPdf,
    saveJobSpecText,
    confirmJobSpecStack,
    discardPendingJobSpecStack,
    hasAnthropicApiKey,
    onDataChanged: router.refresh,
  })

  const handlePdfDrop = (dragEvent: DragEvent<HTMLDivElement>) => {
    dragEvent.preventDefault()
    void selectPdfFile(dragEvent.dataTransfer.files[0])
  }

  const handleTextSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void saveText()
  }

  return (
    <section aria-labelledby="job-spec-section-title" className="flex min-w-0 flex-col gap-4">
      <h2 id="job-spec-section-title" className="text-lg font-semibold">
        Fiche métier
      </h2>
      {!hasAnthropicApiKey && <MissingAnthropicApiKeyNotice featureDescription="l'extraction de la stack" />}
      {jobSpec === null ? (
        <p className="text-sm text-muted-foreground">Aucune fiche métier pour l&apos;instant.</p>
      ) : jobSpec.sourceKind === 'pdf' ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">PDF ajouté le {formatParisDate(jobSpec.updatedAt)}</p>
          <a
            href={buildJobSpecPdfPath(jobApplicationId)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Voir le PDF
          </a>
        </div>
      ) : (
        <details className="text-sm">
          <summary className="cursor-pointer">Texte collé le {formatParisDate(jobSpec.updatedAt)}</summary>
          <p className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border p-2 break-words whitespace-pre-wrap">
            {jobSpec.rawText}
          </p>
        </details>
      )}
      {draftStack !== null && (
        <div
          role="group"
          aria-labelledby="job-spec-draft-title"
          className="flex flex-col gap-3 rounded-lg border border-dashed border-primary p-3"
        >
          <h3 id="job-spec-draft-title" className="text-sm font-semibold">
            Stack extraite (brouillon)
          </h3>
          <p className="text-sm text-muted-foreground">
            Vérifie la stack, puis valide-la pour remplacer celle de la candidature.
          </p>
          <StackChipsEditor stack={draftStack} origin="job_spec" onChange={setDraftStack} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void confirmDraftStack()} disabled={isSubmitting}>
              Valider
            </Button>
            <Button type="button" variant="outline" onClick={() => void discardDraftStack()} disabled={isSubmitting}>
              Ignorer
            </Button>
          </div>
        </div>
      )}
      {noTechnologyFoundMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {noTechnologyFoundMessage}
        </p>
      )}
      {aiErrorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {aiErrorMessage}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {isAnalyzingJobSpec && (
        <p role="status" className="text-sm text-muted-foreground">
          {hasAnthropicApiKey ? 'Enregistrement et analyse de la fiche en cours…' : 'Enregistrement de la fiche en cours…'}
        </p>
      )}
      <div
        className="flex flex-col gap-2 rounded-lg border border-dashed border-input p-3"
        onDragOver={(dragEvent) => dragEvent.preventDefault()}
        onDrop={handlePdfDrop}
      >
        <Label htmlFor={PDF_INPUT_ID}>{jobSpec === null ? 'Déposer un PDF' : 'Remplacer par un PDF'}</Label>
        <input
          id={PDF_INPUT_ID}
          type="file"
          accept={JOB_SPEC_PDF_MIME_TYPE}
          className="max-w-full text-sm"
          disabled={isSubmitting}
          onChange={(changeEvent) => {
            void selectPdfFile(changeEvent.target.files?.[0])
            changeEvent.target.value = ''
          }}
        />
        <p className="text-xs text-muted-foreground">PDF uniquement, {MAX_JOB_SPEC_PDF_MEGABYTES} Mo maximum.</p>
      </div>
      <form noValidate onSubmit={handleTextSubmit} className="flex flex-col gap-2">
        <Label htmlFor={PASTED_TEXT_ID}>
          {jobSpec === null ? 'Ou coller le texte de la fiche' : 'Ou remplacer par un texte collé'}
        </Label>
        <textarea
          id={PASTED_TEXT_ID}
          rows={6}
          className={cn(TEXTAREA_CLASS_NAME, 'min-h-32 w-full resize-y')}
          placeholder="Colle ici la fiche métier ou le mail reçu"
          value={pastedText}
          onChange={(changeEvent) => setPastedText(changeEvent.target.value)}
          disabled={isSubmitting}
        />
        <Button type="submit" variant="outline" className="self-start" disabled={isSubmitting}>
          Enregistrer le texte
        </Button>
      </form>
    </section>
  )
}
