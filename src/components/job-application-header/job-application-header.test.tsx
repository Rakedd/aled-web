import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { JobApplicationHeader } from './job-application-header'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderJobApplicationHeader = (status: JobApplicationStatus) => {
  const changeJobApplicationStatus = jest.fn().mockResolvedValue({ ok: true, data: null })
  render(
    <JobApplicationHeader
      jobApplication={{ id: 'application-1', status }}
      changeJobApplicationStatus={changeJobApplicationStatus}
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
})
