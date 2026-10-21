'use client'

import { useRouter } from 'next/navigation'
import { ContactsTable } from '@/components/contacts-table'
import { IntermediariesTable } from '@/components/intermediaries-table'
import { NewContactForm } from '@/components/new-contact-form'
import { PillTabs } from '@/components/pill-tabs'
import { Button } from '@/components/ui/button'
import { useController } from './controller'
import type { ContactsViewName, ContactsViewProps } from './interfaces'

const NEW_CONTACT_FORM_ID = 'new-contact-form-panel'
const CONTACTS_PANEL_ID = 'contacts-view-panel'

const VIEW_TABS = [
  { key: 'contacts' as const, label: 'Contacts', tabId: 'contacts-view-tab-contacts', panelId: CONTACTS_PANEL_ID },
  { key: 'agences' as const, label: 'Agences', tabId: 'contacts-view-tab-agences', panelId: CONTACTS_PANEL_ID },
]

export const ContactsView = ({ selectedView, contacts, intermediaries, createContact, searchEntities }: ContactsViewProps) => {
  const router = useRouter()
  const { isNewContactFormOpen, selectView, toggleNewContactForm } = useController({ navigateTo: router.push })

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs<ContactsViewName>
          label="Vue des contacts"
          tabs={VIEW_TABS}
          selectedTab={selectedView}
          onSelect={selectView}
        />
        <Button type="button" aria-expanded={isNewContactFormOpen} aria-controls={NEW_CONTACT_FORM_ID} onClick={toggleNewContactForm}>
          + Nouveau contact
        </Button>
      </div>
      {isNewContactFormOpen && (
        <div id={NEW_CONTACT_FORM_ID}>
          <NewContactForm createContact={createContact} searchEntities={searchEntities} />
        </div>
      )}
      <div
        role="tabpanel"
        id={CONTACTS_PANEL_ID}
        aria-labelledby={selectedView === 'agences' ? 'contacts-view-tab-agences' : 'contacts-view-tab-contacts'}
        className="min-w-0"
      >
        {selectedView === 'agences' ? <IntermediariesTable intermediaries={intermediaries} /> : <ContactsTable contacts={contacts} />}
      </div>
    </div>
  )
}
