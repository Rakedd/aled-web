import { act, renderHook } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import { useController } from './controller'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
const NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS = 800
const GENERATION_LABEL = "Génération… (jusqu'à 4 min)"
const TIMEOUT_MESSAGE = "Claude n'a pas répondu à temps, réessaie."

const briefOf = (language: BriefLanguage) => ({
  language,
  markdown: `Brief ${language}`,
  sources: [],
  generatedAt: new Date('2026-10-17T09:15:00Z'),
})
const questionsOf = (language: BriefLanguage) => ({
  language,
  questions: [`Question ${language}`],
  generatedAt: new Date('2026-10-17T09:15:00Z'),
})

const buildPreparation = (overrides: Partial<InterviewPreparation> = {}): InterviewPreparation => ({
  language: 'fr',
  endClientId: END_CLIENT_ID,
  endClientName: 'BNP Paribas',
  brief: null,
  questions: null,
  notes: null,
  lastUsedLanguage: null,
  ...overrides,
})

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const renderPreparationController = ({
  initialPreparation = buildPreparation(),
  hasAnthropicApiKey = true,
}: { initialPreparation?: InterviewPreparation; hasAnthropicApiKey?: boolean } = {}) => {
  const generatedPreparation = buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') })
  const getInterviewPreparation = jest
    .fn<Promise<ActionResult<InterviewPreparation>>, [string, BriefLanguage]>()
    .mockImplementation(async (_jobApplicationId, language) => ({
      ok: true,
      data: buildPreparation({ language, brief: briefOf(language), questions: questionsOf(language) }),
    }))
  const generateInterviewPreparation = jest
    .fn<Promise<ActionResult<InterviewPreparation>>, [string, BriefLanguage, boolean]>()
    .mockResolvedValue({ ok: true, data: generatedPreparation })
  const updateEndClientNotes = jest.fn().mockResolvedValue({ ok: true, data: null })
  const onDataChanged = jest.fn()
  const renderedHook = renderHook(() =>
    useController({
      jobApplicationId: JOB_APPLICATION_ID,
      initialPreparation,
      getInterviewPreparation,
      generateInterviewPreparation,
      updateEndClientNotes,
      hasAnthropicApiKey,
      onDataChanged,
    }),
  )
  return { ...renderedHook, getInterviewPreparation, generateInterviewPreparation, updateEndClientNotes, onDataChanged }
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('interview-preparation-button useController', () => {
  describe('button label', () => {
    it('offers to generate when nothing exists yet', () => {
      const { result } = renderPreparationController()
      expect(result.current.buttonLabel).toBe('Générer le brief')
    })

    it('offers to generate when only the brief exists', () => {
      const { result } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr') }),
      })
      expect(result.current.buttonLabel).toBe('Générer le brief')
    })

    it('offers to generate when only the questions exist for a known client', () => {
      const { result } = renderPreparationController({
        initialPreparation: buildPreparation({ questions: questionsOf('fr') }),
      })
      expect(result.current.buttonLabel).toBe('Générer le brief')
    })

    it('offers to view the preparation when only questions exist and the client is unknown', () => {
      const { result } = renderPreparationController({
        initialPreparation: buildPreparation({
          endClientId: null,
          endClientName: null,
          questions: questionsOf('fr'),
        }),
      })
      expect(result.current.buttonLabel).toBe('Brief généré · voir mon brief')
    })

    it('offers to view the preparation when the brief and the questions exist', () => {
      const { result } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      expect(result.current.buttonLabel).toBe('Brief généré · voir mon brief')
    })
  })

  describe('generation', () => {
    it('generates only once when the button is clicked twice during the slow generation', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController()
      const deferredGeneration = createDeferred<ActionResult<InterviewPreparation>>()
      generateInterviewPreparation.mockReturnValueOnce(deferredGeneration.promise)

      let firstClick: Promise<void> = Promise.resolve()
      act(() => {
        firstClick = result.current.handleButtonClick()
      })
      expect(result.current.isGenerating).toBe(true)
      expect(result.current.buttonLabel).toBe(GENERATION_LABEL)
      await act(() => result.current.handleButtonClick())

      await act(async () => {
        deferredGeneration.resolve({ ok: true, data: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }) })
        await firstClick
      })
      expect(generateInterviewPreparation).toHaveBeenCalledTimes(1)
      expect(generateInterviewPreparation).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'fr', false)
      expect(result.current.isGenerating).toBe(false)
    })

    it('shows the generated preparation, opens the modal and refreshes the page data', async () => {
      const { result, onDataChanged } = renderPreparationController()
      await act(() => result.current.handleButtonClick())
      expect(result.current.preparation.brief).toEqual(briefOf('fr'))
      expect(result.current.buttonLabel).toBe('Brief généré · voir mon brief')
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.errorMessage).toBeNull()
      expect(onDataChanged).toHaveBeenCalledTimes(1)
    })

    it('opens the modal without generating when the preparation is complete', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      await act(() => result.current.handleButtonClick())
      expect(result.current.isModalOpen).toBe(true)
      expect(generateInterviewPreparation).not.toHaveBeenCalled()
    })

    it('shows the message of the ai error and keeps the modal closed', async () => {
      const { result, generateInterviewPreparation, onDataChanged } = renderPreparationController()
      generateInterviewPreparation.mockResolvedValueOnce({ ok: false, errorMessage: TIMEOUT_MESSAGE })
      await act(() => result.current.handleButtonClick())
      expect(result.current.errorMessage).toBe(TIMEOUT_MESSAGE)
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.isGenerating).toBe(false)
      expect(onDataChanged).not.toHaveBeenCalled()
    })

    it('shows the generic error when the generation action throws', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController()
      generateInterviewPreparation.mockRejectedValueOnce(new Error('network down'))
      await act(() => result.current.handleButtonClick())
      expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
      expect(result.current.isGenerating).toBe(false)
    })

    it('never generates without a Claude key', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController({ hasAnthropicApiKey: false })
      expect(result.current.isButtonDisabled).toBe(true)
      await act(() => result.current.handleButtonClick())
      expect(generateInterviewPreparation).not.toHaveBeenCalled()
    })

    it('still lets the user view an existing preparation without a Claude key', () => {
      const { result } = renderPreparationController({
        hasAnthropicApiKey: false,
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      expect(result.current.isButtonDisabled).toBe(false)
    })
  })

  describe('language', () => {
    it('starts on the language of the loaded preparation', () => {
      const { result } = renderPreparationController({ initialPreparation: buildPreparation({ language: 'en' }) })
      expect(result.current.language).toBe('en')
    })

    it('reloads the preparation of the chosen language', async () => {
      const { result, getInterviewPreparation } = renderPreparationController()
      await act(() => result.current.changeLanguage('en'))
      expect(getInterviewPreparation).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'en')
      expect(result.current.language).toBe('en')
      expect(result.current.preparation.brief).toEqual(briefOf('en'))
    })

    it('goes back to the previous language and shows the error when the reload fails', async () => {
      const { result, getInterviewPreparation } = renderPreparationController()
      getInterviewPreparation.mockResolvedValueOnce({ ok: false, errorMessage: 'Chargement impossible' })
      await act(() => result.current.changeLanguage('en'))
      expect(result.current.language).toBe('fr')
      expect(result.current.errorMessage).toBe('Chargement impossible')
    })

    it('keeps only the answer of the latest language choice', async () => {
      const { result, getInterviewPreparation } = renderPreparationController()
      const deferredEnglish = createDeferred<ActionResult<InterviewPreparation>>()
      getInterviewPreparation.mockReturnValueOnce(deferredEnglish.promise)
      let englishChange: Promise<void> = Promise.resolve()
      act(() => {
        englishChange = result.current.changeLanguage('en')
      })
      await act(() => result.current.changeLanguage('fr'))
      await act(async () => {
        deferredEnglish.resolve({ ok: true, data: buildPreparation({ language: 'en', brief: briefOf('en') }) })
        await englishChange
      })
      expect(result.current.language).toBe('fr')
      expect(result.current.preparation.language).toBe('fr')
    })

    it('disables the button while a language reload is pending', async () => {
      const { result, getInterviewPreparation } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      const deferredReload = createDeferred<ActionResult<InterviewPreparation>>()
      getInterviewPreparation.mockReturnValueOnce(deferredReload.promise)
      let reload: Promise<void> = Promise.resolve()
      act(() => {
        reload = result.current.changeLanguage('en')
      })
      expect(result.current.isButtonDisabled).toBe(true)
      await act(async () => {
        deferredReload.resolve({ ok: true, data: buildPreparation({ language: 'en' }) })
        await reload
      })
      expect(result.current.isButtonDisabled).toBe(false)
    })

    it('does not change language while a generation is running', async () => {
      const { result, generateInterviewPreparation, getInterviewPreparation } = renderPreparationController()
      const deferredGeneration = createDeferred<ActionResult<InterviewPreparation>>()
      generateInterviewPreparation.mockReturnValueOnce(deferredGeneration.promise)
      let generation: Promise<void> = Promise.resolve()
      act(() => {
        generation = result.current.handleButtonClick()
      })
      await act(() => result.current.changeLanguage('en'))
      expect(getInterviewPreparation).not.toHaveBeenCalled()
      await act(async () => {
        deferredGeneration.resolve({ ok: true, data: buildPreparation() })
        await generation
      })
    })
  })

  describe('regeneration', () => {
    it('regenerates in the requested language with regenerate = true', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      generateInterviewPreparation.mockResolvedValueOnce({
        ok: true,
        data: buildPreparation({ language: 'en', brief: briefOf('en'), questions: questionsOf('en') }),
      })
      await act(() => result.current.regenerate('en'))
      expect(generateInterviewPreparation).toHaveBeenCalledWith(JOB_APPLICATION_ID, 'en', true)
      expect(result.current.language).toBe('en')
      expect(result.current.preparation.brief).toEqual(briefOf('en'))
    })

    it('keeps the current preparation and language when the regeneration fails', async () => {
      const { result, generateInterviewPreparation } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      generateInterviewPreparation.mockResolvedValueOnce({ ok: false, errorMessage: TIMEOUT_MESSAGE })
      await act(() => result.current.regenerate('en'))
      expect(result.current.language).toBe('fr')
      expect(result.current.preparation.brief).toEqual(briefOf('fr'))
      expect(result.current.errorMessage).toBe(TIMEOUT_MESSAGE)
    })
  })

  describe('notes', () => {
    const completeInitialPreparation = () =>
      buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr'), notes: 'Déjà noté' })

    it('starts with the saved notes', () => {
      const { result } = renderPreparationController({ initialPreparation: completeInitialPreparation() })
      expect(result.current.notes).toBe('Déjà noté')
    })

    it('saves the notes after 800 ms without typing', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController({
        initialPreparation: completeInitialPreparation(),
      })
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
    })

    it('saves the pending notes when the page is left (unmount)', async () => {
      jest.useFakeTimers()
      const { result, unmount, updateEndClientNotes } = renderPreparationController()
      act(() => result.current.changeNotes('Dernière idée'))
      unmount()
      await jest.advanceTimersByTimeAsync(0)
      expect(updateEndClientNotes).toHaveBeenCalledWith(END_CLIENT_ID, 'Dernière idée')
    })

    it('never saves notes without an end client', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController({
        initialPreparation: buildPreparation({ endClientId: null, endClientName: null }),
      })
      act(() => result.current.changeNotes('Sans client'))
      await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
      expect(updateEndClientNotes).not.toHaveBeenCalled()
    })

    it('sends saves one after the other and ignores the response of an outdated save', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController()
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
      expect(updateEndClientNotes).toHaveBeenLastCalledWith(END_CLIENT_ID, 'Deuxième version')
      expect(result.current.notesSaveStatus).toBe('saved')
      expect(result.current.notesErrorMessage).toBeNull()
    })

    it('shows the generic error when the save throws', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController()
      updateEndClientNotes.mockRejectedValueOnce(new Error('network down'))
      act(() => result.current.changeNotes('Notes'))
      await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
      expect(result.current.notesSaveStatus).toBe('failed')
      expect(result.current.notesErrorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    })

    it('keeps a save that fails after the modal closed: text and error are still there on reopening, leaving warns, retry sends it', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController({
        initialPreparation: completeInitialPreparation(),
      })
      const deferredSave = createDeferred<ActionResult<null>>()
      updateEndClientNotes.mockReturnValueOnce(deferredSave.promise)
      await act(() => result.current.handleButtonClick())
      act(() => result.current.changeNotes('Notes importantes'))
      await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
      act(() => result.current.closeModal())
      await act(async () => {
        deferredSave.resolve({ ok: false, errorMessage: 'Impossible' })
        await jest.advanceTimersByTimeAsync(0)
      })
      await act(() => result.current.handleButtonClick())
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.notes).toBe('Notes importantes')
      expect(result.current.notesSaveStatus).toBe('failed')
      expect(result.current.notesErrorMessage).toBe('Impossible')

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

    it('shows the latest local text when the modal is reopened while a save is in flight, and warns before leaving', async () => {
      jest.useFakeTimers()
      const { result, updateEndClientNotes } = renderPreparationController({
        initialPreparation: completeInitialPreparation(),
      })
      updateEndClientNotes.mockReturnValueOnce(createDeferred<ActionResult<null>>().promise)
      await act(() => result.current.handleButtonClick())
      act(() => result.current.changeNotes('Texte local récent'))
      await act(() => jest.advanceTimersByTimeAsync(NOTES_AUTOSAVE_DELAY_IN_MILLISECONDS))
      act(() => result.current.closeModal())
      await act(() => result.current.handleButtonClick())
      expect(result.current.notes).toBe('Texte local récent')
      const beforeUnloadEvent = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(beforeUnloadEvent)
      expect(beforeUnloadEvent.defaultPrevented).toBe(true)
    })

    it('keeps the local notes when the language is changed', async () => {
      const { result } = renderPreparationController({ initialPreparation: completeInitialPreparation() })
      await act(() => result.current.changeLanguage('en'))
      expect(result.current.notes).toBe('Déjà noté')
    })
  })

  it('closes the modal', async () => {
    const { result } = renderPreparationController({
      initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
    })
    await act(() => result.current.handleButtonClick())
    act(() => result.current.closeModal())
    expect(result.current.isModalOpen).toBe(false)
  })
})
