import { render, screen, within } from '@testing-library/react'
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
  sortMatchPercent: null,
  ...overrides,
})

const renderCard = (
  opportunity: OpportunityListItem,
  properties: Partial<Extract<React.ComponentProps<typeof OpportunityCard>, { isCompact?: false }>> = {},
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

  it('shows the platform of the mission as a pill next to its title', () => {
    renderCard(buildOpportunity({ source: 'collective', url: 'https://www.collective.work/jobs/fr/mission-1' }))
    const header = screen.getByRole('heading', { name: 'Développeur React' }).closest('header')
    expect(header).not.toBeNull()
    expect(within(header as HTMLElement).getByText('Collective')).toBeInTheDocument()
  })

  it('names the Collective platform on the link to a Collective posting', () => {
    renderCard(buildOpportunity({ source: 'collective', url: 'https://www.collective.work/jobs/fr/mission-1' }))
    expect(screen.getByRole('link', { name: 'Voir sur Collective' })).toHaveAttribute(
      'href',
      'https://www.collective.work/jobs/fr/mission-1',
    )
    expect(screen.queryByRole('link', { name: 'Voir sur Free-Work' })).not.toBeInTheDocument()
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

  it('tones the new badge lilac', () => {
    renderCard(buildOpportunity(), { isNew: true })
    expect(screen.getByText('nouveau')).toHaveAttribute('data-tone', 'lilac')
  })

  it('shows the rate apart from the facts list', () => {
    renderCard(buildOpportunity({ rateMax: 650 }))
    expect(screen.getByText('650 €/j')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).queryByText('650 €/j')).not.toBeInTheDocument()
  })

  it('orders the buttons apply, Free-Work, then dismiss', () => {
    renderCard(buildOpportunity())
    const applyButton = screen.getByRole('button', { name: "J'ai postulé" })
    const freeWorkLink = screen.getByRole('link', { name: 'Voir sur Free-Work' })
    const dismissButton = screen.getByRole('button', { name: 'Pas intéressé' })
    expect(applyButton.compareDocumentPosition(freeWorkLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(freeWorkLink.compareDocumentPosition(dismissButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  describe('match with my skills', () => {
    const MY_SKILLS = ['React', 'TypeScript', 'Docker']

    it('shows the match percent next to the rate with an accessible name', () => {
      renderCard(buildOpportunity({ rateMax: 650, skills: ['React.js', 'TS', 'Docker', 'GraphQL'] }), { mySkills: MY_SKILLS })

      const header = screen.getByRole('heading', { name: 'Développeur React' }).closest('header') as HTMLElement
      expect(within(header).getByText('75 % match')).toHaveAttribute('aria-hidden', 'true')
      expect(within(header).getByText('Correspondance avec tes compétences : 3 sur 4 (Très bon match)')).toHaveClass('sr-only')
      expect(within(header).getByText('650 €/j')).toBeInTheDocument()
    })

    it.each([
      [['React', 'TypeScript', 'Docker', 'Java'], 'forest-soft', 'Très bon match'],
      [['React', 'Java'], 'peach', 'Bon match'],
      [['React', 'Java', 'Go'], 'neutral', 'Match faible'],
    ])('tones the match pill by level and writes the level for the skills %p', (skills, expectedTone, expectedLevelLabel) => {
      renderCard(buildOpportunity({ skills }), { mySkills: MY_SKILLS })

      const matchPill = screen.getByText(/% match$/).closest('[data-tone]')
      expect(matchPill).toHaveAttribute('data-tone', expectedTone)
      expect(matchPill).toHaveTextContent(`(${expectedLevelLabel})`)
      expect(screen.getByText(new RegExp(`^${expectedLevelLabel} · \\d+ compétences? en commun sur \\d+$`))).toBeVisible()
    })

    it('writes the level and the shared skill count above the skill line', () => {
      renderCard(buildOpportunity({ skills: ['React', 'TypeScript', 'Docker', 'Java'] }), { mySkills: MY_SKILLS })

      const summary = screen.getByText('Très bon match · 3 compétences en commun sur 4')
      expect(summary).toHaveAttribute('aria-hidden', 'true')
      expect(
        summary.compareDocumentPosition(screen.getByRole('list', { name: 'Compétences demandées' })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('lets a long skill wrap inside the card instead of overflowing it', () => {
      const longSkill = 'Microsoft Dynamics 365 Finance and Operations Supply Chain Management'
      renderCard(buildOpportunity({ skills: [longSkill] }), { mySkills: MY_SKILLS })

      const skillPill = screen.getByText(longSkill).closest('[data-tone]')
      expect(skillPill).toHaveClass('max-w-full', 'whitespace-normal')
      expect(screen.getByText(longSkill)).toHaveClass('min-w-0', 'break-words')
    })

    it.each([
      ['the opportunity lists no skill', [], MY_SKILLS],
      ['I have no skill', ['React'], []],
    ])('shows no match pill when %s', (_caseName, skills, mySkills) => {
      renderCard(buildOpportunity({ skills }), { mySkills })

      expect(screen.queryByText(/% match$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Correspondance avec tes compétences/)).not.toBeInTheDocument()
    })

    it('lists the opportunity skills and marks the shared ones with a check and a text, not only a colour', () => {
      renderCard(buildOpportunity({ skills: ['GraphQL', 'React.js', 'Docker'] }), { mySkills: MY_SKILLS })

      const skillItems = within(screen.getByRole('list', { name: 'Compétences demandées' })).getAllByRole('listitem')
      expect(skillItems.map((skillItem) => skillItem.textContent)).toEqual([
        'React.js (en commun)',
        'Docker (en commun)',
        'GraphQL',
      ])
      expect(skillItems[0].querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(skillItems[0].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'forest-soft')
      expect(skillItems[2].querySelector('svg')).toBeNull()
      expect(skillItems[2].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'neutral')
    })

    it('lists the opportunity skills without highlight when I have no skill', () => {
      renderCard(buildOpportunity({ skills: ['React', 'react', 'Java'] }))

      const skillItems = within(screen.getByRole('list', { name: 'Compétences demandées' })).getAllByRole('listitem')
      expect(skillItems.map((skillItem) => skillItem.textContent)).toEqual(['React', 'Java'])
    })

    it('shows at most eight skills then « +N »', () => {
      const skills = Array.from({ length: 11 }, (_, index) => `Techno ${index}`)
      renderCard(buildOpportunity({ skills }), { mySkills: MY_SKILLS })

      const skillList = screen.getByRole('list', { name: 'Compétences demandées' })
      expect(within(skillList).getAllByRole('listitem')).toHaveLength(9)
      expect(within(skillList).getByText('+3')).toHaveAttribute('aria-hidden', 'true')
      expect(within(skillList).getByText('3 autres compétences')).toHaveClass('sr-only')
      expect(within(skillList).queryByText('Techno 8')).not.toBeInTheDocument()
    })

    it('renders no skill line for an opportunity without skills', () => {
      renderCard(buildOpportunity({ skills: [] }), { mySkills: MY_SKILLS })

      expect(screen.queryByRole('list', { name: 'Compétences demandées' })).not.toBeInTheDocument()
    })
  })
})
