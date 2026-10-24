import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { JobApplicationHeader } from './job-application-header'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderJobApplicationHeader = (status: JobApplicationStatus) => {
  const changeJobApplicationStatus = jest.fn().mockResolvedValue({ ok: true, data: null })
  const addActivityLogEntry = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(
    <JobApplicationHeader
      jobApplication={{ id: 'application-1', status }}
      changeJobApplicationStatus={changeJobApplicationStatus}
      hasAnthropicApiKey
      addActivityLogEntry={addActivityLogEntry}
    />,
  )
  return { changeJobApplicationStatus }
}

describe('JobApplicationHeader', () => {
  it('shows the status pill and the pipeline step', () => {
    renderJobApplicationHeader('interview_scheduled')
    expect(screen.getByText('Entretien planifié', { selector: '[data-tone]' })).toHaveAttribute('data-tone', 'peach')
    expect(screen.getByText('étape 4 sur 7')).toBeInTheDocument()
  })

  it('shows no pipeline step for a KO status', () => {
    renderJobApplicationHeader('ko_cv')
    expect(screen.queryByText(/étape/)).not.toBeInTheDocument()
  })

  it('reveals the status controls behind Changer le statut', async () => {
    const user = userEvent.setup()
    renderJobApplicationHeader('interview_scheduled')
    const toggleButton = screen.getByRole('button', { name: 'Changer le statut' })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Passer à « Entretien passé »' })).not.toBeInTheDocument()
    await user.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Passer à « Entretien passé »' })).toBeVisible()
    expect(screen.getByRole('list', { name: 'Avancement de la candidature' })).toBeVisible()
  })

  it('changes the status from the Choisir un statut select', async () => {
    const user = userEvent.setup()
    const { changeJobApplicationStatus } = renderJobApplicationHeader('interview_scheduled')
    await user.click(screen.getByRole('button', { name: 'Changer le statut' }))
    await user.selectOptions(screen.getByLabelText('Choisir un statut'), 'signed')
    expect(changeJobApplicationStatus).toHaveBeenCalledWith('application-1', 'signed')
  })

  it('offers to draft a follow up right before Changer le statut for an active status', () => {
    renderJobApplicationHeader('cv_submitted')
    const draftButton = screen.getByRole('button', { name: 'Rédiger une relance' })
    const changeStatusButton = screen.getByRole('button', { name: 'Changer le statut' })
    expect(draftButton.compareDocumentPosition(changeStatusButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not offer to draft a follow up for a closed job application', () => {
    renderJobApplicationHeader('signed')
    expect(screen.queryByRole('button', { name: 'Rédiger une relance' })).not.toBeInTheDocument()
  })

  it('lays the header actions out in an even full-width grid on phone and a natural row from sm', () => {
    renderJobApplicationHeader('cv_submitted')
    const actionsContainer = screen.getByRole('button', { name: 'Rédiger une relance' }).parentElement
    expect(actionsContainer).toBe(screen.getByRole('button', { name: 'Changer le statut' }).parentElement)
    expect(actionsContainer).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]',
      'sm:ml-auto',
      'sm:flex',
      'sm:w-auto',
    )
  })
})
