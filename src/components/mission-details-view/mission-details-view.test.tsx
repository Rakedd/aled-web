import { render, screen } from '@testing-library/react'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { MissionDetailsView } from './mission-details-view'

const readValueOf = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling

describe('MissionDetailsView', () => {
  it('formats the daily rates and the Paris effective start date', () => {
    render(
      <MissionDetailsView
        jobApplication={buildJobApplicationOverview({
          requestedDailyRate: 1200,
          actualStartDate: new Date('2026-11-02T23:00:00Z'),
        })}
      />,
    )
    expect(readValueOf('TJM annoncé')?.textContent).toBe('650\u00a0€')
    expect(readValueOf('TJM demandé')?.textContent).toBe('1\u202f200\u00a0€')
    expect(readValueOf('Démarrage effectif')).toHaveTextContent('03/11/2026')
    expect(readValueOf('Lieu')).toHaveTextContent('Paris')
    expect(readValueOf('Durée')).toHaveTextContent('6 mois')
  })

  it('shows a dash for every empty field', () => {
    render(
      <MissionDetailsView
        jobApplication={buildJobApplicationOverview({
          postedDailyRate: null,
          location: null,
          remotePolicy: null,
          desiredStart: null,
          duration: null,
          notes: null,
        })}
      />,
    )
    for (const term of ['TJM annoncé', 'TJM demandé', 'Lieu', 'Présentiel / télétravail', 'Démarrage souhaité', 'Démarrage effectif', 'Durée', 'Notes']) {
      expect(readValueOf(term)).toHaveTextContent('—')
    }
  })

  it('keeps the original posting text folded', () => {
    render(<MissionDetailsView jobApplication={buildJobApplicationOverview()} />)
    expect(screen.getByText("Texte original de l'annonce").closest('details')).not.toHaveAttribute('open')
  })
})
