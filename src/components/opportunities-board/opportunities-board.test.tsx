import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OpportunityListing, OpportunityListItem } from '@/domain/opportunities'
import { OpportunitiesBoard } from './opportunities-board'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const NOW = new Date('2026-10-18T13:00:00Z')

const buildOpportunity = (id: string, receivedAt: string): OpportunityListItem => ({
  id,
  source: 'free-work',
  externalId: id,
  url: 'https://www.free-work.com/x',
  title: `Mission ${id}`,
  company: null,
  description: null,
  rateMin: null,
  rateMax: null,
  rateLabel: null,
  currency: null,
  remoteMode: null,
  locationLabel: null,
  region: null,
  country: null,
  durationMonths: null,
  publishedAt: new Date('2026-10-18T08:00:00Z'),
  skills: [],
  receivedAt: new Date(receivedAt),
  decision: null,
  jobApplicationId: null,
})

const renderBoard = (
  listingOverrides: Partial<OpportunityListing>,
  hasActiveFilters = false,
  initialTab: 'to_process' | 'applied' | 'dismissed' = 'to_process',
  applyToOpportunity: jest.Mock = jest.fn(),
  listOpportunities: jest.Mock = jest.fn(),
) => {
  const succeeded = { ok: true, data: null }
  render(
    <OpportunitiesBoard
      initialTab={initialTab}
      initialListing={{
        items: [],
        hasMore: false,
        counts: { to_process: 0, applied: 0, dismissed: 0 },
        lastReceivedAt: new Date('2026-10-18T12:30:00Z'),
        lastViewedAt: null,
        ...listingOverrides,
      }}
      hasActiveFilters={hasActiveFilters}
      now={NOW}
      listOpportunities={listOpportunities}
      applyToOpportunity={applyToOpportunity}
      dismissOpportunity={jest.fn()}
      restoreOpportunity={jest.fn()}
      markOpportunitiesViewed={jest.fn().mockResolvedValue(succeeded)}
    />,
  )
}

describe('OpportunitiesBoard', () => {
  it('shows « Création… » on the apply button while the application is being created', async () => {
    const neverSettlingApply = jest.fn().mockReturnValue(new Promise(() => undefined))
    renderBoard(
      { items: [buildOpportunity('opportunity-1', '2026-10-18T09:00:00Z')], counts: { to_process: 1, applied: 0, dismissed: 0 } },
      false,
      'to_process',
      neverSettlingApply,
    )

    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))

    expect(screen.getByRole('button', { name: 'Création…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: "J'ai postulé" })).not.toBeInTheDocument()
    expect(neverSettlingApply).toHaveBeenCalledWith('opportunity-1')
  })

  it('shows the filters empty state with a link to the Free-Work settings', () => {
    renderBoard({}, true)
    expect(screen.getByText(/Rien de nouveau qui correspond à tes filtres/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /filtres Free-Work/ })).toHaveAttribute(
      'href',
      '/preferences/opportunites/free-work',
    )
  })

  it('shows the no-mission message only once when nothing was ever received', () => {
    renderBoard({ lastReceivedAt: null }, true)
    expect(screen.getAllByText("Aucune mission reçue pour l'instant.")).toHaveLength(1)
  })

  it('shows the plain empty state without filters', () => {
    renderBoard({})
    expect(screen.getByText("Rien de nouveau pour l'instant.")).toBeInTheDocument()
  })

  it('shows the empty message of the applied tab', () => {
    renderBoard({}, false, 'applied')
    expect(screen.getByText('Aucune opportunité postulée.')).toBeInTheDocument()
  })

  it('hides the empty message while more results can be loaded', () => {
    renderBoard({ hasMore: true, counts: { to_process: 3, applied: 0, dismissed: 0 } }, true)
    expect(screen.queryByText(/Rien de nouveau/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voir plus' })).toBeInTheDocument()
  })

  it('badges only the opportunities received after the last visit', () => {
    renderBoard({
      items: [buildOpportunity('old', '2026-10-18T08:00:00Z'), buildOpportunity('fresh', '2026-10-18T12:00:00Z')],
      counts: { to_process: 2, applied: 0, dismissed: 0 },
      lastViewedAt: new Date('2026-10-18T10:00:00Z'),
    })
    expect(screen.getAllByText('nouveau')).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'À traiter · 2' })).toBeInTheDocument()
  })

  it('renders a labelled search input capped at 100 characters above the tabs', () => {
    renderBoard({})
    const searchInput = screen.getByRole('searchbox', { name: 'Rechercher une mission' })
    expect(searchInput).toHaveAttribute('placeholder', 'Rechercher une mission…')
    expect(searchInput).toHaveAttribute('maxlength', '100')
    expect(searchInput.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('names each tab with its count', () => {
    renderBoard({ counts: { to_process: 3, applied: 0, dismissed: 0 } })
    expect(screen.getByRole('tab', { name: 'À traiter · 3' })).toBeInTheDocument()
  })

  it('loads the next tab when ArrowRight is pressed on the selected tab', async () => {
    const listOpportunities = jest.fn().mockReturnValue(new Promise(() => undefined))
    renderBoard({ counts: { to_process: 3, applied: 0, dismissed: 0 } }, false, 'to_process', jest.fn(), listOpportunities)
    screen.getByRole('tab', { name: 'À traiter · 3' }).focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(listOpportunities).toHaveBeenCalledWith('applied', null, '')
  })
})
