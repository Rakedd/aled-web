import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OpportunityListing, OpportunityListItem } from '@/domain/opportunities'
import { OpportunitiesBoard } from './opportunities-board'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const NOW = new Date('2026-10-18T13:00:00Z')

const buildOpportunity = (
  id: string,
  receivedAt: string,
  overrides: Partial<OpportunityListItem> = {},
): OpportunityListItem => ({
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
  sortMatchPercent: null,
  ...overrides,
})

const EMPTY_LISTING_RESULT = {
  ok: true,
  data: {
    items: [],
    hasMore: false,
    counts: { to_process: 0, applied: 0, dismissed: 0 },
    lastReceivedAt: new Date('2026-10-18T12:30:00Z'),
    lastViewedAt: null,
  },
}

const renderBoard = (
  listingOverrides: Partial<OpportunityListing>,
  hasActiveFilters = false,
  initialTab: 'to_process' | 'applied' | 'dismissed' = 'to_process',
  applyToOpportunity: jest.Mock = jest.fn(),
  listOpportunities: jest.Mock = jest.fn(),
  mySkills: string[] = [],
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
      mySkills={mySkills}
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

  it('shows the filters empty state with a link to the filters settings', () => {
    renderBoard({}, true)
    expect(screen.getByText(/Rien de nouveau qui correspond à tes filtres/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajuster mes filtres' })).toHaveAttribute('href', '/preferences/opportunites')
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

    expect(listOpportunities).toHaveBeenCalledWith('applied', null, '', { sortOrder: 'publication', remoteModes: [] })
  })

  it('keeps the focus on the tab while the next tab loads and ignores further keys', async () => {
    const listOpportunities = jest.fn().mockReturnValue(new Promise(() => undefined))
    renderBoard({ counts: { to_process: 3, applied: 0, dismissed: 0 } }, false, 'to_process', jest.fn(), listOpportunities)
    screen.getByRole('tab', { name: 'À traiter · 3' }).focus()

    await userEvent.keyboard('{ArrowRight}')
    const appliedTab = screen.getByRole('tab', { name: 'Postulées · 0' })
    expect(appliedTab).toHaveFocus()
    expect(appliedTab).toHaveAttribute('aria-disabled', 'true')

    await userEvent.keyboard('{ArrowRight}')

    expect(appliedTab).toHaveFocus()
    expect(listOpportunities).toHaveBeenCalledTimes(1)
  })

  it('exposes the rate sort as a toggle button', async () => {
    const listOpportunities = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [],
        hasMore: false,
        counts: { to_process: 0, applied: 0, dismissed: 0 },
        lastReceivedAt: new Date('2026-10-18T12:30:00Z'),
        lastViewedAt: null,
      },
    })
    renderBoard({}, false, 'to_process', jest.fn(), listOpportunities)
    const sortToggle = screen.getByRole('button', { name: 'Trier par TJM' })
    expect(sortToggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(sortToggle)

    expect(screen.getByRole('button', { name: 'Trier par TJM' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('groups the three remote mode toggles under « Présentiel »', () => {
    renderBoard({})
    const remoteGroup = screen.getByRole('group', { name: 'Présentiel' })
    const toggles = within(remoteGroup).getAllByRole('button')
    expect(toggles.map((toggle) => toggle.textContent)).toEqual(['Full remote', 'Hybride', 'Sur site'])
    toggles.forEach((toggle) => expect(toggle).toHaveAttribute('aria-pressed', 'false'))
  })

  it('links to the filters settings from the header, without naming a source', () => {
    renderBoard({})
    expect(screen.getByRole('link', { name: 'Filtres' })).toHaveAttribute('href', '/preferences/opportunites')
    expect(screen.queryByRole('link', { name: /Free-Work|Collective/ })).not.toBeInTheDocument()
  })

  it('shows the filtered empty state once a remote mode is selected', async () => {
    const listOpportunities = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [],
        hasMore: false,
        counts: { to_process: 0, applied: 0, dismissed: 0 },
        lastReceivedAt: new Date('2026-10-18T12:30:00Z'),
        lastViewedAt: null,
      },
    })
    renderBoard({}, false, 'to_process', jest.fn(), listOpportunities)

    await userEvent.click(screen.getByRole('button', { name: 'Hybride' }))

    expect(await screen.findByText('Aucune mission ne correspond à ces filtres.')).toBeInTheDocument()
  })

  describe('match with my skills', () => {
    it('invites me to add my skills, with a link to the opportunity preferences, when I have none', () => {
      renderBoard({})

      const hintLink = screen.getByRole('link', { name: 'tes filtres' })
      expect(hintLink).toHaveAttribute('href', '/preferences/opportunites')
      expect(hintLink.closest('p')).toHaveTextContent(
        'Ajoute tes compétences dans tes filtres pour voir ton taux de match.',
      )
      expect(screen.queryByRole('button', { name: 'Meilleur match' })).not.toBeInTheDocument()
    })

    it('shows the match of each card once I have skills, without the invitation', () => {
      renderBoard(
        {
          items: [buildOpportunity('opportunity-1', '2026-10-18T09:00:00Z', { skills: ['React', 'Java'] })],
          counts: { to_process: 1, applied: 0, dismissed: 0 },
        },
        false,
        'to_process',
        jest.fn(),
        jest.fn(),
        ['React'],
      )

      expect(screen.queryByRole('link', { name: 'tes filtres' })).not.toBeInTheDocument()
      expect(screen.getByText('Correspondance avec tes compétences : 1 sur 2 (Bon match)')).toBeInTheDocument()
    })

    it('groups the two sorts under « Tri » and keeps them exclusive, each press releasing the other', async () => {
      const listOpportunities = jest.fn().mockResolvedValue(EMPTY_LISTING_RESULT)
      renderBoard({}, false, 'to_process', jest.fn(), listOpportunities, ['React'])
      const sortGroup = screen.getByRole('group', { name: 'Tri' })
      const rateToggle = () => within(sortGroup).getByRole('button', { name: 'Trier par TJM' })
      const matchToggle = () => within(sortGroup).getByRole('button', { name: 'Meilleur match' })
      expect(rateToggle()).toHaveAttribute('aria-pressed', 'false')
      expect(matchToggle()).toHaveAttribute('aria-pressed', 'false')

      await userEvent.click(rateToggle())
      expect(rateToggle()).toHaveAttribute('aria-pressed', 'true')
      expect(matchToggle()).toHaveAttribute('aria-pressed', 'false')

      await userEvent.click(matchToggle())
      expect(matchToggle()).toHaveAttribute('aria-pressed', 'true')
      expect(rateToggle()).toHaveAttribute('aria-pressed', 'false')
      expect(listOpportunities).toHaveBeenLastCalledWith('to_process', null, '', { sortOrder: 'match', remoteModes: [] })

      await userEvent.click(rateToggle())
      expect(rateToggle()).toHaveAttribute('aria-pressed', 'true')
      expect(matchToggle()).toHaveAttribute('aria-pressed', 'false')
    })

    it('offers the best match sort in « À traiter » only, and finds it again on return', async () => {
      const listOpportunities = jest.fn().mockResolvedValue(EMPTY_LISTING_RESULT)
      renderBoard({}, false, 'to_process', jest.fn(), listOpportunities, ['React'])
      await userEvent.click(screen.getByRole('button', { name: 'Meilleur match' }))

      await userEvent.click(screen.getByRole('tab', { name: /^Postulées/ }))

      expect(screen.queryByRole('button', { name: 'Meilleur match' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Trier par TJM' })).toHaveAttribute('aria-pressed', 'false')

      await userEvent.click(screen.getByRole('tab', { name: /^À traiter/ }))

      expect(screen.getByRole('button', { name: 'Meilleur match' })).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
