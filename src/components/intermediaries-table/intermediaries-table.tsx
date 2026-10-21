'use client'

import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntermediariesSortKey } from '@/domain/contact-search'
import { INTERMEDIARY_KIND_LABELS } from '@/domain/entities'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { intermediaryRoute } from '@/domain/routes'
import { useController } from './controller'
import type { IntermediariesTableProps } from './interfaces'

const COLUMNS: { sortKey: IntermediariesSortKey | null; label: string }[] = [
  { sortKey: 'name', label: 'Nom' },
  { sortKey: null, label: 'Type' },
  { sortKey: 'contactCount', label: 'Contacts' },
  { sortKey: 'proposedMissionCount', label: 'Missions' },
  { sortKey: 'lastExchangeAt', label: 'Dernier échange' },
]

const EMPTY_CELL = '—'

export const IntermediariesTable = ({ intermediaries }: IntermediariesTableProps) => {
  const { query, setQuery, sort, toggleSort, visibleIntermediaries } = useController({ intermediaries })

  if (intermediaries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune agence pour l&apos;instant. Elles apparaissent avec tes contacts et tes candidatures.
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex w-full flex-col gap-2 sm:w-72">
        <Label htmlFor="intermediaries-search">Rechercher</Label>
        <Input
          id="intermediaries-search"
          type="search"
          placeholder="Nom de l'agence…"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
        />
      </div>
      {visibleIntermediaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune agence ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted">
              <tr>
                {COLUMNS.map(({ sortKey, label }) =>
                  sortKey === null ? (
                    <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                      {label}
                    </th>
                  ) : (
                    <th
                      key={label}
                      scope="col"
                      aria-sort={sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 hover:underline">
                        {label}
                        {sort.key === sortKey && <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visibleIntermediaries.map((intermediary) => (
                <tr key={intermediary.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium">
                    <Link href={intermediaryRoute(intermediary.id)} className="hover:underline focus-visible:underline">
                      {intermediary.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{intermediary.kind === null ? EMPTY_CELL : INTERMEDIARY_KIND_LABELS[intermediary.kind]}</td>
                  <td className="px-3 py-2">{intermediary.contactCount}</td>
                  <td className="px-3 py-2">{intermediary.proposedMissionCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {intermediary.lastExchangeAt === null
                      ? EMPTY_CELL
                      : formatInTimeZone(intermediary.lastExchangeAt, PARIS_TIME_ZONE, 'dd/MM/yyyy')}
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
