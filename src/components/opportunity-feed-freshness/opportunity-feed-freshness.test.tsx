import { render, screen } from '@testing-library/react'
import { OpportunityFeedFreshness } from './opportunity-feed-freshness'

const STALE_MESSAGE = 'Aucune mission reçue depuis plus de 4 h : vérifie le watcher.'

describe('OpportunityFeedFreshness', () => {
  it('warns at 15:00 Paris time when the last reception was at 10:00', () => {
    render(
      <OpportunityFeedFreshness
        lastReceivedAt={new Date('2026-10-18T08:00:00Z')}
        now={new Date('2026-10-18T13:00:00Z')}
      />,
    )
    expect(screen.getByText(/Free-Work · mis à jour il y a/)).toBeInTheDocument()
    expect(screen.getByText(STALE_MESSAGE)).toBeInTheDocument()
  })

  it('does not warn when the last reception is recent', () => {
    render(
      <OpportunityFeedFreshness
        lastReceivedAt={new Date('2026-10-18T12:00:00Z')}
        now={new Date('2026-10-18T13:00:00Z')}
      />,
    )
    expect(screen.getByText(/Free-Work · mis à jour il y a/)).toBeInTheDocument()
    expect(screen.queryByText(STALE_MESSAGE)).not.toBeInTheDocument()
  })

  it('does not warn outside the watch hours', () => {
    render(
      <OpportunityFeedFreshness
        lastReceivedAt={new Date('2026-10-17T18:00:00Z')}
        now={new Date('2026-10-18T04:00:00Z')}
      />,
    )
    expect(screen.queryByText(STALE_MESSAGE)).not.toBeInTheDocument()
  })

  it('says nothing was received yet', () => {
    render(<OpportunityFeedFreshness lastReceivedAt={null} now={new Date('2026-10-18T13:00:00Z')} />)
    expect(screen.getByText("Aucune mission reçue pour l'instant.")).toBeInTheDocument()
  })

  it('formats the distance in French', () => {
    render(
      <OpportunityFeedFreshness
        lastReceivedAt={new Date('2026-10-18T12:35:00Z')}
        now={new Date('2026-10-18T13:00:00Z')}
      />,
    )
    expect(screen.getByText('Free-Work · mis à jour il y a 25 minutes')).toBeInTheDocument()
  })
})
