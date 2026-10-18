import { render, screen } from '@testing-library/react'
import type { Interview } from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { JobApplicationSummary } from './job-application-summary'

const NOW = new Date('2026-10-19T10:00:00Z')

const buildInterview = (id: string, startsAt: string, overrides: Partial<Interview> = {}): Interview => ({
  id,
  jobApplicationId: 'application-1',
  startsAt: new Date(startsAt),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
  ...overrides,
})

const renderSummary = ({
  jobApplication = buildJobApplicationOverview(),
  interviews = [],
}: {
  jobApplication?: ReturnType<typeof buildJobApplicationOverview>
  interviews?: Interview[]
} = {}) => render(<JobApplicationSummary jobApplication={jobApplication} interviews={interviews} now={NOW} />)

describe('JobApplicationSummary', () => {
  it('shows the title, the end client and the intermediary with its kind', () => {
    renderSummary()
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React' })).toBeInTheDocument()
    expect(screen.getByText('Société Générale (Groupe SG)')).toBeInTheDocument()
    expect(screen.getByText('via Free-Work (Plateforme)')).toBeInTheDocument()
  })

  it('shows the source, the Paris application date and the relative last exchange', () => {
    renderSummary({
      jobApplication: buildJobApplicationOverview({
        appliedOn: new Date('2026-10-16T22:30:00Z'),
        lastActivityAt: new Date('2026-10-16T10:00:00Z'),
      }),
    })
    expect(screen.getByText('Source').nextSibling).toHaveTextContent('Free-Work')
    expect(screen.getByText('Candidature du').nextSibling).toHaveTextContent('17/10/2026')
    expect(screen.getByText('Dernier échange').nextSibling).toHaveTextContent('il y a 3 j')
  })

  it('shows Client inconnu without an end client and a dash for empty fields', () => {
    renderSummary({
      jobApplication: buildJobApplicationOverview({
        endClientLabel: null,
        source: null,
        intermediaryName: null,
        intermediaryKind: null,
      }),
    })
    expect(screen.getByText('Client inconnu')).toBeInTheDocument()
    expect(screen.getByText('Source').nextSibling).toHaveTextContent('—')
    expect(screen.getByText('Dernier échange').nextSibling).toHaveTextContent('—')
    expect(screen.queryByText(/^via /)).not.toBeInTheDocument()
  })

  it('opens the posting in a new tab without giving it access to the page', () => {
    renderSummary({ jobApplication: buildJobApplicationOverview({ postingUrl: 'https://www.free-work.com/fr/job/123' }) })
    const postingLink = screen.getByRole('link', { name: "Voir l'annonce" })
    expect(postingLink).toHaveAttribute('href', 'https://www.free-work.com/fr/job/123')
    expect(postingLink).toHaveAttribute('target', '_blank')
    expect(postingLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each(['javascript:alert(1)', 'pas une adresse'])('shows no posting link for %s', (postingUrl) => {
    renderSummary({ jobApplication: buildJobApplicationOverview({ postingUrl }) })
    expect(screen.queryByRole('link', { name: "Voir l'annonce" })).not.toBeInTheDocument()
  })

  it('shows the closest upcoming interview and ignores past ones', () => {
    renderSummary({
      interviews: [
        buildInterview('far', '2026-11-02T09:00:00Z', { kind: 'mock' }),
        buildInterview('past', '2026-10-18T09:00:00Z'),
        buildInterview('closest', '2026-10-20T09:00:00Z', { format: 'onsite' }),
      ],
    })
    expect(screen.getByText('Prochain entretien').nextSibling).toHaveTextContent(
      `${formatParisInterviewDateTime(new Date('2026-10-20T09:00:00Z'))} · Entretien client · Sur site`,
    )
  })

  it('shows no upcoming interview when they are all past', () => {
    renderSummary({ interviews: [buildInterview('past', '2026-10-18T09:00:00Z')] })
    expect(screen.queryByText('Prochain entretien')).not.toBeInTheDocument()
  })
})
