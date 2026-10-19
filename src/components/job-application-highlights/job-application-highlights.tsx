import { INTERVIEW_KIND_LABELS } from '@/domain/interviews'
import { formatDailyRate } from '@/domain/job-application-display'
import { formatInterviewCountdown, formatParisInterviewDateTime } from '@/domain/paris-time'
import { cn } from '@/lib/utils'
import type { DailyRateHighlight, JobApplicationHighlightsProps } from './interfaces'

const HIGHLIGHT_TILE_CLASS_NAME = 'flex min-w-0 flex-col gap-1 rounded-2xl p-6'
const HIGHLIGHT_FIGURE_CLASS_NAME = 'font-heading leading-tight font-extrabold tracking-tight'

const selectDailyRateHighlight = (
  requestedDailyRate: number | null,
  postedDailyRate: number | null,
): DailyRateHighlight => {
  if (requestedDailyRate !== null) return { label: 'TJM demandé', formattedDailyRate: formatDailyRate(requestedDailyRate) }
  if (postedDailyRate !== null) return { label: 'TJM annoncé', formattedDailyRate: formatDailyRate(postedDailyRate) }
  return { label: 'TJM non renseigné', formattedDailyRate: null }
}

export const JobApplicationHighlights = ({
  requestedDailyRate,
  postedDailyRate,
  nextInterview,
  now,
  preparation,
}: JobApplicationHighlightsProps) => {
  const dailyRateHighlight = selectDailyRateHighlight(requestedDailyRate, postedDailyRate)

  return (
    <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1">
      <section
        aria-labelledby="job-application-daily-rate-title"
        className={cn(HIGHLIGHT_TILE_CLASS_NAME, 'justify-end bg-forest text-on-forest')}
      >
        <h2 id="job-application-daily-rate-title" className="text-sm font-semibold">
          {dailyRateHighlight.label}
        </h2>
        {dailyRateHighlight.formattedDailyRate !== null && (
          <p className={cn(HIGHLIGHT_FIGURE_CLASS_NAME, 'text-3xl')}>{dailyRateHighlight.formattedDailyRate}/j</p>
        )}
      </section>
      <section
        aria-labelledby="job-application-next-interview-title"
        className={cn(HIGHLIGHT_TILE_CLASS_NAME, 'justify-end bg-peach text-ink')}
      >
        <h2 id="job-application-next-interview-title" className="text-sm font-bold">
          {nextInterview === null
            ? 'Prochain entretien'
            : `Prochain entretien · ${formatInterviewCountdown(nextInterview.startsAt, now)}`}
        </h2>
        {nextInterview === null ? (
          <p className="text-base">Aucun entretien prévu</p>
        ) : (
          <>
            <p className={cn(HIGHLIGHT_FIGURE_CLASS_NAME, 'text-2xl')}>{formatParisInterviewDateTime(nextInterview.startsAt)}</p>
            <p className="text-sm font-semibold">{INTERVIEW_KIND_LABELS[nextInterview.kind]}</p>
          </>
        )}
      </section>
      <div className={cn(HIGHLIGHT_TILE_CLASS_NAME, 'bg-lilac text-ink sm:col-span-2 lg:col-span-1')}>{preparation}</div>
    </div>
  )
}
