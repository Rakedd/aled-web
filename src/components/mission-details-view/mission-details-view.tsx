import { formatDailyRate, toDisplayText } from '@/domain/job-application-display'
import { formatParisDate } from '@/domain/paris-time'
import type { MissionDetailsViewProps } from './interfaces'

export const MissionDetailsView = ({ jobApplication }: MissionDetailsViewProps) => {
  const missionDetails = [
    { term: 'TJM annoncé', value: formatDailyRate(jobApplication.postedDailyRate) },
    { term: 'TJM demandé', value: formatDailyRate(jobApplication.requestedDailyRate) },
    { term: 'Lieu', value: jobApplication.location },
    { term: 'Présentiel / télétravail', value: jobApplication.remotePolicy },
    { term: 'Démarrage souhaité', value: jobApplication.desiredStart },
    {
      term: 'Démarrage effectif',
      value: jobApplication.actualStartDate === null ? null : formatParisDate(jobApplication.actualStartDate),
    },
    { term: 'Durée', value: jobApplication.duration },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {missionDetails.map(({ term, value }) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words">{toDisplayText(value)}</dd>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="break-words whitespace-pre-wrap">{toDisplayText(jobApplication.notes)}</dd>
        </div>
      </dl>
      {jobApplication.postingRawText !== null && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Texte original de l&apos;annonce</summary>
          <p className="mt-3 text-sm break-words whitespace-pre-wrap">{jobApplication.postingRawText}</p>
        </details>
      )}
    </div>
  )
}
