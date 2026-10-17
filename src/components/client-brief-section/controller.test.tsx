import { act, render, renderHook, screen } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import type Markdown from 'react-markdown'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { EndClientBrief, GeneratedClientBrief } from '@/domain/client-brief'
import { ClientBriefSection } from './client-brief-section'
import { useController } from './controller'

type MarkdownProps = ComponentProps<typeof Markdown>

const mockedMarkdownRenderer = jest.fn((markdownProps: MarkdownProps): ReactElement => (
  <div data-testid="brief-markdown">{markdownProps.children}</div>
))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (markdownProps: MarkdownProps) => mockedMarkdownRenderer(markdownProps),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS = 800
const TIMEOUT_MESSAGE = "Claude n'a pas répondu à temps, réessaie."

const previousBrief: GeneratedClientBrief = {
  markdown: '## Enjeux\n\nAncien brief',
  sources: [{ title: 'Ancienne source', url: 'https://example.com/old' }],
  generatedAt: new Date('2026-09-01T08:00:00Z'),
}

const freshBrief: GeneratedClientBrief = {
  markdown: '## Enjeux\n\nNouveau brief',
  sources: [{ title: 'Rapport annuel', url: 'https://example.com/report' }],
  generatedAt: new Date('2026-10-17T09:15:00Z'),
}

const buildEndClientBrief = (overrides: Partial<EndClientBrief> = {}): EndClientBrief => ({
  endClientId: END_CLIENT_ID,
  notes: null,
  brief: null,
  ...overrides,
})

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const renderClientBriefController = ({
  endClientBrief = buildEndClientBrief(),
  generateResult = { ok: true, data: freshBrief },
  hasAnthropicApiKey = true,
}: {
  endClientBrief?: EndClientBrief | null
  generateResult?: ActionResult<GeneratedClientBrief>
  hasAnthropicApiKey?: boolean
} = {}) => {
  const generateBriefForEndClient = jest.fn().mockResolvedValue(generateResult)
  const updateEndClientNotes = jest.fn().mockResolvedValue({ ok: true, data: null })
  const onDataChanged = jest.fn()
  const renderedHook = renderHook(() =>
    useController({ endClientBrief, generateBriefForEndClient, updateEndClientNotes, hasAnthropicApiKey, onDataChanged }),
  )
  return { ...renderedHook, generateBriefForEndClient, updateEndClientNotes, onDataChanged }
}

const renderClientBriefSection = (endClientBrief: EndClientBrief | null, hasAnthropicApiKey = true) =>
  render(
    <ClientBriefSection
      endClientBrief={endClientBrief}
      endClientLabel={endClientBrief === null ? null : 'BNP Paribas Real Estate (BNP Paribas)'}
      generateBriefForEndClient={jest.fn()}
      updateEndClientNotes={jest.fn()}
      hasAnthropicApiKey={hasAnthropicApiKey}
    />,
  )

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('client-brief-section useController', () => {
  it('reports an unknown client and never generates a brief for it', async () => {
    const { result, generateBriefForEndClient } = renderClientBriefController({ endClientBrief: null })
    expect(result.current.state).toBe('unknown_client')
    await act(() => result.current.generate())
    expect(generateBriefForEndClient).not.toHaveBeenCalled()
  })

  it('never generates a brief without a Claude key', async () => {
    const { result, generateBriefForEndClient } = renderClientBriefController({ hasAnthropicApiKey: false })
    await act(() => result.current.generate())
    expect(generateBriefForEndClient).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  it('calls the generation only once when generate is clicked twice during the slow generation', async () => {
    const { result, generateBriefForEndClient } = renderClientBriefController()
    const deferredGeneration = createDeferred<ActionResult<GeneratedClientBrief>>()
    generateBriefForEndClient.mockReturnValueOnce(deferredGeneration.promise)

    let firstGeneration: Promise<void> = Promise.resolve()
    act(() => {
      firstGeneration = result.current.generate()
    })
    expect(result.current.isGenerating).toBe(true)
    expect(result.current.state).toBe('generating')
    await act(() => result.current.generate())

    await act(async () => {
      deferredGeneration.resolve({ ok: true, data: freshBrief })
      await firstGeneration
    })
    expect(generateBriefForEndClient).toHaveBeenCalledTimes(1)
    expect(generateBriefForEndClient).toHaveBeenCalledWith(END_CLIENT_ID)
    expect(result.current.isGenerating).toBe(false)
  })

  it('shows the generated markdown, sources and generation date, then refreshes the page data', async () => {
    const { result, onDataChanged } = renderClientBriefController()
    expect(result.current.state).toBe('no_brief')
    await act(() => result.current.generate())
    expect(result.current.state).toBe('brief_available')
    expect(result.current.brief).toEqual(freshBrief)
    expect(result.current.errorMessage).toBeNull()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('shows the ai error and keeps the previous brief when the generation fails', async () => {
    const { result, onDataChanged } = renderClientBriefController({
      endClientBrief: buildEndClientBrief({ brief: previousBrief }),
      generateResult: { ok: false, errorMessage: TIMEOUT_MESSAGE },
    })
    await act(() => result.current.generate())
    expect(result.current.errorMessage).toBe(TIMEOUT_MESSAGE)
    expect(result.current.brief).toEqual(previousBrief)
    expect(result.current.state).toBe('brief_available')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error when the generation action throws', async () => {
    const { result, generateBriefForEndClient } = renderClientBriefController()
    generateBriefForEndClient.mockRejectedValueOnce(new Error('network down'))
    await act(() => result.current.generate())
    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    expect(result.current.isGenerating).toBe(false)
  })

  it('saves the notes after 800 ms without typing', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes, onDataChanged } = renderClientBriefController({
      endClientBrief: buildEndClientBrief({ notes: 'Déjà noté' }),
    })
    expect(result.current.notes).toBe('Déjà noté')

    act(() => result.current.changeNotes('Parler du projet'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS - 1))
    act(() => result.current.changeNotes('Parler du projet Kafka'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS - 1))
    expect(updateEndClientNotes).not.toHaveBeenCalled()
    expect(result.current.notesSaveStatus).toBe('unsaved')

    await act(() => jest.advanceTimersByTimeAsync(1))
    expect(updateEndClientNotes).toHaveBeenCalledTimes(1)
    expect(updateEndClientNotes).toHaveBeenCalledWith(END_CLIENT_ID, 'Parler du projet Kafka')
    expect(result.current.notesSaveStatus).toBe('saved')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('saves the pending notes right away when the section unmounts', async () => {
    jest.useFakeTimers()
    const { result, unmount, updateEndClientNotes } = renderClientBriefController()
    act(() => result.current.changeNotes('Dernière idée'))
    unmount()
    await jest.advanceTimersByTimeAsync(0)
    expect(updateEndClientNotes).toHaveBeenCalledWith(END_CLIENT_ID, 'Dernière idée')
  })

  it('warns before leaving the page while notes are not saved yet', () => {
    jest.useFakeTimers()
    const { result } = renderClientBriefController()
    act(() => result.current.changeNotes('Pas encore enregistré'))
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadEvent)
    expect(beforeUnloadEvent.defaultPrevented).toBe(true)
  })

  it('sends notes saves one after the other and ignores the response of an outdated save', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderClientBriefController()
    const deferredFirstSave = createDeferred<ActionResult<null>>()
    updateEndClientNotes.mockReturnValueOnce(deferredFirstSave.promise)

    act(() => result.current.changeNotes('Première version'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    act(() => result.current.changeNotes('Deuxième version'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(updateEndClientNotes).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferredFirstSave.resolve({ ok: false, errorMessage: 'Échec ancien' })
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(updateEndClientNotes).toHaveBeenCalledTimes(2)
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'Deuxième version')
    expect(result.current.notesSaveStatus).toBe('saved')
    expect(result.current.notesErrorMessage).toBeNull()
  })

  it('shows the error when the latest notes save fails', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderClientBriefController()
    updateEndClientNotes.mockRejectedValueOnce(new Error('network down'))
    act(() => result.current.changeNotes('Notes'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(result.current.notesSaveStatus).toBe('failed')
    expect(result.current.notesErrorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
  })
  it('keeps failed notes pending so leaving warns and a retry sends them again', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderClientBriefController()
    updateEndClientNotes.mockResolvedValueOnce({ ok: false, errorMessage: 'Impossible' })
    act(() => result.current.changeNotes('Notes importantes'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(result.current.notesSaveStatus).toBe('failed')

    const beforeUnloadAfterFailure = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadAfterFailure)
    expect(beforeUnloadAfterFailure.defaultPrevented).toBe(true)

    await act(async () => {
      result.current.retryNotesSave()
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(updateEndClientNotes).toHaveBeenCalledTimes(2)
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'Notes importantes')
    expect(result.current.notesSaveStatus).toBe('saved')

    const beforeUnloadAfterRetry = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadAfterRetry)
    expect(beforeUnloadAfterRetry.defaultPrevented).toBe(false)
  })

  it('sends failed notes again with the next edit', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderClientBriefController()
    updateEndClientNotes.mockResolvedValueOnce({ ok: false, errorMessage: 'Impossible' })
    act(() => result.current.changeNotes('Version'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    act(() => result.current.changeNotes('Version corrigée'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'Version corrigée')
    expect(result.current.notesSaveStatus).toBe('saved')
  })

  it('saves failed notes again when the section unmounts', async () => {
    jest.useFakeTimers()
    const { result, unmount, updateEndClientNotes } = renderClientBriefController()
    updateEndClientNotes.mockResolvedValueOnce({ ok: false, errorMessage: 'Impossible' })
    act(() => result.current.changeNotes('À ne pas perdre'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    unmount()
    await jest.advanceTimersByTimeAsync(0)
    expect(updateEndClientNotes).toHaveBeenCalledTimes(2)
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'À ne pas perdre')
  })
})

describe('ClientBriefSection', () => {
  it('asks to get the client name from the intermediary and offers no generation when the client is unknown', () => {
    renderClientBriefSection(null)
    expect(screen.getByText("Client inconnu, demande-le à l'intermédiaire")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /brief/i })).not.toBeInTheDocument()
  })

  it('disables the generation without a Claude key, points to the settings and keeps the notes editable', () => {
    renderClientBriefSection(buildEndClientBrief({ brief: previousBrief }), false)
    expect(screen.getByRole('button', { name: 'Régénérer le brief' })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent(
      'Ajoute ta clé Claude dans les réglages pour activer la génération du brief client.',
    )
    expect(screen.getByRole('link', { name: 'réglages' })).toHaveAttribute('href', '/settings')
    expect(screen.getByTestId('brief-markdown')).toHaveTextContent('Ancien brief')
    expect(screen.getByLabelText('Mes notes sur ce client')).toBeEnabled()
  })

  it('shows no key notice for an unknown client', () => {
    renderClientBriefSection(null, false)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('renders the brief as markdown without raw html, with its sources and generation date', () => {
    renderClientBriefSection(buildEndClientBrief({ brief: freshBrief }))
    expect(screen.getByTestId('brief-markdown')).toHaveTextContent('Nouveau brief')
    const markdownProps = mockedMarkdownRenderer.mock.calls[0][0]
    expect(markdownProps.skipHtml).toBe(true)
    expect(markdownProps.urlTransform?.('javascript:alert(1)', 'href', { type: 'element', tagName: 'a', properties: {}, children: [] })).toBe('')

    const sourceLink = screen.getByRole('link', { name: 'Rapport annuel' })
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/report')
    expect(sourceLink).toHaveAttribute('target', '_blank')
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(/Généré le 17\/10\/2026 11:15/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Régénérer le brief' })).toBeEnabled()
  })

  it('opens the links of the brief in a new tab without giving it access to the page', () => {
    renderClientBriefSection(buildEndClientBrief({ brief: freshBrief }))
    const LinkRenderer = mockedMarkdownRenderer.mock.calls[0][0].components?.a
    if (typeof LinkRenderer !== 'function') throw new Error('Expected a custom link renderer')
    render(<LinkRenderer href="https://example.com/news">Actualité</LinkRenderer>)
    const briefLink = screen.getByRole('link', { name: 'Actualité' })
    expect(briefLink).toHaveAttribute('target', '_blank')
    expect(briefLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows a brief link whose url was rejected as plain text', () => {
    renderClientBriefSection(buildEndClientBrief({ brief: freshBrief }))
    const LinkRenderer = mockedMarkdownRenderer.mock.calls[0][0].components?.a
    if (typeof LinkRenderer !== 'function') throw new Error('Expected a custom link renderer')
    render(<LinkRenderer href="">Lien piégé</LinkRenderer>)
    expect(screen.getByText('Lien piégé')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Lien piégé' })).not.toBeInTheDocument()
  })

  it('shows a source with a non web url as plain text', () => {
    renderClientBriefSection(
      buildEndClientBrief({
        brief: { ...freshBrief, sources: [{ title: 'Source piégée', url: 'javascript:alert(1)' }] },
      }),
    )
    expect(screen.getByText('Source piégée')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Source piégée' })).not.toBeInTheDocument()
  })
})
