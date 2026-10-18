'use client'

import { Dialog } from '@base-ui/react/dialog'
import { MarkdownContent } from '@/components/markdown-content'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CLIENT_BRIEF_MESSAGES, type ClientBriefSource, isExternalLinkUrl } from '@/domain/client-brief'
import { BRIEF_LANGUAGES, BRIEF_LANGUAGE_LABELS, isBriefLanguage } from '@/domain/interview-preparation'
import { formatParisDateTime } from '@/domain/paris-time'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { InterviewPreparationModalContentProps, InterviewPreparationModalProps, NotesSaveStatus } from './interfaces'

const NOTES_TEXTAREA_ID = 'interview-preparation-notes'
const REGENERATION_LANGUAGE_SELECT_ID = 'interview-preparation-regeneration-language'
const GENERATION_IN_PROGRESS_LABEL = "Génération… (jusqu'à 4 min)"
const UNKNOWN_CLIENT_MESSAGE = `${CLIENT_BRIEF_MESSAGES.unknownClient}.`

const NOTES_SAVE_STATUS_LABELS: Record<NotesSaveStatus, string | null> = {
  idle: null,
  unsaved: 'Modifications non enregistrées…',
  saving: 'Enregistrement…',
  saved: 'Notes enregistrées',
  failed: null,
}

const SourceItem = ({ source }: { source: ClientBriefSource }) => (
  <li className="break-words">
    {isExternalLinkUrl(source.url) ? (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {source.title}
      </a>
    ) : (
      <span>{source.title}</span>
    )}
  </li>
)

const InterviewPreparationModalContent = ({
  preparation,
  isGenerating,
  errorMessage,
  hasAnthropicApiKey,
  onRegenerate,
  updateEndClientNotes,
  onNotesSaved,
}: InterviewPreparationModalContentProps) => {
  const {
    notes,
    changeNotes,
    notesSaveStatus,
    notesErrorMessage,
    retryNotesSave,
    regenerationLanguage,
    changeRegenerationLanguage,
    requestRegeneration,
  } = useController({
    endClientId: preparation.endClientId,
    initialNotes: preparation.notes,
    language: preparation.language,
    updateEndClientNotes,
    onNotesSaved,
    onRegenerate,
  })
  const { brief, questions } = preparation
  const generatedAt = brief?.generatedAt ?? questions?.generatedAt ?? null

  return (
    <>
      <div className="flex flex-col gap-1">
        <Dialog.Title className="text-lg font-semibold">Préparation d&apos;entretien</Dialog.Title>
        {preparation.endClientName !== null && (
          <Dialog.Description className="text-sm text-muted-foreground">{preparation.endClientName}</Dialog.Description>
        )}
      </div>
      {brief !== null ? (
        <MarkdownContent markdown={brief.markdown} />
      ) : (
        preparation.endClientId === null && <p className="text-sm text-muted-foreground">{UNKNOWN_CLIENT_MESSAGE}</p>
      )}
      {preparation.endClientId !== null && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={NOTES_TEXTAREA_ID}>Mes notes sur l&apos;entreprise</Label>
          <textarea
            id={NOTES_TEXTAREA_ID}
            rows={5}
            className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            placeholder="Partagées avec toutes les candidatures chez ce client"
            value={notes}
            onChange={(changeEvent) => changeNotes(changeEvent.target.value)}
          />
          <p role="status" className="min-h-5 text-xs text-muted-foreground">
            {NOTES_SAVE_STATUS_LABELS[notesSaveStatus]}
          </p>
          {notesErrorMessage && (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-destructive">
                {notesErrorMessage}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={retryNotesSave}>
                Réessayer
              </Button>
            </div>
          )}
        </div>
      )}
      {questions !== null && (
        <section aria-labelledby="interview-preparation-questions-title" className="flex flex-col gap-2">
          <h3 id="interview-preparation-questions-title" className="text-sm font-semibold">
            Questions à poser en entretien
          </h3>
          <ol
            aria-labelledby="interview-preparation-questions-title"
            className="flex list-decimal flex-col gap-1 pl-5 text-sm"
          >
            {questions.questions.map((question) => (
              <li key={question} className="break-words">
                {question}
              </li>
            ))}
          </ol>
        </section>
      )}
      {brief !== null && brief.sources.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Voir les sources ({brief.sources.length})</summary>
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
            {brief.sources.map((source) => (
              <SourceItem key={source.url} source={source} />
            ))}
          </ul>
        </details>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t pt-4">
        {generatedAt !== null && (
          <p className="text-xs text-muted-foreground">Généré le {formatParisDateTime(generatedAt)}</p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Label htmlFor={REGENERATION_LANGUAGE_SELECT_ID} className="sr-only">
            Langue de la régénération
          </Label>
          <select
            id={REGENERATION_LANGUAGE_SELECT_ID}
            value={regenerationLanguage}
            disabled={isGenerating}
            onChange={(changeEvent) => {
              if (isBriefLanguage(changeEvent.target.value)) changeRegenerationLanguage(changeEvent.target.value)
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            {BRIEF_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {BRIEF_LANGUAGE_LABELS[language]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={requestRegeneration}
            disabled={isGenerating || !hasAnthropicApiKey}
          >
            {isGenerating ? GENERATION_IN_PROGRESS_LABEL : 'Régénérer'}
          </Button>
          <Dialog.Close className={cn(buttonVariants())}>Fermer</Dialog.Close>
        </div>
      </div>
    </>
  )
}

export const InterviewPreparationModal = ({ isOpen, onClose, ...contentProps }: InterviewPreparationModalProps) => (
  <Dialog.Root
    open={isOpen}
    onOpenChange={(isDialogOpen) => {
      if (!isDialogOpen) onClose()
    }}
  >
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
      <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl outline-none">
        <InterviewPreparationModalContent {...contentProps} />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
)
