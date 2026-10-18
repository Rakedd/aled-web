import { render, screen } from '@testing-library/react'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { HeaderView } from './header-view'

const NOW = new Date('2026-10-19T10:00:00Z')

const renderHeaderView = (jobApplication: JobApplicationOverview = buildJobApplicationOverview()) =>
  render(<HeaderView jobApplication={jobApplication} now={NOW} />)

describe('HeaderView', () => {
  it('shows the end client and the intermediary with its kind', () => {
    renderHeaderView()
    expect(screen.getByText('Société Générale (Groupe SG)')).toBeInTheDocument()
    expect(screen.getByText('via Free-Work (Plateforme)')).toBeInTheDocument()
  })

  it('shows the source, the Paris application date and the relative last exchange', () => {
    renderHeaderView(
      buildJobApplicationOverview({
        appliedOn: new Date('2026-10-16T22:30:00Z'),
        lastActivityAt: new Date('2026-10-16T10:00:00Z'),
      }),
    )
    expect(screen.getByText('Source').nextSibling).toHaveTextContent('Free-Work')
    expect(screen.getByText('Candidature du').nextSibling).toHaveTextContent('17/10/2026')
    expect(screen.getByText('Dernier échange').nextSibling).toHaveTextContent('il y a 3 j')
  })

  it('shows Client inconnu without an end client and a dash for empty fields', () => {
    renderHeaderView(
      buildJobApplicationOverview({ endClientLabel: null, source: null, intermediaryName: null, intermediaryKind: null }),
    )
    expect(screen.getByText('Client inconnu')).toBeInTheDocument()
    expect(screen.getByText('Source').nextSibling).toHaveTextContent('—')
    expect(screen.getByText('Dernier échange').nextSibling).toHaveTextContent('—')
    expect(screen.queryByText(/^via /)).not.toBeInTheDocument()
  })

  it('opens the posting in a new tab without giving it access to the page', () => {
    renderHeaderView(buildJobApplicationOverview({ postingUrl: 'https://www.free-work.com/fr/job/123' }))
    const postingLink = screen.getByRole('link', { name: "Voir l'annonce" })
    expect(postingLink).toHaveAttribute('href', 'https://www.free-work.com/fr/job/123')
    expect(postingLink).toHaveAttribute('target', '_blank')
    expect(postingLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each(['javascript:alert(1)', 'pas une adresse'])('shows no posting link for %s', (postingUrl) => {
    renderHeaderView(buildJobApplicationOverview({ postingUrl }))
    expect(screen.queryByRole('link', { name: "Voir l'annonce" })).not.toBeInTheDocument()
  })
})
