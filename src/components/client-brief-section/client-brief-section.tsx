'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CLIENT_BRIEF_MESSAGES, type ClientBriefSource, isExternalLinkUrl } from '@/domain/client-brief'
import { formatParisDateTime } from '@/domain/paris-time'
import { useController } from './controller'
import type { ClientBriefSectionProps, NotesSaveStatus } from './interfaces'

const NOTES_TEXTAREA_ID = 'client-brief-notes'
const DISALLOWED_MARKDOWN_ELEMENTS = ['img']

const NOTES_SAVE_STATUS_LABELS: Record<NotesSaveStatus, string | null> = {
  idle: null,
  unsaved: 'Modifications non enregistrées…',
  saving: 'Enregistrement…',
  saved: 'Notes enregistrées',
  failed: null,
}

const BriefMarkdownLink = ({ href, children }: ComponentProps<'a'> & ExtraProps) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )

const BRIEF_MARKDOWN_COMPONENTS: Components = { a: BriefMarkdownLink }

const keepOnlyExternalLinkUrl = (url: string): string => (isExternalLinkUrl(url) ? url : '')

const BriefSourceItem = ({ source }: { source: ClientBriefSource }) => (
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

export const ClientBriefSection = ({
  endClientBrief,
  endClientLabel,
  generateBriefForEndClient,
  updateEndClientNotes,
  hasAnthropicApiKey,
}: ClientBriefSectionProps) => {
  const router = useRouter()
  const {
    state,
    brief,
    isGenerating,
    errorMessage,
    generate,
    notes,
    changeNotes,
    notesSaveStatus,
    notesErrorMessage,
    retryNotesSave,
  } = useController({
    endClientBrief,
    generateBriefForEndClient,
    updateEndClientNotes,
    hasAnthropicApiKey,
    onDataChanged: router.refresh,
  })

  return (
    <section aria-labelledby="client-brief-section-title" className="flex min-w-0 flex-col gap-4">
      <h2 id="client-brief-section-title" className="text-lg font-semibold">
        Préparation : brief client
      </h2>
      {state === 'unknown_client' ? (
        <p className="text-sm text-muted-foreground">{CLIENT_BRIEF_MESSAGES.unknownClient}</p>
      ) : (
        <>
          {!hasAnthropicApiKey && (
            <MissingAnthropicApiKeyNotice featureDescription="la génération du brief client" />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-medium break-words">{endClientLabel}</p>
            <Button type="button" onClick={() => void generate()} disabled={isGenerating || !hasAnthropicApiKey}>
              {brief === null ? 'Générer le brief' : 'Régénérer le brief'}
            </Button>
          </div>
          {isGenerating && (
            <p role="status" className="text-sm text-muted-foreground">
              Recherche et rédaction du brief en cours, cela peut prendre une minute…
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {brief !== null && (
            <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Généré le {formatParisDateTime(brief.generatedAt)}</p>
              <div className="min-w-0 text-sm break-words [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mt-2 [&_ul]:list-disc">
                <Markdown
                  skipHtml
                  disallowedElements={DISALLOWED_MARKDOWN_ELEMENTS}
                  urlTransform={keepOnlyExternalLinkUrl}
                  components={BRIEF_MARKDOWN_COMPONENTS}
                >
                  {brief.markdown}
                </Markdown>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">Sources</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                  {brief.sources.map((source) => (
                    <BriefSourceItem key={source.url} source={source} />
                  ))}
                </ul>
              </div>
            </article>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor={NOTES_TEXTAREA_ID}>Mes notes sur ce client</Label>
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
        </>
      )}
    </section>
  )
}
