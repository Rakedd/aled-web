'use client'

import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Input } from '@/components/ui/input'
import { LinkedinLink } from '@/components/linkedin-link'
import { Label } from '@/components/ui/label'
import { isExternalLinkUrl } from '@/domain/client-brief'
import type { ContactsSortKey } from '@/domain/contact-search'
import { toPhoneHref } from '@/domain/job-application-display'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { contactRoute, intermediaryRoute } from '@/domain/routes'
import { useController } from './controller'
import type { ContactsTableProps } from './interfaces'

const SORTABLE_COLUMNS: { sortKey: ContactsSortKey; label: string }[] = [
  { sortKey: 'fullName', label: 'Nom' },
  { sortKey: 'intermediaryName', label: 'Agence' },
]

const EMPTY_CELL = '—'

export const ContactsTable = ({ contacts }: ContactsTableProps) => {
  const { query, setQuery, sort, toggleSort, visibleContacts } = useController({ contacts })

  const getAriaSort = (sortKey: ContactsSortKey) =>
    sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  const renderSortableHeader = (sortKey: ContactsSortKey, label: string) => (
    <th key={sortKey} scope="col" aria-sort={getAriaSort(sortKey)} className="px-3 py-2 font-medium whitespace-nowrap">
      <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {sort.key === sortKey && <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun contact pour l&apos;instant. Ajoute-en un ici ou depuis une candidature.
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex w-full flex-col gap-2 sm:w-72">
        <Label htmlFor="contacts-search">Rechercher</Label>
        <Input
          id="contacts-search"
          type="search"
          placeholder="Nom, agence, téléphone…"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
        />
      </div>
      {visibleContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun contact ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b bg-muted">
              <tr>
                {SORTABLE_COLUMNS.map(({ sortKey, label }) => renderSortableHeader(sortKey, label))}
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  Téléphone
                </th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  LinkedIn
                </th>
                {renderSortableHeader('lastExchangeAt', 'Dernier échange')}
                {renderSortableHeader('proposedMissionCount', 'Missions')}
              </tr>
            </thead>
            <tbody>
              {visibleContacts.map((contact) => (
                <tr key={contact.id} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium">
                    <Link href={contactRoute(contact.id)} className="hover:underline focus-visible:underline">
                      {contact.fullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {contact.intermediaryId !== null && contact.intermediaryName !== null ? (
                      <Link href={intermediaryRoute(contact.intermediaryId)} className="hover:underline focus-visible:underline">
                        {contact.intermediaryName}
                      </Link>
                    ) : (
                      EMPTY_CELL
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {contact.phone === null ? (
                      EMPTY_CELL
                    ) : (
                      <a href={toPhoneHref(contact.phone)} className="hover:underline focus-visible:underline">
                        {contact.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {contact.linkedinUrl === null || !isExternalLinkUrl(contact.linkedinUrl) ? (
                      EMPTY_CELL
                    ) : (
                      <LinkedinLink url={contact.linkedinUrl} label={`Profil LinkedIn de ${contact.fullName}`} isCompact />
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {contact.lastExchangeAt === null
                      ? EMPTY_CELL
                      : formatInTimeZone(contact.lastExchangeAt, PARIS_TIME_ZONE, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 py-2">{contact.proposedMissionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
