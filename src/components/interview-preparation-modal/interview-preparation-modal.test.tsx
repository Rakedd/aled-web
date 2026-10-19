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
  render(
    <InterviewPreparationModal
      isOpen
      onClose={onClose}
      preparation={buildPreparation()}
      generationProgressLabel={null}
      errorMessage={null}
      hasAnthropicApiKey
      onRegenerate={onRegenerate}
      notes="Parler de Kafka"
      changeNotes={jest.fn()}
      notesSaveStatus="idle"
      notesErrorMessage={null}
      retryNotesSave={jest.fn()}
      finalFocusRef={{ current: null }}
      {...overrides}
    />,
  )
  return { onClose, onRegenerate }
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
