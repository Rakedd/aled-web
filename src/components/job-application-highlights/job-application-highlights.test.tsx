import { render, screen } from '@testing-library/react'
import type { Interview } from '@/domain/interviews'
import { JobApplicationHighlights } from './job-application-highlights'
import type { JobApplicationHighlightsProps } from './interfaces'

const NOW = new Date('2026-10-19T08:00:00Z')

const CLIENT_INTERVIEW: Interview = {
  id: 'interview-1',
  jobApplicationId: 'application-1',
  startsAt: new Date('2026-10-21T08:00:00Z'),
  kind: 'client',
  format: 'video',
  participants: null,
  notes: null,
}

const renderHighlights = (overrides: Partial<JobApplicationHighlightsProps> = {}) =>
  render(
    <JobApplicationHighlights
      requestedDailyRate={null}
      postedDailyRate={null}
      nextInterview={null}
      now={NOW}
      preparation={<button type="button">Générer le brief</button>}
      {...overrides}
    />,
  )

describe('JobApplicationHighlights', () => {
  it('shows the requested daily rate before the posted one', () => {
    renderHighlights({ requestedDailyRate: 650, postedDailyRate: 600 })
    expect(screen.getByRole('heading', { level: 2, name: 'TJM demandé' })).toBeInTheDocument()
    expect(screen.getByText(/650\s€\/j/)).toBeInTheDocument()
    expect(screen.queryByText('TJM annoncé')).not.toBeInTheDocument()
  })

  it('falls back to the posted daily rate', () => {
    renderHighlights({ postedDailyRate: 600 })
    expect(screen.getByText('TJM annoncé')).toBeInTheDocument()
    expect(screen.getByText(/600\s€\/j/)).toBeInTheDocument()
  })

  it('says the daily rate is missing when neither is known', () => {
    renderHighlights()
    expect(screen.getByText('TJM non renseigné')).toBeInTheDocument()
  })

  it('shows the next interview with its countdown, Paris date and kind', () => {
    renderHighlights({ nextInterview: CLIENT_INTERVIEW })
    expect(screen.getByText('Prochain entretien · dans 2 jours')).toBeInTheDocument()
    expect(screen.getByText('mer. 21/10 · 10h00')).toBeInTheDocument()
    expect(screen.getByText('Entretien client')).toBeInTheDocument()
  })

  it('says no interview is planned without a next interview', () => {
    renderHighlights()
    expect(screen.getByText('Aucun entretien prévu')).toBeInTheDocument()
  })

  it('renders the preparation slot', () => {
    renderHighlights()
    expect(screen.getByRole('button', { name: 'Générer le brief' })).toBeInTheDocument()
  })

  it('lays the three tiles out in equal columns on desktop and stacks them on phone', () => {
    const { container } = renderHighlights()
    const highlightsGrid = container.firstElementChild as HTMLElement
    expect(highlightsGrid).toHaveClass('grid', 'lg:grid-cols-3')
    expect(highlightsGrid).not.toHaveClass('lg:grid-cols-1')
    expect(screen.getByRole('button', { name: 'Générer le brief' }).parentElement).toHaveClass('lg:col-span-1')
  })
})
