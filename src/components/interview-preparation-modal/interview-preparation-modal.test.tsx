import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactElement } from 'react'
import type Markdown from 'react-markdown'
import type { InterviewPreparation } from '@/domain/interview-preparation'
import { InterviewPreparationModal } from './interview-preparation-modal'

type MarkdownProps = ComponentProps<typeof Markdown>

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (markdownProps: MarkdownProps): ReactElement => <div data-testid="brief-markdown">{markdownProps.children}</div>,
}))

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'

const buildPreparation = (overrides: Partial<InterviewPreparation> = {}): InterviewPreparation => ({
  language: 'fr',
  endClientId: END_CLIENT_ID,
  endClientName: 'BNP Paribas',
  brief: {
    language: 'fr',
    markdown: '## Enjeux\n\nCroissance\n\n## Chiffres clés\n\nCA : 1 Md€\n\n## Dates clés\n\n2024 : fusion',
    sources: [
      { title: 'Rapport annuel', url: 'https://example.com/report' },
      { title: 'Source piégée', url: 'javascript:alert(1)' },
    ],
    generatedAt: new Date('2026-10-17T09:15:00Z'),
  },
  questions: {
    language: 'fr',
    questions: ['Pourquoi nous ?', 'Quelle architecture ?'],
    generatedAt: new Date('2026-10-18T08:00:00Z'),
  },
  notes: 'Parler de Kafka',
  lastUsedLanguage: 'fr',
  ...overrides,
})

const renderModal = (overrides: Partial<ComponentProps<typeof InterviewPreparationModal>> = {}) => {
  const onClose = jest.fn()
  const onRegenerate = jest.fn()
  const onGenerateMissingPart = jest.fn()
  render(
    <InterviewPreparationModal
      isOpen
      onClose={onClose}
      preparation={buildPreparation()}
      generationProgressLabel={null}
      errorMessage={null}
      hasAnthropicApiKey
      onRegenerate={onRegenerate}
      onGenerateMissingPart={onGenerateMissingPart}
      notes="Parler de Kafka"
      changeNotes={jest.fn()}
      notesSaveStatus="idle"
      notesErrorMessage={null}
      retryNotesSave={jest.fn()}
      technicalBriefSlot={<section aria-label="Emplacement du brief technique" />}
      finalFocusRef={{ current: null }}
      {...overrides}
    />,
  )
  return { onClose, onRegenerate, onGenerateMissingPart }
}

describe('InterviewPreparationModal', () => {
  it('renders nothing while closed', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a titled dialog showing the brief, the notes, the questions and the generation date', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: "Préparation d'entretien" })).toBeInTheDocument()
    expect(screen.getByLabelText("Mes notes sur l'entreprise")).toHaveValue('Parler de Kafka')
    expect(screen.getByText(/Brief généré le 17\/10\/2026 11:15/)).toBeInTheDocument()
    expect(screen.getByText(/Questions générées le 18\/10\/2026 10:00/)).toBeInTheDocument()
  })

  it('renders the technical brief slot after the interview questions and before the sources', () => {
    renderModal()
    const questionsTitle = screen.getByText('Questions à poser en entretien')
    const slot = screen.getByRole('region', { name: 'Emplacement du brief technique' })
    const sources = screen.getByText(/Voir les sources/)
    expect(questionsTitle.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slot.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the technical brief slot even without questions', () => {
    renderModal({ preparation: buildPreparation({ questions: null }) })
    expect(screen.getByRole('region', { name: 'Emplacement du brief technique' })).toBeInTheDocument()
  })

  it('boxes the key figures and key dates above the rest of the brief', () => {
    renderModal()
    const keyFigures = screen.getByRole('region', { name: 'Chiffres clés' })
    const keyDates = screen.getByRole('region', { name: 'Dates clés' })
    expect(keyFigures).toHaveTextContent('CA : 1 Md€')
    expect(keyDates).toHaveTextContent('2024 : fusion')
    const restOfBrief = screen.getByText(/Croissance/)
    expect(keyFigures.compareDocumentPosition(restOfBrief) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(restOfBrief.textContent).not.toContain('CA : 1 Md€')
  })

  it('boxes every highlight when a heading is repeated, without a duplicate key warning', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const preparation = buildPreparation()
    renderModal({
      preparation: {
        ...preparation,
        brief: preparation.brief && { ...preparation.brief, markdown: '## Chiffres clés\n\nCA\n\n## Chiffres clés\n\nEffectif' },
      },
    })
    expect(screen.getAllByRole('region', { name: 'Chiffres clés' })).toHaveLength(2)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('numbers the interview questions', () => {
    renderModal()
    const questionList = screen.getByRole('list', { name: 'Questions à poser en entretien' })
    expect(questionList.tagName).toBe('OL')
    const questionItems = within(questionList).getAllByRole('listitem')
    expect(questionItems.map((questionItem) => questionItem.textContent)).toEqual([
      'Pourquoi nous ?',
      'Quelle architecture ?',
    ])
  })

  it('folds the sources by default and unfolds them on click', async () => {
    renderModal()
    const sourceLink = screen.getByRole('link', { name: 'Rapport annuel', hidden: true })
    expect(sourceLink).not.toBeVisible()
    await userEvent.click(screen.getByText('Voir les sources (2)'))
    expect(sourceLink).toBeVisible()
    expect(sourceLink).toHaveAttribute('target', '_blank')
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows a source with a non web url as plain text', () => {
    renderModal()
    expect(screen.getByText('Source piégée')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Source piégée', hidden: true })).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose } = renderModal()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('tells to ask the intermediary and offers no notes when the client is unknown', () => {
    renderModal({
      preparation: buildPreparation({ endClientId: null, endClientName: null, brief: null, notes: null }),
    })
    expect(screen.getByText("Client inconnu, demande-le à l'intermédiaire.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Mes notes sur l'entreprise")).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Questions à poser en entretien' })).toBeInTheDocument()
  })

  it('offers to generate the missing questions when a Claude key exists', async () => {
    const { onGenerateMissingPart } = renderModal({ preparation: buildPreparation({ questions: null }) })
    expect(screen.queryByRole('heading', { name: 'Questions à poser en entretien' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Générer les questions' }))
    expect(onGenerateMissingPart).toHaveBeenCalledTimes(1)
  })

  it('does not offer to generate the questions when they exist', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: 'Générer les questions' })).not.toBeInTheDocument()
  })

  it('does not offer to generate the questions without a Claude key', () => {
    renderModal({ preparation: buildPreparation({ questions: null }), hasAnthropicApiKey: false })
    expect(screen.queryByRole('button', { name: 'Générer les questions' })).not.toBeInTheDocument()
  })

  it('offers to generate the missing brief only when the client is known', async () => {
    const { onGenerateMissingPart } = renderModal({ preparation: buildPreparation({ brief: null }) })
    await userEvent.click(screen.getByRole('button', { name: 'Générer le brief' }))
    expect(onGenerateMissingPart).toHaveBeenCalledTimes(1)
  })

  it('does not offer to generate the brief when the client is unknown or the brief exists', () => {
    renderModal({ preparation: buildPreparation({ endClientId: null, endClientName: null, brief: null }) })
    expect(screen.queryByRole('button', { name: 'Générer le brief' })).not.toBeInTheDocument()
  })

  it('shows the progress label on the generation button and disables it while generating', () => {
    renderModal({
      preparation: buildPreparation({ questions: null }),
      generationProgressLabel: 'Génération des questions…',
    })
    expect(screen.getAllByRole('button', { name: 'Génération des questions…' })[0]).toBeDisabled()
  })

  it('asks the language before regenerating', async () => {
    const { onRegenerate } = renderModal()
    await userEvent.selectOptions(screen.getByLabelText('Langue de la régénération'), 'en')
    await userEvent.click(screen.getByRole('button', { name: 'Régénérer' }))
    expect(onRegenerate).toHaveBeenCalledWith('en')
  })

  it('disables the regeneration without a Claude key or while generating', () => {
    renderModal({ hasAnthropicApiKey: false })
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeDisabled()
  })

  it('shows the generation progress given by the caller and the error message', () => {
    renderModal({
      generationProgressLabel: 'Génération des questions…',
      errorMessage: "Claude n'a pas répondu à temps, réessaie.",
    })
    expect(screen.getByRole('button', { name: 'Génération des questions…' })).toBeDisabled()
    expect(screen.getByLabelText('Langue de la régénération')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent("Claude n'a pas répondu à temps, réessaie.")
  })
})
