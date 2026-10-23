import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { TechnicalBrief, TechnicalBriefView } from '@/domain/technical-brief'
import { TechnicalBriefSection } from './technical-brief-section'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const brief: TechnicalBrief = {
  language: 'fr',
  cvVersionId: 'cv-1',
  cvLabel: 'CV 2026',
  cvUploadedAt: new Date('2026-10-01T10:00:00Z'),
  generatedAt: new Date('2026-10-20T10:00:00Z'),
  content: {
    storyline: [
      { title: 'Ton accroche', guidance: 'Dis qui tu es en une phrase.' },
      { title: 'Mission Alpha', guidance: 'Raconte la migration.' },
      { title: 'Mission Beta', guidance: 'Insiste sur la scalabilité.' },
      { title: 'Leur produit', guidance: 'Parle de leur défi.' },
      { title: 'Pourquoi eux', guidance: 'Appuie-toi sur le brief client.' },
    ],
    missions: [
      {
        label: 'Alpha Corp',
        period: '2022 - 2024',
        emphasis: 'lean_on',
        sharedStack: ['React', 'Node'],
        why: 'Même stack.',
        reflectionQuestions: ['Quel défi de perf ?', 'Quel arbitrage ?'],
      },
      {
        label: 'Beta Labs',
        period: '2020',
        emphasis: 'intro',
        sharedStack: ['TypeScript'],
        why: 'Contexte proche.',
        reflectionQuestions: ['Quel rôle ?'],
      },
      { label: 'Gamma', period: '', emphasis: 'skim', sharedStack: [], why: 'Trop ancien', reflectionQuestions: [] },
      { label: 'Delta', period: '', emphasis: 'skim', sharedStack: [], why: 'Hors sujet', reflectionQuestions: [] },
    ],
    gaps: [{ stackItem: 'Kafka', question: 'As-tu déjà travaillé avec des files de messages ?' }],
  },
}

const buildView = (overrides: Partial<TechnicalBriefView> = {}): TechnicalBriefView => ({
  language: 'fr',
  availability: 'ready',
  brief: null,
  isCvOutdated: false,
  ...overrides,
})

const renderSection = (
  view: TechnicalBriefView,
  overrides: Partial<ComponentProps<typeof TechnicalBriefSection>> = {},
) => {
  const getTechnicalBriefView = jest.fn().mockResolvedValue({ ok: true, data: view })
  const generateTechnicalBrief = jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_unreadable' } })
  render(
    <TechnicalBriefSection
      jobApplicationId={JOB_APPLICATION_ID}
      language={'fr' as BriefLanguage}
      hasAnthropicApiKey
      getTechnicalBriefView={getTechnicalBriefView}
      generateTechnicalBrief={generateTechnicalBrief}
      {...overrides}
    />,
  )
  return { getTechnicalBriefView, generateTechnicalBrief }
}

describe('TechnicalBriefSection', () => {
  it('announces the loading of the view, then removes the loading line', async () => {
    let finishLoading: (value: unknown) => void = () => undefined
    const getTechnicalBriefView = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve
      }),
    )
    renderSection(buildView(), { getTechnicalBriefView })
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du brief technique…')
    finishLoading({ ok: true, data: buildView() })
    expect(await screen.findByText(/croise ton CV envoyé/)).toBeInTheDocument()
    expect(screen.queryByText('Chargement du brief technique…')).not.toBeInTheDocument()
  })

  it('shows the key notice without a key and no generation button', async () => {
    renderSection(buildView(), { hasAnthropicApiKey: false })
    expect(await screen.findByRole('note')).toHaveTextContent('la préparation du pitch')
    expect(screen.queryByRole('button', { name: 'Préparer mon pitch' })).not.toBeInTheDocument()
  })

  it('keeps a stored brief visible without a key', async () => {
    renderSection(buildView({ brief }), { hasAnthropicApiKey: false })
    expect(await screen.findByText('1 · Ton fil rouge')).toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Régénérer' })).not.toBeInTheDocument()
  })

  it('asks to attach the sent cv when there is none', async () => {
    renderSection(buildView({ availability: 'missing_sent_cv' }))
    expect(
      await screen.findByText('Rattache le CV que tu as envoyé à cette candidature pour préparer ton pitch.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choisir le CV envoyé' })).toBeInTheDocument()
  })

  it('asks for the job spec or the stack when the mission has neither', async () => {
    renderSection(buildView({ availability: 'missing_mission_details' }))
    expect(
      await screen.findByText('Ajoute la fiche de poste ou la stack de la mission pour préparer ton pitch.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Préparer mon pitch' })).not.toBeInTheDocument()
  })

  it('offers to prepare the pitch when ready and never generated, and shows the progress while generating', async () => {
    let finishGeneration: (value: unknown) => void = () => undefined
    const generateTechnicalBrief = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finishGeneration = resolve
      }),
    )
    renderSection(buildView(), { generateTechnicalBrief })
    expect(await screen.findByText(/croise ton CV envoyé/)).toBeInTheDocument()
    const generationButton = screen.getByRole('button', { name: 'Préparer mon pitch' })
    await userEvent.click(generationButton)
    expect(generateTechnicalBrief).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr')
    const progressButton = screen.getByRole('button', { name: "Préparation de ton pitch… (jusqu'à 2 min)" })
    expect(progressButton).toBeDisabled()
    finishGeneration({ ok: true, data: { kind: 'cv_unreadable' } })
    expect(await screen.findByText(/Impossible de lire ce CV/)).toBeInTheDocument()
  })

  it('explains that the cv lacks information and links to the cv page', async () => {
    renderSection(buildView(), {
      generateTechnicalBrief: jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_missing_information' } }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    expect(await screen.findByText("Le CV manque d'informations.")).toBeInTheDocument()
    expect(screen.getByText('Il faut au moins la stack de chaque mission pour savoir sur lesquelles appuyer.')).toBeInTheDocument()
    expect(screen.getByText("T'inquiète, on va le retaper ensemble.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Améliorer mon CV' })).toHaveAttribute('href', '/cv')
  })

  it('shows the unreadable cv message with the link to the cv page', async () => {
    renderSection(buildView())
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    expect(
      await screen.findByText('Impossible de lire ce CV. Dépose une version PDF exportée depuis ton éditeur, pas un scan.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Améliorer mon CV' })).toHaveAttribute('href', '/cv')
  })

  it('shows the error under the block and keeps the previous brief', async () => {
    renderSection(buildView({ brief }), {
      generateTechnicalBrief: jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Clé invalide' }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Régénérer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Clé invalide')
    expect(screen.getByText('1 · Ton fil rouge')).toBeInTheDocument()
  })

  it('shows the storyline, the mission cards with their questions, the skim line and the gaps', async () => {
    renderSection(buildView({ brief }))
    expect(await screen.findByText('Basé sur : CV 2026 · version du 01/10/2026 (le CV envoyé)')).toBeInTheDocument()
    const storyline = screen.getByRole('list', { name: '1 · Ton fil rouge' })
    expect(within(storyline).getAllByRole('listitem')).toHaveLength(5)
    expect(within(storyline).getByText('Mission Alpha')).toBeInTheDocument()
    expect(within(storyline).getByText('Raconte la migration.')).toBeInTheDocument()
    const alphaCard = screen.getByRole('article', { name: /Alpha Corp/ })
    expect(within(alphaCard).getByText('Appuie fort')).toHaveClass('bg-peach', 'text-on-peach')
    expect(within(alphaCard).getByText('2022 - 2024')).toBeInTheDocument()
    expect(within(alphaCard).getByText('En commun avec leur stack :')).toBeInTheDocument()
    expect(within(alphaCard).getByText('React')).toBeInTheDocument()
    expect(within(alphaCard).getByText(/Pourquoi :/)).toHaveTextContent('Pourquoi : Même stack.')
    expect(within(alphaCard).getByText('Pour préparer ton récit :')).toBeInTheDocument()
    expect(within(alphaCard).getByText('Quel arbitrage ?')).toBeInTheDocument()
    const betaCard = screen.getByRole('article', { name: /Beta Labs/ })
    expect(within(betaCard).getByText("Pour l'intro")).toHaveClass('bg-forest-soft', 'text-on-forest-soft')
    expect(screen.queryByRole('article', { name: /Gamma/ })).not.toBeInTheDocument()
    expect(screen.getByText('Passe vite sur : Gamma (Trop ancien) ; Delta (Hors sujet).')).toBeInTheDocument()
    expect(screen.getByText('3 · Points à préparer')).toBeInTheDocument()
    expect(screen.getByText('Kafka — As-tu déjà travaillé avec des files de messages ?')).toBeInTheDocument()
  })

  it('hides the gaps and the skim line when there are none', async () => {
    const briefWithoutExtras: TechnicalBrief = {
      ...brief,
      content: { ...brief.content, gaps: [], missions: brief.content.missions.slice(0, 2) },
    }
    renderSection(buildView({ brief: briefWithoutExtras }))
    await screen.findByText('1 · Ton fil rouge')
    expect(screen.queryByText('3 · Points à préparer')).not.toBeInTheDocument()
    expect(screen.queryByText(/Passe vite sur/)).not.toBeInTheDocument()
  })

  it('shows the outdated notice and swaps Régénérer for Choisir le CV envoyé without a sent cv', async () => {
    renderSection(buildView({ brief, isCvOutdated: true, availability: 'missing_sent_cv' }))
    expect(await screen.findByText('Ton CV envoyé a changé depuis ce brief.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Régénérer' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choisir le CV envoyé' })).toBeInTheDocument()
  })

  it('emphasises Régénérer only when the sent cv changed', async () => {
    renderSection(buildView({ brief, isCvOutdated: true }))
    expect(await screen.findByRole('button', { name: 'Régénérer' })).toHaveClass('bg-primary')
  })

  it('keeps Régénérer discreet when the cv is up to date', async () => {
    renderSection(buildView({ brief }))
    expect(await screen.findByRole('button', { name: 'Régénérer' })).not.toHaveClass('bg-primary')
  })

  it('shows the missing mission details text instead of Régénérer', async () => {
    renderSection(buildView({ brief, availability: 'missing_mission_details' }))
    expect(
      await screen.findByText('Ajoute la fiche de poste ou la stack de la mission pour préparer ton pitch.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Régénérer' })).not.toBeInTheDocument()
  })

  it('renders every mission card and every step even when the ai repeats a label or a title', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const alphaMission = brief.content.missions[0]
    const briefWithRepeatedTexts: TechnicalBrief = {
      ...brief,
      content: {
        storyline: brief.content.storyline.map((step) => ({ ...step, title: '' })),
        missions: [alphaMission, { ...alphaMission, period: '2019', sharedStack: ['React', 'React'] }],
        gaps: [
          { stackItem: 'Kafka', question: 'Quelle file de messages ?' },
          { stackItem: 'Kafka', question: 'Quel volume ?' },
        ],
      },
    }
    renderSection(buildView({ brief: briefWithRepeatedTexts }))
    expect(await screen.findAllByRole('article', { name: /Alpha Corp/ })).toHaveLength(2)
    expect(within(screen.getByRole('list', { name: '1 · Ton fil rouge' })).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('Kafka — Quel volume ?')).toBeInTheDocument()
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain('same key')
    consoleErrorSpy.mockRestore()
  })

  it('nests the mission card headings under the missions heading and labels the missions list', async () => {
    renderSection(buildView({ brief }))
    const missionsList = await screen.findByRole('list', { name: '2 · Missions sur lesquelles appuyer' })
    expect(within(missionsList).getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 4, name: '2 · Missions sur lesquelles appuyer' })).toBeInTheDocument()
    expect(within(missionsList).getByRole('heading', { level: 5, name: 'Alpha Corp' })).toBeInTheDocument()
    expect(within(missionsList).getByRole('heading', { level: 5, name: 'Beta Labs' })).toBeInTheDocument()
  })

  it('puts in bold every mission label quoted in the storyline guidance', async () => {
    const briefQuotingMissions: TechnicalBrief = {
      ...brief,
      content: {
        ...brief.content,
        storyline: brief.content.storyline.map((step, stepIndex) =>
          stepIndex === 1 ? { ...step, guidance: 'Raconte Alpha Corp, puis relie Beta Labs à Alpha Corp.' } : step,
        ),
      },
    }
    renderSection(buildView({ brief: briefQuotingMissions }))
    const storyline = await screen.findByRole('list', { name: '1 · Ton fil rouge' })
    const boldMissionLabels = within(storyline)
      .getAllByText(/Alpha Corp|Beta Labs/, { selector: 'strong' })
      .map((boldElement) => boldElement.textContent)
    expect(boldMissionLabels).toEqual(['Alpha Corp', 'Beta Labs', 'Alpha Corp'])
    expect(within(storyline).getAllByRole('listitem')[1]).toHaveTextContent(
      'Mission AlphaRaconte Alpha Corp, puis relie Beta Labs à Alpha Corp.',
    )
  })

  it('announces the cv outcome to screen readers', async () => {
    renderSection(buildView(), {
      generateTechnicalBrief: jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_missing_information' } }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    expect(await screen.findByRole('status')).toHaveTextContent("Le CV manque d'informations.")
  })

  it('announces the unreadable cv outcome to screen readers', async () => {
    renderSection(buildView())
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Impossible de lire ce CV.')
  })

  it('links Améliorer mon CV to the cv page and Choisir le CV envoyé to the sent cv block', async () => {
    renderSection(buildView({ availability: 'missing_sent_cv' }))
    expect(await screen.findByRole('link', { name: 'Choisir le CV envoyé' })).toHaveAttribute(
      'href',
      `/candidatures/${JOB_APPLICATION_ID}?onglet=apercu#cv-envoye`,
    )
  })
})
