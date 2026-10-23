import { act, renderHook, waitFor } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { BriefLanguage } from '@/domain/interview-preparation'
import type { TechnicalBriefGenerationOutcome, TechnicalBriefView } from '@/domain/technical-brief'
import { useController } from './controller'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'

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

const buildParameters = (overrides: Partial<Parameters<typeof useController>[0]> = {}) => ({
  jobApplicationId: JOB_APPLICATION_ID,
  language: 'fr' as BriefLanguage,
  hasAnthropicApiKey: true,
  getTechnicalBriefView: jest
    .fn()
    .mockImplementation(async (_id: string, language: BriefLanguage) => ({ ok: true, data: buildView(language) })),
  generateTechnicalBrief: jest.fn().mockResolvedValue({ ok: true, data: { kind: 'cv_unreadable' } }),
  ...overrides,
})

const renderController = (initialProps: ReturnType<typeof buildParameters>) => {
  const rendered = renderHook((props: ReturnType<typeof buildParameters>) => useController(props), { initialProps })
  act(() => rendered.result.current.openDialog())
  return rendered
}

describe('technical brief button controller', () => {
  it('loads the view of the current language and reloads it on a language change', async () => {
    const parameters = buildParameters()
    const { result, rerender } = renderController(parameters)
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.view?.language).toBe('fr'))
    expect(parameters.getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr')
    rerender({ ...parameters, language: 'en' })
    await waitFor(() => expect(result.current.view?.language).toBe('en'))
    expect(parameters.getTechnicalBriefView).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'en')
    expect(result.current.isLoading).toBe(false)
  })

  it('ignores the answer of a previous language', async () => {
    const slowFrenchLoad = createDeferred<ActionResult<TechnicalBriefView>>()
    const getTechnicalBriefView = jest
      .fn()
      .mockImplementationOnce(() => slowFrenchLoad.promise)
      .mockImplementation(async (_id: string, language: BriefLanguage) => ({ ok: true, data: buildView(language) }))
    const parameters = buildParameters({ getTechnicalBriefView })
    const { result, rerender } = renderController(parameters)
    rerender({ ...parameters, language: 'en' })
    await waitFor(() => expect(result.current.view?.language).toBe('en'))
    await act(async () => slowFrenchLoad.resolve({ ok: true, data: buildView('fr') }))
    expect(result.current.view?.language).toBe('en')
  })

  it('ignores a generation answer that arrives after a language change', async () => {
    const slowGeneration = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    const generateTechnicalBrief = jest.fn().mockReturnValue(slowGeneration.promise)
    const parameters = buildParameters({ generateTechnicalBrief })
    const { result, rerender } = renderController(parameters)
    await waitFor(() => expect(result.current.view?.language).toBe('fr'))
    act(() => {
      void result.current.generate()
    })
    rerender({ ...parameters, language: 'en' })
    await waitFor(() => expect(result.current.view?.language).toBe('en'))
    await act(async () =>
      slowGeneration.resolve({ ok: true, data: { kind: 'generated', view: buildView('fr') } }),
    )
    expect(result.current.view?.language).toBe('en')
    expect(result.current.isGenerating).toBe(false)
  })

  it('keeps a generation answer when the actions get a new identity during the generation', async () => {
    const slowGeneration = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    const parameters = buildParameters({ generateTechnicalBrief: jest.fn().mockReturnValue(slowGeneration.promise) })
    const { result, rerender } = renderController(parameters)
    await waitFor(() => expect(result.current.view).not.toBeNull())
    act(() => {
      void result.current.generate()
    })
    const refreshedGetTechnicalBriefView = jest.fn()
    rerender({ ...parameters, getTechnicalBriefView: refreshedGetTechnicalBriefView })
    const generatedView = { ...buildView('fr'), isCvOutdated: true }
    await act(async () => slowGeneration.resolve({ ok: true, data: { kind: 'generated', view: generatedView } }))
    expect(result.current.view).toEqual(generatedView)
    expect(refreshedGetTechnicalBriefView).not.toHaveBeenCalled()
  })

  it('sends a single generation on a double click', async () => {
    const slowGeneration = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    const generateTechnicalBrief = jest.fn().mockReturnValue(slowGeneration.promise)
    const parameters = buildParameters({ generateTechnicalBrief })
    const { result } = renderController(parameters)
    await waitFor(() => expect(result.current.view).not.toBeNull())
    act(() => {
      void result.current.generate()
      void result.current.generate()
    })
    expect(generateTechnicalBrief).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(true)
    await act(async () => slowGeneration.resolve({ ok: true, data: { kind: 'cv_unreadable' } }))
    expect(result.current.isGenerating).toBe(false)
  })

  it('keeps the cv missing information outcome until the next generation or language change', async () => {
    const generateTechnicalBrief = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: { kind: 'cv_missing_information' } })
      .mockResolvedValue({ ok: true, data: { kind: 'generated', view: buildView('fr') } })
    const parameters = buildParameters({ generateTechnicalBrief })
    const { result, rerender } = renderController(parameters)
    await waitFor(() => expect(result.current.view).not.toBeNull())
    await act(async () => result.current.generate())
    expect(result.current.transientOutcome).toBe('cv_missing_information')
    await act(async () => result.current.generate())
    expect(result.current.transientOutcome).toBeNull()
    expect(result.current.view?.language).toBe('fr')
    await act(async () => {
      generateTechnicalBrief.mockResolvedValueOnce({ ok: true, data: { kind: 'cv_unreadable' } })
      await result.current.generate()
    })
    expect(result.current.transientOutcome).toBe('cv_unreadable')
    rerender({ ...parameters, language: 'en' })
    await waitFor(() => expect(result.current.transientOutcome).toBeNull())
  })

  it('shows the action error message', async () => {
    const generateTechnicalBrief = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Clé invalide' })
    const parameters = buildParameters({ generateTechnicalBrief })
    const { result } = renderController(parameters)
    await waitFor(() => expect(result.current.view).not.toBeNull())
    await act(async () => result.current.generate())
    expect(result.current.errorMessage).toBe('Clé invalide')
  })

  it('shows the load error message when the view cannot be loaded', async () => {
    const getTechnicalBriefView = jest.fn().mockResolvedValue({ ok: false, errorMessage: 'Chargement impossible' })
    const parameters = buildParameters({ getTechnicalBriefView })
    const { result } = renderController(parameters)
    await waitFor(() => expect(result.current.errorMessage).toBe('Chargement impossible'))
    expect(result.current.view).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('does not load the view before the dialog is opened, loads it once on the first open and not on reopen', async () => {
    const parameters = buildParameters()
    const { result } = renderHook(() => useController(parameters))
    expect(parameters.getTechnicalBriefView).not.toHaveBeenCalled()
    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.view).not.toBeNull())
    act(() => result.current.closeDialog())
    act(() => result.current.openDialog())
    expect(parameters.getTechnicalBriefView).toHaveBeenCalledTimes(1)
  })

  it('announces the outcome only when the dialog is closed', async () => {
    const generation = createDeferred<ActionResult<TechnicalBriefGenerationOutcome>>()
    const parameters = buildParameters({ generateTechnicalBrief: jest.fn().mockReturnValue(generation.promise) })
    const { result } = renderController(parameters)
    await waitFor(() => expect(result.current.view).not.toBeNull())
    act(() => {
      void result.current.generate()
    })
    act(() => result.current.closeDialog())
    await act(async () => generation.resolve({ ok: true, data: { kind: 'generated', view: buildView('fr') } }))
    expect(result.current.closedDialogAnnouncement).toBe('Brief technique prêt.')
    act(() => result.current.openDialog())
    expect(result.current.closedDialogAnnouncement).toBe('')
    await act(async () => result.current.generate())
    expect(result.current.closedDialogAnnouncement).toBe('')
  })
})
