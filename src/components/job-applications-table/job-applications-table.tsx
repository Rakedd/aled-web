'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ALL_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_LABELS,
  isTerminalStatus,
} from '@/domain/job-application-status'
import type { JobApplicationsSortKey } from '@/domain/job-applications-filters'
import { PARIS_TIME_ZONE, formatRelativeDaysAgo } from '@/domain/paris-time'
import { jobApplicationRoute } from '@/domain/routes'
import { useController } from './controller'
import type { JobApplicationsTableProps } from './interfaces'

const COLUMNS: { sortKey: JobApplicationsSortKey; label: string }[] = [
  { sortKey: 'title', label: 'Mission' },
  { sortKey: 'intermediaryName', label: 'Intermédiaire' },
  { sortKey: 'contactName', label: 'Contact' },
  { sortKey: 'endClientLabel', label: 'Client final' },
  { sortKey: 'source', label: 'Source' },
  { sortKey: 'status', label: 'Statut' },
  { sortKey: 'appliedOn', label: 'Candidature' },
  { sortKey: 'lastActivityAt', label: 'Dernier échange' },
]

const EMPTY_CELL = '—'

export const JobApplicationsTable = ({ jobApplications, now }: JobApplicationsTableProps) => {
  const router = useRouter()
  const {
    filters,
    sort,
    availableSources,
    visibleJobApplications,
    setSearchText,
    setShowTerminal,
    toggleStatus,
    toggleSource,
    toggleSort,
  } = useController({ jobApplications })

  const selectableStatuses = ALL_JOB_APPLICATION_STATUSES.filter((status) => filters.showTerminal || !isTerminalStatus(status))

  const openJobApplicationFromRow = (clickEvent: MouseEvent<HTMLTableRowElement>, jobApplicationId: string) => {
    if (clickEvent.target instanceof Element && clickEvent.target.closest('a')) return
    router.push(jobApplicationRoute(jobApplicationId))
  }

  const getAriaSort = (sortKey: JobApplicationsSortKey) =>
    sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
        <details className="rounded-lg border px-3 py-1.5 text-sm">
          <summary className="cursor-pointer select-none">Statut{filters.statuses.length > 0 && ` (${filters.statuses.length})`}</summary>
          <fieldset className="flex flex-col gap-1 py-2">
            <legend className="sr-only">Filtrer par statut</legend>
            {selectableStatuses.map((status) => (
              <label key={status} className="flex items-center gap-2">
                <input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => toggleStatus(status)} />
                {JOB_APPLICATION_STATUS_LABELS[status]}
              </label>
            ))}
          </fieldset>
        </details>
        {availableSources.length > 0 && (
          <details className="rounded-lg border px-3 py-1.5 text-sm">
            <summary className="cursor-pointer select-none">Source{filters.sources.length > 0 && ` (${filters.sources.length})`}</summary>
            <fieldset className="flex flex-col gap-1 py-2">
              <legend className="sr-only">Filtrer par source</legend>
              {availableSources.map((source) => (
                <label key={source} className="flex items-center gap-2">
                  <input type="checkbox" checked={filters.sources.includes(source)} onChange={() => toggleSource(source)} />
                  {source}
                </label>
              ))}
            </fieldset>
          </details>
        )}
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={filters.showTerminal} onChange={(changeEvent) => setShowTerminal(changeEvent.target.checked)} />
          Afficher les candidatures terminées
        </label>
      </div>
      {visibleJobApplications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune candidature ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {COLUMNS.map(({ sortKey, label }) => (
                  <th key={sortKey} scope="col" aria-sort={getAriaSort(sortKey)} className="px-3 py-2 font-medium whitespace-nowrap">
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
                    <Link href={jobApplicationRoute(jobApplication.id)} className="hover:underline focus-visible:underline">
                      {jobApplication.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{jobApplication.intermediaryName ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">{jobApplication.contactName ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">{jobApplication.endClientLabel ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">{jobApplication.source ?? EMPTY_CELL}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={jobApplication.status} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatInTimeZone(jobApplication.appliedOn, PARIS_TIME_ZONE, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {jobApplication.lastActivityAt ? formatRelativeDaysAgo(jobApplication.lastActivityAt, now) : EMPTY_CELL}
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
