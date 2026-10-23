import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfessionalStatusCard } from './professional-status-card'

describe('ProfessionalStatusCard', () => {
  it('asks the question with one button per status', () => {
    render(<ProfessionalStatusCard saveProfessionalStatus={jest.fn()} answeredFocusTargetId="home-title" />)

    expect(screen.getByText('Tu es…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Freelance' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'CDI' })).toBeEnabled()
  })

  it('saves the choice and disappears', async () => {
    const saveProfessionalStatus = jest.fn().mockResolvedValue({ ok: true, data: null })
    render(<ProfessionalStatusCard saveProfessionalStatus={saveProfessionalStatus} answeredFocusTargetId="home-title" />)

    await userEvent.click(screen.getByRole('button', { name: 'CDI' }))

    expect(saveProfessionalStatus).toHaveBeenCalledWith('employee')
    expect(screen.queryByText('Tu es…')).not.toBeInTheDocument()
  })

  it('moves focus to the focus target once the choice is saved', async () => {
    render(
      <>
        <ProfessionalStatusCard
          saveProfessionalStatus={jest.fn().mockResolvedValue({ ok: true, data: null })}
          answeredFocusTargetId="home-title"
        />
        <h1 id="home-title" tabIndex={-1}>
          Bonjour
        </h1>
      </>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Freelance' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour' })).toHaveFocus()
  })

  it('stays and shows the server error when the save fails', async () => {
    const saveProfessionalStatus = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Service indisponible' })
    render(<ProfessionalStatusCard saveProfessionalStatus={saveProfessionalStatus} answeredFocusTargetId="home-title" />)

    await userEvent.click(screen.getByRole('button', { name: 'Freelance' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Service indisponible')
    expect(screen.getByRole('button', { name: 'Freelance' })).toBeEnabled()
  })

  it('shows the generic error when the action throws', async () => {
    const saveProfessionalStatus = jest.fn().mockRejectedValue(new Error('Network down'))
    render(<ProfessionalStatusCard saveProfessionalStatus={saveProfessionalStatus} answeredFocusTargetId="home-title" />)

    await userEvent.click(screen.getByRole('button', { name: 'Freelance' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue, réessaie.')
  })

  it('sends a single request on a double click', async () => {
    const saveProfessionalStatus = jest.fn().mockReturnValue(new Promise(() => undefined))
    render(<ProfessionalStatusCard saveProfessionalStatus={saveProfessionalStatus} answeredFocusTargetId="home-title" />)

    await userEvent.dblClick(screen.getByRole('button', { name: 'Freelance' }))

    expect(saveProfessionalStatus).toHaveBeenCalledTimes(1)
  })
})
