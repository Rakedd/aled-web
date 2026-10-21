import type { SearchEntities } from '@/components/entity-autocomplete/interfaces'
import type { CreateContact } from '@/components/new-contact-form/interfaces'
import type { ContactListItem } from '@/domain/contacts'

export type IntermediaryContactsListProps = {
  contacts: ContactListItem[]
  intermediaryName: string
  createContact: CreateContact
  searchEntities: SearchEntities
}
