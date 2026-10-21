import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContactListItem } from '@/domain/contacts'
import { IntermediaryContactsList } from './intermediary-contacts-list'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const buildContact = (overrides: Partial<ContactListItem>): ContactListItem => ({
  id: 'contact-1',
  fullName: 'Jeanne Martin',
  intermediaryId: 'agency-1',
  intermediaryName: 'Free-Work',
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
  ...overrides,
})

const renderList = (contacts: ContactListItem[]) =>
  render(
    <IntermediaryContactsList
      contacts={contacts}
      intermediaryName="Free-Work"
      createContact={jest.fn()}
      searchEntities={jest.fn().mockResolvedValue({ ok: true, data: [] })}
    />,
  )

describe('IntermediaryContactsList', () => {
  it('lists contacts first with phone and last exchange', () => {
    renderList([
      buildContact({ phone: '06 12 34 56 78', lastExchangeAt: new Date('2026-10-10T10:00:00Z') }),
      buildContact({ id: 'contact-2', fullName: 'Paul Durand' }),
    ])
    expect(screen.getByRole('link', { name: 'Jeanne Martin' })).toHaveAttribute('href', '/contacts/contact-1')
    expect(screen.getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:0612345678')
    expect(screen.getByText('Dernier échange le 10/10/2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Paul Durand' })).toBeInTheDocument()
  })

  it('says there is no contact yet', () => {
    renderList([])
    expect(screen.getByText("Aucun contact dans cette agence pour l'instant.")).toBeInTheDocument()
  })

  it('opens the new contact form with the agency prefilled', async () => {
    renderList([])
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un contact' }))
    expect(screen.getByLabelText('Agence')).toHaveValue('Free-Work')
  })
})
