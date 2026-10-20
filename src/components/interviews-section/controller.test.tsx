import { act, render, renderHook, screen } from '@testing-library/react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import { INTERVIEW_VALIDATION_MESSAGES, type Interview } from '@/domain/interviews'
import { useController } from './controller'
import { InterviewsSection } from './interviews-section'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const JOB_APPLICATION_ID = '6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f00'

const buildInterview = (overrides: Partial<Interview> = {}): Interview => ({
  id: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
  jobApplicationId: JOB_APPLICATION_ID,
  startsAt: new Date('2026-10-28T13:00:00Z'),
  kind: 'client',
  format: 'video',
  participants: 'Jeanne Martin',
  notes: null,
  ...overrides,
})

const laterInterview = buildInterview({ id: 'later', startsAt: new Date('2026-11-04T09:00:00Z') })
const earlierInterview = buildInterview({ id: 'earlier', startsAt: new Date('2026-10-20T08:00:00Z'), kind: 'mock' })

const createDeferred = <Value,>() => {
  let resolveDeferred: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const renderInterviewsController = (initialInterviews: Interview[] = [laterInterview, earlierInterview]) => {
  const actions = {
    createInterview: jest.fn().mockResolvedValue({ ok: true, data: { id: 'created' } }),
    updateInterview: jest.fn().mockResolvedValue({ ok: true, data: null }),
    deleteInterview: jest.fn().mockResolvedValue({ ok: true, data: null }),
    listInterviewsForJobApplication: jest.fn().mockResolvedValue({ ok: true, data: initialInterviews }),
  }
  const onDataChanged = jest.fn()
  const renderedHook = renderHook(() =>
    useController({ jobApplicationId: JOB_APPLICATION_ID, initialInterviews, ...actions, onDataChanged }),
  )
  return { ...renderedHook, ...actions, onDataChanged }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('interviews-section useController', () => {
  it('lists the interviews by ascending start', () => {
    const { result } = renderInterviewsController()
    expect(result.current.interviews.map(({ id }) => id)).toEqual(['earlier', 'later'])
  })

  it('accepts a past date to record an interview afterwards', async () => {
    const { result, createInterview, listInterviewsForJobApplication, onDataChanged } = renderInterviewsController()
    act(() => result.current.startCreating())
    act(() => result.current.setFormValue('parisLocalDateTime', '2020-01-15T09:30'))
    act(() => result.current.setFormValue('kind', 'mock'))
    act(() => result.current.setFormValue('participants', '  Paul, recruteur  '))
    await act(() => result.current.submitInterview())
    expect(createInterview).toHaveBeenCalledWith(JOB_APPLICATION_ID, {
      parisLocalDateTime: '2020-01-15T09:30',
      kind: 'mock',
      format: 'video',
      participants: 'Paul, recruteur',
      notes: null,
    })
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.editorTarget).toBeNull()
    expect(listInterviewsForJobApplication).toHaveBeenCalledWith(JOB_APPLICATION_ID)
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses an interview without a date', async () => {
    const { result, createInterview } = renderInterviewsController()
    act(() => result.current.startCreating())
    await act(() => result.current.submitInterview())
    expect(result.current.errorMessage).toBe(INTERVIEW_VALIDATION_MESSAGES.missingStartsAt)
    expect(createInterview).not.toHaveBeenCalled()
  })

  it('shows the reloaded list sorted after a change', async () => {
    const { result, listInterviewsForJobApplication } = renderInterviewsController([laterInterview])
    listInterviewsForJobApplication.mockResolvedValueOnce({ ok: true, data: [laterInterview, earlierInterview] })
    act(() => result.current.startCreating())
    act(() => result.current.setFormValue('parisLocalDateTime', '2026-10-20T10:00'))
    await act(() => result.current.submitInterview())
    expect(result.current.interviews.map(({ id }) => id)).toEqual(['earlier', 'later'])
  })

  it('prefills the form with the Paris time of the edited interview and updates it', async () => {
    const { result, updateInterview } = renderInterviewsController()
    act(() => result.current.startEditing(laterInterview))
    expect(result.current.formValues.parisLocalDateTime).toBe('2026-11-04T10:00')
    act(() => result.current.setFormValue('notes', 'Questions sur Kafka'))
    await act(() => result.current.submitInterview())
    expect(updateInterview).toHaveBeenCalledWith('later', {
      parisLocalDateTime: '2026-11-04T10:00',
      kind: 'client',
      format: 'video',
      participants: 'Jeanne Martin',
      notes: 'Questions sur Kafka',
    })
  })

  it('keeps the form open and shows the server error when the save fails', async () => {
    const { result, createInterview, onDataChanged } = renderInterviewsController()
    createInterview.mockResolvedValueOnce({ ok: false, errorMessage: 'Candidature introuvable' })
    act(() => result.current.startCreating())
    act(() => result.current.setFormValue('parisLocalDateTime', '2026-10-30T10:00'))
    await act(() => result.current.submitInterview())
    expect(result.current.errorMessage).toBe('Candidature introuvable')
    expect(result.current.editorTarget).toEqual({ mode: 'create' })
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error when an action throws', async () => {
    const { result, deleteInterview } = renderInterviewsController()
    deleteInterview.mockRejectedValueOnce(new Error('network down'))
    await act(() => result.current.removeInterview('later'))
    expect(result.current.errorMessage).toBe(GENERIC_ACTION_ERROR_MESSAGE)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('deletes an interview and refreshes the page data', async () => {
    const { result, deleteInterview, onDataChanged } = renderInterviewsController()
    await act(() => result.current.removeInterview('later'))
    expect(deleteInterview).toHaveBeenCalledWith('later')
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it('sends only one request when the form is submitted twice quickly', async () => {
    const { result, createInterview } = renderInterviewsController()
    const deferredCreation = createDeferred<ActionResult<{ id: string }>>()
    createInterview.mockReturnValueOnce(deferredCreation.promise)
    act(() => result.current.startCreating())
    act(() => result.current.setFormValue('parisLocalDateTime', '2026-10-30T10:00'))
    let firstSubmission: Promise<void> = Promise.resolve()
    act(() => {
      firstSubmission = result.current.submitInterview()
    })
    expect(result.current.isSubmitting).toBe(true)
    await act(() => result.current.submitInterview())
    await act(async () => {
      deferredCreation.resolve({ ok: true, data: { id: 'created' } })
      await firstSubmission
    })
    expect(createInterview).toHaveBeenCalledTimes(1)
  })
})

describe('InterviewsSection', () => {
  it('shows each interview in Paris time with its kind and format', () => {
    render(
      <InterviewsSection
        jobApplicationId={JOB_APPLICATION_ID}
        initialInterviews={[laterInterview, earlierInterview]}
        createInterview={jest.fn()}
        updateInterview={jest.fn()}
        deleteInterview={jest.fn()}
        listInterviewsForJobApplication={jest.fn()}
      />,
    )
    const interviewItems = screen.getAllByRole('listitem')
    expect(interviewItems[0]).toHaveTextContent('mar. 20/10 · 10h00')
    expect(interviewItems[0]).toHaveTextContent('Entretien blanc')
    expect(interviewItems[1]).toHaveTextContent('mer. 04/11 · 10h00')
    expect(interviewItems[1]).toHaveTextContent('Visio')
  })

  it('offers to add a new interview with the spec label', () => {
    render(
      <InterviewsSection
        jobApplicationId={JOB_APPLICATION_ID}
        initialInterviews={[]}
        createInterview={jest.fn()}
        updateInterview={jest.fn()}
        deleteInterview={jest.fn()}
        listInterviewsForJobApplication={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Nouvel entretien' })).toBeInTheDocument()
  })
})
