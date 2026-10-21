import { useState } from 'react'
import { CONTACTS_ROUTE, CONTACTS_VIEW_SEARCH_PARAMETER, INTERMEDIARIES_VIEW } from '@/domain/routes'
import type { ContactsViewName } from './interfaces'

const toViewRoute = (view: ContactsViewName): string =>
  view === 'agences' ? `${CONTACTS_ROUTE}?${CONTACTS_VIEW_SEARCH_PARAMETER}=${INTERMEDIARIES_VIEW}` : CONTACTS_ROUTE

export const useController = ({ navigateTo }: { navigateTo: (path: string) => void }) => {
  const [isNewContactFormOpen, setIsNewContactFormOpen] = useState(false)

  const selectView = (view: ContactsViewName) => navigateTo(toViewRoute(view))

  const toggleNewContactForm = () => setIsNewContactFormOpen((currentIsOpen) => !currentIsOpen)

  return { isNewContactFormOpen, selectView, toggleNewContactForm }
}
