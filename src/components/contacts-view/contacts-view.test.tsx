import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactsView } from './contacts-view'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const renderContactsView = (selectedView: 'contacts' | 'agences') =>
  render(
    <ContactsView
      selectedView={selectedView}
      contacts={[]}
      intermediaries={[]}
      createContact={jest.fn()}
      searchEntities={jest.fn()}
    />,
  )

describe('ContactsView', () => {
  it('shows the contacts table on the contacts tab', () => {
    renderContactsView('contacts')
    expect(screen.getByRole('tab', { name: 'Contacts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Aucun contact pour l'instant/)).toBeInTheDocument()
  })

  it('shows the agencies table on the agencies tab', () => {
    renderContactsView('agences')
    expect(screen.getByRole('tab', { name: 'Agences' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Aucune agence pour l'instant/)).toBeInTheDocument()
  })

  it('puts the selected tab in the URL', async () => {
    renderContactsView('contacts')
    await userEvent.click(screen.getByRole('tab', { name: 'Agences' }))
    expect(mockPush).toHaveBeenCalledWith('/contacts?vue=agences')
  })

  it('opens and closes the new contact form', async () => {
    renderContactsView('contacts')
    const toggleButton = screen.getByRole('button', { name: '+ Nouveau contact' })
    await userEvent.click(toggleButton)
    expect(screen.getByLabelText('Nom *')).toBeInTheDocument()
    await userEvent.click(toggleButton)
    expect(screen.queryByLabelText('Nom *')).not.toBeInTheDocument()
  })
})
