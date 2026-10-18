import { render, screen } from '@testing-library/react'
import type { Interview } from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
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

const renderSummary = (interviews: Interview[] = []) =>
  render(<JobApplicationSummary title="Développeur React" interviews={interviews} now={NOW} />)

describe('JobApplicationSummary', () => {
  it('shows the application title as the page heading', () => {
    renderSummary()
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React' })).toBeInTheDocument()
  })

  it('shows the closest upcoming interview and ignores past ones', () => {
    renderSummary([
      buildInterview('far', '2026-11-02T09:00:00Z', { kind: 'mock' }),
      buildInterview('past', '2026-10-18T09:00:00Z'),
      buildInterview('closest', '2026-10-20T09:00:00Z', { format: 'onsite' }),
    ])
    expect(screen.getByText('Prochain entretien').nextSibling).toHaveTextContent(
      `${formatParisInterviewDateTime(new Date('2026-10-20T09:00:00Z'))} · Entretien client · Sur site`,
    )
  })

  it('shows no upcoming interview when they are all past', () => {
    renderSummary([buildInterview('past', '2026-10-18T09:00:00Z')])
    expect(screen.queryByText('Prochain entretien')).not.toBeInTheDocument()
  })
})
