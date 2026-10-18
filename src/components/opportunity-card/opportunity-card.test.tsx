import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OpportunityListItem } from '@/domain/opportunities'
import { OpportunityCard } from './opportunity-card'

const NOW = new Date('2026-10-18T15:00:00Z')

const buildOpportunity = (overrides: Partial<OpportunityListItem> = {}): OpportunityListItem => ({
  id: 'opportunity-1',
  source: 'free-work',
  externalId: 'external-1',
  url: 'https://www.free-work.com/fr/tech-it/job-mission/1',
  title: 'Développeur React',
  company: 'Acme',
  description: 'Une longue description',
  rateMin: null,
  rateMax: null,
  rateLabel: null,
  currency: null,
  remoteMode: 'partial',
  locationLabel: 'Lyon',
  region: null,
  country: null,
  durationMonths: 6,
  publishedAt: new Date('2026-10-18T14:32:00Z'),
  skills: [],
  receivedAt: new Date('2026-10-18T14:40:00Z'),
  decision: null,
  jobApplicationId: null,
  ...overrides,
})

const renderCard = (
  opportunity: OpportunityListItem,
  properties: Partial<React.ComponentProps<typeof OpportunityCard>> = {},
) => {
  const onApply = jest.fn()
  const onDismiss = jest.fn()
  const onRestore = jest.fn()
  render(
    <OpportunityCard
      opportunity={opportunity}
      tab="to_process"
      isNew={false}
      isPending={false}
      now={NOW}
      onApply={onApply}
      onDismiss={onDismiss}
      onRestore={onRestore}
      {...properties}
    />,
  )
  return { onApply, onDismiss, onRestore }
}

describe('OpportunityCard', () => {
  it('does not render a link for a javascript: url', () => {
    renderCard(buildOpportunity({ url: 'javascript:alert(1)' }))
    expect(screen.queryByRole('link', { name: 'Voir sur Free-Work' })).not.toBeInTheDocument()
  })

  it('opens the Free-Work posting safely in a new tab', () => {
    renderCard(buildOpportunity())
    const link = screen.getByRole('link', { name: 'Voir sur Free-Work' })
    expect(link).toHaveAttribute('href', 'https://www.free-work.com/fr/tech-it/job-mission/1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows the undisclosed rate, the duration and the Paris publication time', () => {
    renderCard(buildOpportunity())
    expect(screen.getByText('Non communiqué')).toBeInTheDocument()
    expect(screen.getByText('6 mois')).toBeInTheDocument()
    expect(screen.getByText('Hybride')).toBeInTheDocument()
    expect(screen.getByText("aujourd'hui à 16h32")).toBeInTheDocument()
  })

  it('shows the day and month for an older publication', () => {
    renderCard(buildOpportunity({ publishedAt: new Date('2026-10-15T14:32:00Z') }))
    expect(screen.getByText('15/10 à 16h32')).toBeInTheDocument()
  })

  it('shows the new badge only when the opportunity is new', () => {
    renderCard(buildOpportunity(), { isNew: true })
    expect(screen.getByText('nouveau')).toBeInTheDocument()
  })

  it('does not show the new badge otherwise', () => {
    renderCard(buildOpportunity())
    expect(screen.queryByText('nouveau')).not.toBeInTheDocument()
  })

  it('triggers apply and dismiss', async () => {
    const opportunity = buildOpportunity()
    const { onApply, onDismiss } = renderCard(opportunity)
    await userEvent.click(screen.getByRole('button', { name: "J'ai postulé" }))
    await userEvent.click(screen.getByRole('button', { name: 'Pas intéressé' }))
    expect(onApply).toHaveBeenCalledWith(opportunity)
    expect(onDismiss).toHaveBeenCalledWith(opportunity)
  })

  it('links to the created application once applied', () => {
    renderCard(buildOpportunity({ decision: 'applied', jobApplicationId: 'application-1' }))
    expect(screen.getByText(/Candidature créée/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir la candidature' })).toHaveAttribute(
      'href',
      '/candidatures/application-1',
    )
    expect(screen.queryByRole('button', { name: "J'ai postulé" })).not.toBeInTheDocument()
  })

  it('offers the application link in the applied tab', () => {
    renderCard(buildOpportunity({ decision: 'applied', jobApplicationId: 'application-1' }), { tab: 'applied' })
    expect(screen.getByRole('link', { name: 'Voir la candidature' })).toBeInTheDocument()
    expect(screen.queryByText(/Candidature créée/)).not.toBeInTheDocument()
  })

  it('offers to restore a dismissed opportunity', async () => {
    const opportunity = buildOpportunity({ decision: 'dismissed' })
    const { onRestore } = renderCard(opportunity, { tab: 'dismissed' })
    await userEvent.click(screen.getByRole('button', { name: 'Remettre' }))
    expect(onRestore).toHaveBeenCalledWith(opportunity)
    expect(screen.queryByRole('button', { name: 'Pas intéressé' })).not.toBeInTheDocument()
  })

  it('disables the buttons and shows « Création… » while the action is in flight', () => {
    renderCard(buildOpportunity(), { isPending: true })
    expect(screen.getByRole('button', { name: 'Création…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pas intéressé' })).toBeDisabled()
  })

  it('expands and collapses the description', async () => {
    renderCard(buildOpportunity())
    const toggle = screen.getByRole('button', { name: 'Afficher la suite' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Réduire' })).toHaveAttribute('aria-expanded', 'true')
  })
})
