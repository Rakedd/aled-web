import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewContactForm } from './new-contact-form'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

describe('NewContactForm', () => {
  it('creates the contact and opens its page', async () => {
    const createContact = jest.fn().mockResolvedValue({ ok: true, data: { id: 'contact-9' } })
    const searchEntities = jest.fn().mockResolvedValue({ ok: true, data: [] })
    render(<NewContactForm createContact={createContact} searchEntities={searchEntities} />)
    await userEvent.type(screen.getByLabelText('Nom *'), 'Jeanne Martin')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }))
    expect(mockPush).toHaveBeenCalledWith('/contacts/contact-9')
  })

  it('shows the error returned by the action', async () => {
    const createContact = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Un autre contact porte déjà ce nom' })
    const searchEntities = jest.fn().mockResolvedValue({ ok: true, data: [] })
    render(<NewContactForm createContact={createContact} searchEntities={searchEntities} />)
    await userEvent.type(screen.getByLabelText('Nom *'), 'Jeanne Martin')
    await userEvent.click(screen.getByRole('button', { name: 'Créer le contact' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Un autre contact porte déjà ce nom')
  })
})
