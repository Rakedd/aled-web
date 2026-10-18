import { act, renderHook } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { BriefLanguage } from '@/domain/interview-preparation'
import { useController } from './controller'

const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS = 800

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const renderModalController = ({
  endClientId = END_CLIENT_ID as string | null,
  initialNotes = null as string | null,
  language = 'fr' as BriefLanguage,
} = {}) => {
  const updateEndClientNotes = jest.fn().mockResolvedValue({ ok: true, data: null })
  const onNotesSaved = jest.fn()
  const onRegenerate = jest.fn()
  const renderedHook = renderHook(() =>
    useController({ endClientId, initialNotes, language, updateEndClientNotes, onNotesSaved, onRegenerate }),
  )
  return { ...renderedHook, updateEndClientNotes, onNotesSaved, onRegenerate }
}

afterEach(() => {
  jest.useRealTimers()
})

describe('interview-preparation-modal useController', () => {
  it('starts with the saved notes', () => {
    const { result } = renderModalController({ initialNotes: 'Déjà noté' })
    expect(result.current.notes).toBe('Déjà noté')
  })

  it('regenerates in the language chosen in the modal, which starts on the current one', () => {
    const { result, onRegenerate } = renderModalController({ language: 'en' })
    expect(result.current.regenerationLanguage).toBe('en')
    act(() => result.current.changeRegenerationLanguage('fr'))
    act(() => result.current.requestRegeneration())
    expect(onRegenerate).toHaveBeenCalledWith('fr')
  })

  it('saves the notes after 800 ms without typing and tells the parent', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes, onNotesSaved } = renderModalController({ initialNotes: 'Déjà noté' })

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
    expect(onNotesSaved).toHaveBeenCalledWith('Parler du projet Kafka')
  })

  it('saves the pending notes right away when the modal closes (unmount)', async () => {
    jest.useFakeTimers()
    const { result, unmount, updateEndClientNotes } = renderModalController()
    act(() => result.current.changeNotes('Dernière idée'))
    unmount()
    await jest.advanceTimersByTimeAsync(0)
    expect(updateEndClientNotes).toHaveBeenCalledWith(END_CLIENT_ID, 'Dernière idée')
  })

  it('warns before leaving the page while notes are not saved yet', () => {
    jest.useFakeTimers()
    const { result } = renderModalController()
    act(() => result.current.changeNotes('Pas encore enregistré'))
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadEvent)
    expect(beforeUnloadEvent.defaultPrevented).toBe(true)
  })

  it('never saves notes without an end client', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderModalController({ endClientId: null })
    act(() => result.current.changeNotes('Sans client'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(updateEndClientNotes).not.toHaveBeenCalled()
  })

  it('sends notes saves one after the other and ignores the response of an outdated save', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderModalController()
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

  it('shows the generic error when the latest notes save throws', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes } = renderModalController()
    updateEndClientNotes.mockRejectedValueOnce(new Error('network down'))
    act(() => result.current.changeNotes('Notes'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(result.current.notesSaveStatus).toBe('failed')
    expect(result.current.notesErrorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
  })

  it('keeps failed notes pending so leaving warns and a retry sends them again', async () => {
    jest.useFakeTimers()
    const { result, updateEndClientNotes, onNotesSaved } = renderModalController()
    updateEndClientNotes.mockResolvedValueOnce({ ok: false, errorMessage: 'Impossible' })
    act(() => result.current.changeNotes('Notes importantes'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    expect(result.current.notesSaveStatus).toBe('failed')
    expect(onNotesSaved).not.toHaveBeenCalled()

    const beforeUnloadAfterFailure = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadAfterFailure)
    expect(beforeUnloadAfterFailure.defaultPrevented).toBe(true)

    await act(async () => {
      result.current.retryNotesSave()
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'Notes importantes')
    expect(result.current.notesSaveStatus).toBe('saved')

    const beforeUnloadAfterRetry = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnloadAfterRetry)
    expect(beforeUnloadAfterRetry.defaultPrevented).toBe(false)
  })

  it('saves failed notes again when the modal closes', async () => {
    jest.useFakeTimers()
    const { result, unmount, updateEndClientNotes } = renderModalController()
    updateEndClientNotes.mockResolvedValueOnce({ ok: false, errorMessage: 'Impossible' })
    act(() => result.current.changeNotes('À ne pas perdre'))
    await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
    unmount()
    await jest.advanceTimersByTimeAsync(0)
    expect(updateEndClientNotes).toHaveBeenCalledTimes(2)
    expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'À ne pas perdre')
  })
})
