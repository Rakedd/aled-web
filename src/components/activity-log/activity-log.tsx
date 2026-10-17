'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ACTIVITY_KIND_LABELS } from '@/domain/activity-log'
import { formatParisDateTime } from '@/domain/paris-time'
import type { ActivityKind } from '@/domain/types'
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
    <section aria-labelledby="activity-log-title" className="flex flex-col gap-4">
      <h2 id="activity-log-title" className="text-lg font-semibold">
        Journal des échanges
      </h2>
      <form noValidate onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={KIND_SELECT_ID}>Type</Label>
          <select
            id={KIND_SELECT_ID}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
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
            className="w-auto"
            value={occurredAtLocalDateTime}
            onChange={(changeEvent) => setOccurredAtLocalDateTime(changeEvent.target.value)}
            disabled={isAdding}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={SUMMARY_INPUT_ID}>Résumé</Label>
          <Input
            id={SUMMARY_INPUT_ID}
            value={summary}
            onChange={(changeEvent) => setSummary(changeEvent.target.value)}
            placeholder="Ex. : appel de qualification, rappeler jeudi"
            disabled={isAdding}
          />
        </div>
        <Button type="submit" disabled={isAdding}>
          Ajouter
        </Button>
      </form>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun échange pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
              <span className="shrink-0 text-xs text-muted-foreground sm:w-36 sm:pt-0.5">
                {formatParisDateTime(entry.occurredAt)}
              </span>
              <span className="shrink-0 text-sm font-medium sm:w-40">{ACTIVITY_KIND_LABELS[entry.kind]}</span>
              <span className="min-w-0 text-sm break-words">{entry.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
