import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactElement } from 'react'
import type Markdown from 'react-markdown'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import { InterviewPreparationButton } from './interview-preparation-button'

type MarkdownProps = ComponentProps<typeof Markdown>

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (markdownProps: MarkdownProps): ReactElement => <div data-testid="brief-markdown">{markdownProps.children}</div>,
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

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
  render(
    <InterviewPreparationButton
      jobApplicationId={JOB_APPLICATION_ID}
      initialPreparation={initialPreparation}
      getInterviewPreparation={getInterviewPreparation}
      generateInterviewPreparation={generateInterviewPreparation}
      updateEndClientNotes={jest.fn().mockResolvedValue({ ok: true, data: null })}
      hasAnthropicApiKey={hasAnthropicApiKey}
    />,
  )
  return { generateInterviewPreparation, getInterviewPreparation }
}

describe('InterviewPreparationButton', () => {
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

  it('points to the settings and disables the generation without a Claude key', () => {
    renderButton(buildPreparation(), false)
    expect(screen.getByRole('button', { name: 'Générer le brief' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'réglages' })).toHaveAttribute('href', '/settings')
  })
})
