import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { TechnicalBriefGenerationOutcome, TechnicalBriefView } from '@/domain/technical-brief'
import { TechnicalBriefButton } from './technical-brief-button'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const PROGRESS_LABEL = "Préparation de ton pitch… (jusqu'à 2 min)"

const buildView = (language: BriefLanguage): TechnicalBriefView => ({
  language,
  availability: 'ready',
  brief: null,
  isCvOutdated: false,
})

type Deferred<Value> = { promise: Promise<Value>; resolve: (value: Value) => void }

const createDeferred = <Value,>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const renderButton = (generateTechnicalBrief = jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_unreadable' } })) => {
  const getTechnicalBriefView = jest
    .fn()
    .mockImplementation(async (_id: string, language: BriefLanguage) => ({ ok: true, data: buildView(language) }))
  const renderProps = {
    jobApplicationId: JOB_APPLICATION_ID,
    language: 'fr' as BriefLanguage,
    hasAnthropicApiKey: true,
    getTechnicalBriefView,
    generateTechnicalBrief,
  }
  const rendering = render(<TechnicalBriefButton {...renderProps} />)
  return { getTechnicalBriefView, generateTechnicalBrief, rendering, renderProps }
}

describe('TechnicalBriefButton', () => {
  it('shows an outline button that opens a dialog titled Brief technique with the brief', async () => {
    renderButton()
    const openingButton = screen.getByRole('button', { name: 'Brief technique · voir' })
    expect(openingButton).toHaveClass('border-input', 'bg-card')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(openingButton)
    expect(screen.getByRole('dialog', { name: 'Brief technique' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Préparer mon pitch' })).toBeInTheDocument()
  })

  it('gives the focus back to the button when the dialog closes', async () => {
    renderButton()
    const openingButton = screen.getByRole('button', { name: 'Brief technique · voir' })
    await userEvent.click(openingButton)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openingButton).toHaveFocus()
  })

  it('loads the view once across several opens', async () => {
    const { getTechnicalBriefView } = renderButton()
    await waitFor(() => expect(getTechnicalBriefView).toHaveBeenCalledTimes(1))
    for (let openCount = 0; openCount < 3; openCount += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Brief technique · voir' }))
      await screen.findByRole('button', { name: 'Préparer mon pitch' })
      await userEvent.keyboard('{Escape}')
    }
    expect(getTechnicalBriefView).toHaveBeenCalledTimes(1)
  })

  it('shows the progress label on the button while generating and keeps it clickable', async () => {
    const generation = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    renderButton(jest.fn().mockReturnValue(generation.promise))
    await userEvent.click(screen.getByRole('button', { name: 'Brief technique · voir' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    await userEvent.keyboard('{Escape}')
    const progressButton = screen.getByRole('button', { name: PROGRESS_LABEL })
    expect(progressButton).toBeEnabled()
    generation.resolve({ ok: true, data: { kind: 'cv_unreadable' } })
    expect(await screen.findByRole('button', { name: 'Brief technique · voir' })).toBeInTheDocument()
  })

  it('shows the progress again after closing during a generation and never starts a second one', async () => {
    const generation = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    const { generateTechnicalBrief } = renderButton(jest.fn().mockReturnValue(generation.promise))
    await userEvent.click(screen.getByRole('button', { name: 'Brief technique · voir' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer mon pitch' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: PROGRESS_LABEL }))
    const dialog = screen.getByRole('dialog', { name: 'Brief technique' })
    expect(dialog).toHaveTextContent(PROGRESS_LABEL)
    expect(screen.queryByRole('button', { name: 'Préparer mon pitch' })).not.toBeInTheDocument()
    expect(generateTechnicalBrief).toHaveBeenCalledTimes(1)
    generation.resolve({ ok: true, data: { kind: 'cv_unreadable' } })
    expect(await screen.findByText(/Impossible de lire ce CV/)).toBeInTheDocument()
    expect(generateTechnicalBrief).toHaveBeenCalledTimes(1)
  })

  it('reloads the view when the language changes', async () => {
    const { getTechnicalBriefView, rendering, renderProps } = renderButton()
    await waitFor(() => expect(getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr'))
    rendering.rerender(<TechnicalBriefButton {...renderProps} language="en" />)
    await waitFor(() => expect(getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'en'))
  })
})
