import type { ContactListItem, IntermediaryListItem } from '@/domain/contacts'
import type { CreateContact } from '@/components/new-contact-form/interfaces'
import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'

export type ContactsViewName = 'contacts' | 'agences'

export type ContactsViewProps = {
  selectedView: ContactsViewName
  contacts: ContactListItem[]
  intermediaries: IntermediaryListItem[]
  createContact: CreateContact
  searchEntities: SearchEntities
}
