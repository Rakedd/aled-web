import { act, renderHook } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { BriefLanguage, InterviewPreparation } from '@/domain/interview-preparation'
import { useController } from './controller'

const JOB_APPLICATION_ID = '4f1e0a52-1b3c-4d5e-8f60-71829304a5b6'
const END_CLIENT_ID = '0b7c2d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d'
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
  const onDataChanged = jest.fn()
  const renderedHook = renderHook(() =>
    useController({
      jobApplicationId: JOB_APPLICATION_ID,
      initialPreparation,
      getInterviewPreparation,
      generateInterviewPreparation,
      hasAnthropicApiKey,
      onDataChanged,
    }),
  )
  return { ...renderedHook, getInterviewPreparation, generateInterviewPreparation, onDataChanged }
}

beforeEach(() => {
  jest.clearAllMocks()
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
    it('keeps the saved notes when the modal is opened again', async () => {
      const { result } = renderPreparationController({
        initialPreparation: buildPreparation({ brief: briefOf('fr'), questions: questionsOf('fr') }),
      })
      act(() => result.current.handleNotesSaved('Parler de Kafka'))
      expect(result.current.preparation.notes).toBe('Parler de Kafka')
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
