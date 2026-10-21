import { useState } from 'react'
import {
  type ContactsSortKey,
  filterContacts,
  INITIAL_CONTACTS_SORT,
  type ListSort,
  sortContacts,
  toggleListSort,
} from '@/domain/contact-search'
import type { ContactsTableProps } from './interfaces'

export const useController = ({ contacts }: ContactsTableProps) => {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ListSort<ContactsSortKey>>(INITIAL_CONTACTS_SORT)

  const visibleContacts = sortContacts(filterContacts(contacts, query), sort)

  const toggleSort = (clickedKey: ContactsSortKey) =>
    setSort((currentSort) => toggleListSort(currentSort, clickedKey))

  return { query, setQuery, sort, toggleSort, visibleContacts }
}
