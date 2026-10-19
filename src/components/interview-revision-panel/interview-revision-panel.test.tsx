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
  missionDetails: [
    { label: 'Lieu', value: 'Paris' },
    { label: 'TJM annoncé', value: '650\u00a0€' },
  ],
  postingRawText: 'Mission React pour une foncière',
  jobApplicationHref: '/candidatures/a1',
  briefHref: '/candidatures/a1?onglet=entretiens',
}

describe('InterviewRevisionPanel', () => {
  it('renders nothing when there is no content', () => {
    render(<InterviewRevisionPanel content={null} onClose={jest.fn()} />)

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('renders a complementary named by the mission title, with its stack and links', () => {
    render(<InterviewRevisionPanel content={content} onClose={jest.fn()} />)

    expect(screen.getByRole('complementary', { name: 'Développeur React senior' })).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir la fiche' })).toHaveAttribute('href', '/candidatures/a1')
    expect(screen.getByRole('link', { name: 'Voir mon brief' })).toHaveAttribute(
      'href',
      '/candidatures/a1?onglet=entretiens',
    )
    expect(screen.getByText('React')).toHaveAttribute('data-tone', 'sage')
  })

  it('describes the mission with its details and the original posting in a collapsible block', async () => {
    render(<InterviewRevisionPanel content={content} onClose={jest.fn()} />)

    const missionSection = screen.getByRole('region', { name: 'Mission' })
    expect(missionSection).toHaveTextContent('Lieu')
    expect(missionSection).toHaveTextContent('Paris')
    expect(missionSection).toHaveTextContent('TJM annoncé')
    expect(missionSection).toHaveTextContent('650 €')
    const postingText = screen.getByText('Mission React pour une foncière')
    expect(postingText).not.toBeVisible()

    await userEvent.click(screen.getByText("Texte original de l'annonce"))

    expect(postingText).toBeVisible()
  })

  it('says when the mission has no details and hides the posting block without original text', () => {
    render(
      <InterviewRevisionPanel content={{ ...content, missionDetails: [], postingRawText: null }} onClose={jest.fn()} />,
    )

    expect(screen.getByText('Aucun détail renseigné pour cette mission.')).toBeInTheDocument()
    expect(screen.queryByText("Texte original de l'annonce")).not.toBeInTheDocument()
  })

  it('moves focus to its title when it opens', () => {
    render(<InterviewRevisionPanel content={content} onClose={jest.fn()} />)

    expect(screen.getByRole('heading', { name: 'Développeur React senior' })).toHaveFocus()
  })

  it('closes with the Fermer button', async () => {
    const onClose = jest.fn()
    render(<InterviewRevisionPanel content={content} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const onClose = jest.fn()
    render(<InterviewRevisionPanel content={content} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
