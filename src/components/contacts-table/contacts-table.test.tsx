import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContactListItem } from '@/domain/contacts'
import { ContactsTable } from './contacts-table'

const buildContact = (overrides: Partial<ContactListItem>): ContactListItem => ({
  id: 'contact-1',
  fullName: 'Jeanne Martin',
  intermediaryId: null,
  intermediaryName: null,
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
  ...overrides,
})

describe('ContactsTable', () => {
  it('shows a dash and zero for a contact without exchange nor mission', () => {
    render(<ContactsTable contacts={[buildContact({})]} />)
    const row = screen.getByRole('row', { name: /Jeanne Martin/ })
    const cells = within(row).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual(['Jeanne Martin', '—', '—', '—', '—', '0'])
  })

  it('links the name to the contact page and the agency to the agency page', () => {
    render(
      <ContactsTable
        contacts={[
          buildContact({
            intermediaryId: 'agency-1',
            intermediaryName: 'Free-Work',
            phone: '06 12 34 56 78',
            lastExchangeAt: new Date('2026-10-10T10:00:00Z'),
            proposedMissionCount: 2,
          }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Jeanne Martin' })).toHaveAttribute('href', '/contacts/contact-1')
    expect(screen.getByRole('link', { name: 'Free-Work' })).toHaveAttribute('href', '/agences/agency-1')
    expect(screen.getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:0612345678')
    expect(screen.getByText('10/10/2026')).toBeInTheDocument()
  })

  it('explains how to add contacts when the list is empty', () => {
    render(<ContactsTable contacts={[]} />)
    expect(screen.getByText("Aucun contact pour l'instant. Ajoute-en un ici ou depuis une candidature.")).toBeInTheDocument()
  })

  it('tells when no contact matches the search', async () => {
    render(<ContactsTable contacts={[buildContact({})]} />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'zzz')
    expect(screen.getByText('Aucun contact ne correspond.')).toBeInTheDocument()
  })

  it('reorders the rows when a sortable header is clicked', async () => {
    render(
      <ContactsTable
        contacts={[buildContact({ id: 'b', fullName: 'Bob' }), buildContact({ id: 'a', fullName: 'Alice' })]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nom' }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Alice')
    expect(screen.getByRole('columnheader', { name: /Nom/ })).toHaveAttribute('aria-sort', 'ascending')
  })
})
