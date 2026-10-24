'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, type MouseEvent } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Pill } from '@/components/pill'
import type { PillTone } from '@/components/pill/interfaces'
import { StatusBadge } from '@/components/status-badge'
import { TodoSummaryBar } from '@/components/todo-summary-bar'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { JobApplicationListItem } from '@/domain/job-application'
import {
  ALL_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_LABELS,
  isTerminalStatus,
} from '@/domain/job-application-status'
import type { JobApplicationsSortKey } from '@/domain/job-applications-filters'
import { getLastActivityAging, type LastActivityAging } from '@/domain/last-activity-aging'
import { PARIS_TIME_ZONE, formatRelativeDaysAgo } from '@/domain/paris-time'
import { jobApplicationRoute } from '@/domain/routes'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { JobApplicationsTableProps } from './interfaces'

const COLUMNS: { sortKey: JobApplicationsSortKey; label: string; isHiddenOnPhone: boolean }[] = [
  { sortKey: 'title', label: 'Mission', isHiddenOnPhone: false },
  { sortKey: 'intermediaryName', label: 'Intermédiaire', isHiddenOnPhone: false },
  { sortKey: 'contactName', label: 'Contact', isHiddenOnPhone: true },
  { sortKey: 'endClientLabel', label: 'Client final', isHiddenOnPhone: false },
  { sortKey: 'source', label: 'Source', isHiddenOnPhone: true },
  { sortKey: 'status', label: 'Statut', isHiddenOnPhone: false },
  { sortKey: 'appliedOn', label: 'Candidature', isHiddenOnPhone: true },
  { sortKey: 'lastActivityAt', label: 'Dernier échange', isHiddenOnPhone: false },
]

const PHONE_HIDDEN_CELL_CLASS_NAME = 'hidden md:table-cell'

const FILTER_DISCLOSURE_SUMMARY_CLASS_NAME = cn(
  buttonVariants({ variant: 'outline', size: 'lg' }),
  'cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden',
)

const FILTER_DISCLOSURE_PANEL_CLASS_NAME =
  'absolute top-full left-0 z-20 mt-2 flex min-w-56 flex-col rounded-2xl border bg-card p-3 text-sm shadow-lg'

const FILTER_OPTION_LABEL_CLASS_NAME = 'flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-9'

const CHECKBOX_CLASS_NAME = 'size-4 shrink-0 cursor-pointer accent-primary'

const EMPTY_CELL = '—'

const LAST_ACTIVITY_AGING_TONES: Record<LastActivityAging, PillTone> = {
  recent: 'forest-soft',
  aging: 'peach-soft',
  stale: 'clay',
}

const LAST_ACTIVITY_LEGEND: { aging: LastActivityAging; label: string }[] = [
  { aging: 'recent', label: 'moins de 7 j' },
  { aging: 'aging', label: '7 à 14 j' },
  { aging: 'stale', label: 'plus de 14 j' },
]

const LastActivityCell = ({ jobApplication, now }: { jobApplication: JobApplicationListItem; now: Date }) => {
  if (jobApplication.lastActivityAt === null) return EMPTY_CELL
  const relativeDaysAgo = formatRelativeDaysAgo(jobApplication.lastActivityAt, now)
  const aging = getLastActivityAging(jobApplication, now)
  return aging === null ? relativeDaysAgo : <Pill tone={LAST_ACTIVITY_AGING_TONES[aging]}>{relativeDaysAgo}</Pill>
}

export const JobApplicationsTable = ({ jobApplications, alerts, todoDetails, now }: JobApplicationsTableProps) => {
  const router = useRouter()
  const todoDetailsId = useId()
  const {
    filters,
    sort,
    availableSources,
    visibleJobApplications,
    kindCounts,
    selectedAlertKind,
    isTodoListExpanded,
    toggleAlertKind,
    toggleTodoListExpanded,
    setSearchText,
    setShowTerminal,
    toggleStatus,
    toggleSource,
    toggleSort,
  } = useController({ jobApplications, alerts })

  const selectableStatuses = ALL_JOB_APPLICATION_STATUSES.filter((status) => filters.showTerminal || !isTerminalStatus(status))

  const openJobApplicationFromRow = (clickEvent: MouseEvent<HTMLTableRowElement>, jobApplicationId: string) => {
    if (clickEvent.target instanceof Element && clickEvent.target.closest('a')) return
    router.push(jobApplicationRoute(jobApplicationId))
  }

  const getAriaSort = (sortKey: JobApplicationsSortKey) =>
    sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TodoSummaryBar
        kindCounts={kindCounts}
        selectedAlertKind={selectedAlertKind}
        onToggleAlertKind={toggleAlertKind}
        isExpanded={isTodoListExpanded}
        onToggleExpanded={toggleTodoListExpanded}
        detailsId={todoDetailsId}
      />
      <div id={todoDetailsId} hidden={!isTodoListExpanded}>
        {todoDetails}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-full flex-col gap-2 sm:w-72">
          <Label htmlFor="job-applications-search">Rechercher</Label>
          <Input
            id="job-applications-search"
            type="search"
            placeholder="Mission, client, contact…"
            value={filters.searchText}
            onChange={(changeEvent) => setSearchText(changeEvent.target.value)}
          />
        </div>
        <details className="group relative">
          <summary className={FILTER_DISCLOSURE_SUMMARY_CLASS_NAME}>
            Statut{filters.statuses.length > 0 && ` (${filters.statuses.length})`}
            <ChevronDown aria-hidden="true" strokeWidth={1.75} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <fieldset className={FILTER_DISCLOSURE_PANEL_CLASS_NAME}>
            <legend className="sr-only">Filtrer par statut</legend>
            {selectableStatuses.map((status) => (
              <label key={status} className={FILTER_OPTION_LABEL_CLASS_NAME}>
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                  className={CHECKBOX_CLASS_NAME}
                />
                {JOB_APPLICATION_STATUS_LABELS[status]}
              </label>
            ))}
          </fieldset>
        </details>
        {availableSources.length > 0 && (
          <details className="group relative">
            <summary className={FILTER_DISCLOSURE_SUMMARY_CLASS_NAME}>
              Source{filters.sources.length > 0 && ` (${filters.sources.length})`}
              <ChevronDown aria-hidden="true" strokeWidth={1.75} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <fieldset className={FILTER_DISCLOSURE_PANEL_CLASS_NAME}>
              <legend className="sr-only">Filtrer par source</legend>
              {availableSources.map((source) => (
                <label key={source} className={FILTER_OPTION_LABEL_CLASS_NAME}>
                  <input
                    type="checkbox"
                    checked={filters.sources.includes(source)}
                    onChange={() => toggleSource(source)}
                    className={CHECKBOX_CLASS_NAME}
                  />
                  {source}
                </label>
              ))}
            </fieldset>
          </details>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.showTerminal}
            onChange={(changeEvent) => setShowTerminal(changeEvent.target.checked)}
            className={CHECKBOX_CLASS_NAME}
          />
          Afficher les candidatures terminées
        </label>
        <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
          <span>Dernier échange :</span>
          {LAST_ACTIVITY_LEGEND.map(({ aging, label }) => (
            <Pill key={aging} tone={LAST_ACTIVITY_AGING_TONES[aging]}>
              {label}
            </Pill>
          ))}
        </div>
      </div>
      {visibleJobApplications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune candidature ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full text-left text-sm md:min-w-[56rem]">
            <thead className="border-b bg-muted">
              <tr>
                {COLUMNS.map(({ sortKey, label, isHiddenOnPhone }) => (
                  <th
                    key={sortKey}
                    scope="col"
                    aria-sort={getAriaSort(sortKey)}
                    className={cn('px-3 py-2 font-medium whitespace-nowrap', isHiddenOnPhone && PHONE_HIDDEN_CELL_CLASS_NAME)}
                  >
                    <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 hover:underline">
                      {label}
                      {sort.key === sortKey && <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleJobApplications.map((jobApplication) => (
                <tr
                  key={jobApplication.id}
                  onClick={(clickEvent) => openJobApplicationFromRow(clickEvent, jobApplication.id)}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50"
                >
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={jobApplicationRoute(jobApplication.id)}
                      className="inline-block min-w-40 hover:underline focus-visible:underline md:min-w-0"
                    >
                      {jobApplication.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{jobApplication.intermediaryName ?? EMPTY_CELL}</td>
                  <td className={cn('px-3 py-2', PHONE_HIDDEN_CELL_CLASS_NAME)}>{jobApplication.contactName ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">{jobApplication.endClientLabel ?? EMPTY_CELL}</td>
                  <td className={cn('px-3 py-2', PHONE_HIDDEN_CELL_CLASS_NAME)}>{jobApplication.source ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={jobApplication.status} />
                  </td>
                  <td className={cn('px-3 py-2 whitespace-nowrap', PHONE_HIDDEN_CELL_CLASS_NAME)}>
                    {formatInTimeZone(jobApplication.appliedOn, PARIS_TIME_ZONE, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <LastActivityCell jobApplication={jobApplication} now={now} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
