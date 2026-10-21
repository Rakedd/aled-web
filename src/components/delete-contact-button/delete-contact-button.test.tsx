import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteContactButton } from './delete-contact-button'

const mockedReplace = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockedReplace }) }))

const CONTACT_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const renderButton = () => {
  const deleteContact = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(<DeleteContactButton contactId={CONTACT_ID} deleteContact={deleteContact} />)
  return { deleteContact }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DeleteContactButton', () => {
  it('explains that exchanges without job application are deleted and the others are kept', async () => {
    const { deleteContact } = renderButton()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le contact' }))
    const confirmation = await screen.findByRole('alertdialog', { name: 'Supprimer définitivement ce contact ?' })
    expect(confirmation).toHaveAccessibleDescription(
      'Ses échanges sans candidature seront supprimés. Ceux liés à une candidature restent dans le journal de la candidature.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(deleteContact).not.toHaveBeenCalled()
  })

  it('deletes the contact and goes back to the contacts list', async () => {
    const { deleteContact } = renderButton()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le contact' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(deleteContact).toHaveBeenCalledWith(CONTACT_ID)
    expect(mockedReplace).toHaveBeenCalledWith('/contacts')
  })

  it('shows the error and stays when the deletion fails', async () => {
    const deleteContact = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Contact introuvable' })
    render(<DeleteContactButton contactId={CONTACT_ID} deleteContact={deleteContact} />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le contact' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Contact introuvable')
    expect(mockedReplace).not.toHaveBeenCalled()
  })
})
