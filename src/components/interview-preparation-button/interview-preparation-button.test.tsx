import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactElement } from 'react'
import type Markdown from 'react-markdown'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import { requestTechnicalBriefGeneration } from '@/lib/technical-brief/request-technical-brief-generation'
import { InterviewPreparationButton } from './interview-preparation-button'

type MarkdownProps = ComponentProps<typeof Markdown>

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (markdownProps: MarkdownProps): ReactElement => <div data-testid="brief-markdown">{markdownProps.children}</div>,
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/technical-brief/request-technical-brief-generation', () => ({
  requestTechnicalBriefGeneration: jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_unreadable' } }),
}))

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

const buildPreparation = (overrides: Partial<InterviewPreparation> = {}): InterviewPreparation => ({
  language: 'fr',
  endClientId: '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d',
  endClientName: 'BNP Paribas',
  brief: null,
  questions: null,
  notes: null,
  lastUsedLanguage: null,
  ...overrides,
})

const completePreparation = buildPreparation({
  brief: { language: 'fr', markdown: 'Contenu du brief', sources: [], generatedAt: new Date('2026-10-17T09:15:00Z') },
  questions: { language: 'fr', questions: ['Pourquoi nous ?'], generatedAt: new Date('2026-10-17T09:15:00Z') },
})

const renderButton = (initialPreparation: InterviewPreparation, hasAnthropicApiKey = true) => {
  const generateInterviewPreparation = jest.fn().mockResolvedValue({ ok: true, data: completePreparation })
  const getInterviewPreparation = jest
    .fn()
    .mockImplementation(async (_id: string, language: BriefLanguage) => ({
      ok: true,
      data: buildPreparation({ language }),
    }))
  const getTechnicalBriefView = jest.fn().mockImplementation(async (_id: string, language: BriefLanguage) => ({
    ok: true,
    data: { language, availability: 'ready', brief: null, isCvOutdated: false },
  }))
  render(
    <InterviewPreparationButton
      jobApplicationId={JOB_APPLICATION_ID}
      initialPreparation={initialPreparation}
      getInterviewPreparation={getInterviewPreparation}
      generateInterviewPreparation={generateInterviewPreparation}
      updateEndClientNotes={jest.fn().mockResolvedValue({ ok: true, data: null })}
      getTechnicalBriefView={getTechnicalBriefView}
      hasAnthropicApiKey={hasAnthropicApiKey}
    />,
  )
  return { generateInterviewPreparation, getInterviewPreparation, getTechnicalBriefView }
}

describe('InterviewPreparationButton', () => {
  it('shows the technical brief button under the preparation button and follows the language change', async () => {
    const { getTechnicalBriefView } = renderButton(completePreparation)
    const preparationButton = screen.getByRole('button', { name: 'Brief généré · voir mon brief' })
    const technicalBriefButton = screen.getByRole('button', { name: 'Brief technique · voir' })
    expect(preparationButton.compareDocumentPosition(technicalBriefButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(technicalBriefButton)
    await waitFor(() => expect(getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr'))
    await userEvent.selectOptions(screen.getByLabelText('Langue du brief'), 'en')
    await waitFor(() => expect(getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'en'))
  })

  it('keeps both brief buttons in one row, full width on phone and natural width from sm', () => {
    renderButton(completePreparation)
    const preparationButton = screen.getByRole('button', { name: 'Brief généré · voir mon brief' })
    const technicalBriefButton = screen.getByRole('button', { name: 'Brief technique · voir' })
    expect(technicalBriefButton.parentElement).toBe(preparationButton.parentElement)
    expect(preparationButton.parentElement).toHaveClass('flex-wrap')
    expect(preparationButton).toHaveClass('flex-1', 'sm:flex-none')
    expect(technicalBriefButton).toHaveClass('w-full', 'sm:w-auto')
  })

  it('paints the brief button with the lilac panel action token so it stands out in both themes', () => {
    renderButton(completePreparation)
    const preparationButton = screen.getByRole('button', { name: 'Brief généré · voir mon brief' })
    expect(preparationButton).toHaveClass('bg-lilac-panel-action', 'text-on-lilac-panel-action')
    expect(preparationButton).not.toHaveClass('bg-deep-surface')
  })

  it('does not show the technical brief inside the preparation modal', async () => {
    renderButton(completePreparation)
    await userEvent.click(screen.getByRole('button', { name: 'Brief généré · voir mon brief' }))
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Préparer mon pitch' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: "Préparation d'entretien" })).toBeInTheDocument()
  })

  it('generates the technical brief through the route handler fetch, not a server action', async () => {
    renderButton(completePreparation)
    await userEvent.click(screen.getByRole('button', { name: 'Brief technique · voir' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    expect(requestTechnicalBriefGeneration).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr')
  })

  it('generates the preparation then shows it in the modal', async () => {
    const { generateInterviewPreparation } = renderButton(buildPreparation())
    await userEvent.click(screen.getByRole('button', { name: 'Générer le brief' }))
    expect(generateInterviewPreparation).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr', false)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('brief-markdown')).toHaveTextContent('Contenu du brief')
  })

  it('opens the modal of an existing preparation and gives the focus back to the button on Escape', async () => {
    renderButton(completePreparation)
    const openingButton = screen.getByRole('button', { name: 'Brief généré · voir mon brief' })
    await userEvent.click(openingButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openingButton).toHaveFocus()
  })

  it('gives the focus back to the button after a generation opened the modal', async () => {
    renderButton(buildPreparation())
    await userEvent.click(screen.getByRole('button', { name: 'Générer le brief' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Brief généré · voir mon brief' })).toHaveFocus()
  })

  it('offers French and English, preselected on the loaded language, and reloads on change', async () => {
    const { getInterviewPreparation } = renderButton(buildPreparation({ language: 'en' }))
    const languageSelect = screen.getByLabelText('Langue du brief')
    expect(languageSelect).toHaveValue('en')
    expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument()
    await userEvent.selectOptions(languageSelect, 'fr')
    expect(getInterviewPreparation).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr')
  })

  it('lets the user read an existing brief without its questions and without a Claude key', async () => {
    const { generateInterviewPreparation } = renderButton(buildPreparation({ brief: completePreparation.brief }), false)
    await userEvent.click(screen.getByRole('button', { name: 'Générer le brief' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('brief-markdown')).toHaveTextContent('Contenu du brief')
    expect(screen.getByRole('button', { name: 'Régénérer' })).toBeDisabled()
    expect(generateInterviewPreparation).not.toHaveBeenCalled()
  })

  it('shows the existing brief and the error in the modal when the missing questions cannot be generated', async () => {
    const { generateInterviewPreparation } = renderButton(buildPreparation({ brief: completePreparation.brief }))
    generateInterviewPreparation.mockResolvedValueOnce({
      ok: false,
      errorMessage: 'La génération des questions a échoué, réessaie.',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Générer le brief' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('brief-markdown')).toHaveTextContent('Contenu du brief')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('La génération des questions a échoué, réessaie.')
  })

  it('points to the settings and disables the generation without a Claude key', () => {
    renderButton(buildPreparation(), false)
    expect(screen.getByRole('button', { name: 'Générer le brief' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'préférences' })).toHaveAttribute('href', '/preferences')
  })
})
