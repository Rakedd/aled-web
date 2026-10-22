'use client'

import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { useState } from 'react'
import { NewContactForm } from '@/components/new-contact-form'
import { Button } from '@/components/ui/button'
import { toPhoneHref } from '@/domain/job-application-display'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { contactRoute } from '@/domain/routes'
import type { IntermediaryContactsListProps } from './interfaces'

const NEW_CONTACT_FORM_ID = 'intermediary-new-contact-form'

export const IntermediaryContactsList = ({
  contacts,
  intermediaryName,
  createContact,
  searchEntities,
}: IntermediaryContactsListProps) => {
  const [isNewContactFormOpen, setIsNewContactFormOpen] = useState(false)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun contact dans cette agence pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <Link href={contactRoute(contact.id)} className="font-medium hover:underline focus-visible:underline">
                {contact.fullName}
              </Link>
              <span className="flex flex-wrap items-baseline gap-x-4 text-muted-foreground">
                {contact.phone !== null && (
                  <a href={toPhoneHref(contact.phone)} className="hover:underline focus-visible:underline">
                    {contact.phone}
                  </a>
                )}
                <span>
                  {contact.lastExchangeAt === null
                    ? 'Aucun échange'
                    : `Dernier échange le ${formatInTimeZone(contact.lastExchangeAt, PARIS_TIME_ZONE, 'dd/MM/yyyy')}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        aria-expanded={isNewContactFormOpen}
        aria-controls={NEW_CONTACT_FORM_ID}
        onClick={() => setIsNewContactFormOpen((isOpen) => !isOpen)}
      >
        Ajouter un contact
      </Button>
      {isNewContactFormOpen && (
        <div id={NEW_CONTACT_FORM_ID}>
          <NewContactForm
            createContact={createContact}
            searchEntities={searchEntities}
            initialIntermediaryName={intermediaryName}
          />
        </div>
      )}
    </div>
  )
}
