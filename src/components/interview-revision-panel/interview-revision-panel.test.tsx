import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InterviewRevisionPanel } from './interview-revision-panel'
import type { InterviewRevisionPanelContent } from './interfaces'

const content: InterviewRevisionPanelContent = {
  jobApplicationTitle: 'Développeur React senior',
  endClientLabel: 'Acme',
  startsAtLabel: 'mer. 28/10 · 14h00',
  kindLabel: 'Entretien client',
  formatLabel: 'Visio',
  stackGroups: [{ categoryLabel: 'Framework', stackItemNames: ['React'] }],
  jobApplicationHref: '/candidatures/abc',
}

describe('InterviewRevisionPanel', () => {
  it('renders nothing when there is no content', () => {
    render(<InterviewRevisionPanel content={null} onClose={jest.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a labelled dialog with the mission and its stack, and links to the application', () => {
    render(<InterviewRevisionPanel content={content} onClose={jest.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Développeur React senior' })).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir la candidature' })).toHaveAttribute('href', '/candidatures/abc')
  })

  it('closes on Escape', async () => {
    const onClose = jest.fn()
    render(<InterviewRevisionPanel content={content} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
