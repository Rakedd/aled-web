import type { Metadata } from 'next'
import { ContactsView } from '@/components/contacts-view'
import { CONTACTS_VIEW_SEARCH_PARAMETER, INTERMEDIARIES_VIEW } from '@/domain/routes'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { createContact, listContacts, listIntermediaries } from '@/server/actions/contact-actions'
import { searchEntities } from '@/server/actions/entity-actions'

export const metadata: Metadata = { title: 'Mes contacts · Aled' }

const ContactsPage = async ({ searchParams }: PageProps<'/contacts'>) => {
  const selectedView = (await searchParams)[CONTACTS_VIEW_SEARCH_PARAMETER] === INTERMEDIARIES_VIEW ? 'agences' : 'contacts'
  const [contactsResult, intermediariesResult] = await Promise.all([listContacts(), listIntermediaries()])

  const header = <h1 className={PAGE_TITLE_CLASS_NAME}>Mes contacts</h1>

  if (!contactsResult.ok || !intermediariesResult.ok) {
    const errorMessage = !contactsResult.ok ? contactsResult.errorMessage : !intermediariesResult.ok ? intermediariesResult.errorMessage : ''
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {header}
      <ContactsView
        selectedView={selectedView}
        contacts={contactsResult.data}
        intermediaries={intermediariesResult.data}
        createContact={createContact}
        searchEntities={searchEntities}
      />
    </div>
  )
}

export default ContactsPage
