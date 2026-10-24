import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewPasswordForm } from './new-password-form'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const succeed = () => jest.fn().mockResolvedValue({ ok: true, data: null })

const renderForm = (updatePassword = succeed()) => {
  const user = userEvent.setup()
  render(<NewPasswordForm updatePassword={updatePassword} />)
  return user
}

const fillPasswords = async (user: ReturnType<typeof userEvent.setup>, password: string, confirmation: string) => {
  await user.type(screen.getByLabelText('Nouveau mot de passe'), password)
  await user.type(screen.getByLabelText('Confirme-le'), confirmation)
}

beforeEach(() => {
  mockPush.mockReset()
})

describe('NewPasswordForm', () => {
  it('posts the new password so it never lands in the URL before hydration', () => {
    renderForm()

    expect(screen.getByLabelText('Nouveau mot de passe').closest('form')).toHaveAttribute('method', 'post')
  })

  it('renders both fields as new-password inputs and the save button', () => {
    renderForm()

    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirme-le')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('shows and hides both passwords with one toggle', async () => {
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Confirme-le')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('type', 'password')
  })

  it('saves and goes home with the password-updated flag on success', async () => {
    const updatePassword = succeed()
    const user = renderForm(updatePassword)

    await fillPasswords(user, 'long-enough-password', 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updatePassword).toHaveBeenCalledWith('long-enough-password', 'long-enough-password')
    expect(mockPush).toHaveBeenCalledWith('/?mot-de-passe=modifie')
  })

  it('refuses a too short password without calling the action and focuses the alert', async () => {
    const updatePassword = succeed()
    const user = renderForm(updatePassword)

    await fillPasswords(user, 'short', 'short')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updatePassword).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('refuses mismatching passwords without calling the action', async () => {
    const updatePassword = succeed()
    const user = renderForm(updatePassword)

    await fillPasswords(user, 'long-enough-password', 'another-long-password')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updatePassword).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirme-le')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the server error, focuses it and does not navigate', async () => {
    const updatePassword = jest.fn().mockResolvedValue({ ok: false, errorMessage: "Choisis un mot de passe différent de l'actuel." })
    const user = renderForm(updatePassword)

    await fillPasswords(user, 'long-enough-password', 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Choisis un mot de passe différent de l'actuel.")
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the generic error when the action throws', async () => {
    const user = renderForm(jest.fn().mockRejectedValue(new Error('network')))

    await fillPasswords(user, 'long-enough-password', 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sends only one request on a double submit', async () => {
    const updatePassword = jest.fn().mockReturnValue(new Promise(() => undefined))
    const user = renderForm(updatePassword)

    await fillPasswords(user, 'long-enough-password', 'long-enough-password')
    await user.type(screen.getByLabelText('Confirme-le'), '{Enter}{Enter}')

    expect(updatePassword).toHaveBeenCalledTimes(1)
  })
})
