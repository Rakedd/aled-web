'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ACTIVITY_KIND_LABELS } from '@/domain/activity-log'
import { formatParisDateTime } from '@/domain/paris-time'
import type { ActivityKind } from '@/domain/types'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { useController } from './controller'
import type { ActivityLogProps } from './interfaces'

const KIND_SELECT_ID = 'activity-log-kind'
const SUMMARY_INPUT_ID = 'activity-log-summary'
const OCCURRED_AT_INPUT_ID = 'activity-log-occurred-at'

export const ActivityLog = ({
  jobApplicationId,
  initialEntries,
  addActivityLogEntry,
  listActivityLogEntries,
  now,
}: ActivityLogProps) => {
  const router = useRouter()
  const {
    kind,
    setKind,
    kindOptions,
    summary,
    setSummary,
    occurredAtLocalDateTime,
    setOccurredAtLocalDateTime,
    entries,
    isAdding,
    errorMessage,
    addEntry,
  } = useController({
    jobApplicationId,
    initialEntries,
    addActivityLogEntry,
    listActivityLogEntries,
    now,
    onDataChanged: router.refresh,
  })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void addEntry()
  }

  const handleKindChange = (candidate: string) => {
    const matchingKind: ActivityKind | undefined = kindOptions.find((kindOption) => kindOption === candidate)
    if (matchingKind) setKind(matchingKind)
  }

  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-5">
      <section aria-labelledby="activity-log-title" className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6 lg:col-span-3">
        <h2 id="activity-log-title" className="font-heading text-xl font-extrabold">
          Journal des échanges
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun échange pour l&apos;instant.</p>
        ) : (
          <ol className="flex flex-col">
            {entries.map((entry) => (
              <li key={entry.id} className="group flex gap-4">
                <span aria-hidden="true" className="flex flex-col items-center pt-1">
                  <span className="size-3.5 shrink-0 rounded-full bg-accent-text" />
                  <span className="w-0.5 grow bg-hairline group-last:hidden" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 pb-5 group-last:pb-0">
                  <span className="text-xs font-semibold text-ink-muted">
                    {formatParisDateTime(entry.occurredAt)} · {ACTIVITY_KIND_LABELS[entry.kind]}
                  </span>
                  <span className="text-sm break-words">{entry.summary}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="activity-log-form-title" className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-6 lg:col-span-2">
        <h2 id="activity-log-form-title" className="font-heading text-xl font-extrabold">
          Noter un échange
        </h2>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={KIND_SELECT_ID}>Type</Label>
            <select
              id={KIND_SELECT_ID}
              className={NATIVE_SELECT_CLASS_NAME}
              value={kind}
              onChange={(changeEvent) => handleKindChange(changeEvent.target.value)}
              disabled={isAdding}
            >
              {kindOptions.map((kindOption) => (
                <option key={kindOption} value={kindOption}>
                  {ACTIVITY_KIND_LABELS[kindOption]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={OCCURRED_AT_INPUT_ID}>Date et heure</Label>
            <Input
              id={OCCURRED_AT_INPUT_ID}
              type="datetime-local"
              value={occurredAtLocalDateTime}
              onChange={(changeEvent) => setOccurredAtLocalDateTime(changeEvent.target.value)}
              disabled={isAdding}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={SUMMARY_INPUT_ID}>Résumé</Label>
            <Input
              id={SUMMARY_INPUT_ID}
              value={summary}
              onChange={(changeEvent) => setSummary(changeEvent.target.value)}
              placeholder="Ex. : appel de qualification, rappeler jeudi"
              disabled={isAdding}
            />
          </div>
          <Button type="submit" className="self-start" disabled={isAdding}>
            Ajouter
          </Button>
        </form>
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
      </section>
    </div>
  )
}
