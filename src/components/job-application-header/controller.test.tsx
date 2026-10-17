import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { getNextPipelineStatus, getSuggestedKoStatuses } from '@/domain/job-application-status'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { useController } from './controller'
import type { JobApplicationHeaderSummary } from './interfaces'

const renderHeaderController = ({
  status = 'cv_submitted',
  endClientLabel = 'Société Générale',
  actionResult = { ok: true, data: null },
}: {
  status?: JobApplicationStatus
  endClientLabel?: string | null
  actionResult?: ActionResult<null>
} = {}) => {
  const jobApplication: JobApplicationHeaderSummary = {
    id: 'application-1',
    title: 'Développeur React',
    status,
    intermediaryName: 'Free-Work',
    contactName: 'Jeanne Martin',
    endClientLabel,
  }
  const changeJobApplicationStatus = jest.fn().mockResolvedValue(actionResult)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() => useController({ jobApplication, changeJobApplicationStatus, onDataChanged }))
  return { result, changeJobApplicationStatus, onDataChanged }
}

describe('job-application-header useController', () => {
  it('advances to the next pipeline status and refreshes the data', async () => {
    const { result, changeJobApplicationStatus, onDataChanged } = renderHeaderController()
    await act(() => result.current.advance())
    expect(changeJobApplicationStatus).toHaveBeenCalledWith(
      'application-1',
      getNextPipelineStatus('cv_submitted'),
    )
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it.each<JobApplicationStatus>(['signed', 'ko_cv', 'no_news_abandoned'])(
    'hides the advance button for the terminal status %s',
    async (status) => {
      const { result, changeJobApplicationStatus } = renderHeaderController({ status })
      expect(result.current.nextStatus).toBeNull()
      await act(() => result.current.advance())
      expect(changeJobApplicationStatus).not.toHaveBeenCalled()
    },
  )

  it('proposes the suggested KO statuses for the current status', () => {
    const { result } = renderHeaderController({ status: 'interview_done' })
    expect(result.current.koOptions).toEqual(getSuggestedKoStatuses('interview_done'))
  })

  it('lets any status be picked to correct a mistake', async () => {
    const { result, changeJobApplicationStatus } = renderHeaderController({ status: 'signed' })
    await act(() => result.current.changeStatus('applied'))
    expect(changeJobApplicationStatus).toHaveBeenCalledWith('application-1', 'applied')
  })

  it('shows Client inconnu when the end client is empty', () => {
    expect(renderHeaderController({ endClientLabel: null }).result.current.endClientDisplayName).toBe('Client inconnu')
    expect(renderHeaderController({ endClientLabel: 'Société Générale' }).result.current.endClientDisplayName).toBe(
      'Société Générale',
    )
  })

  it('shows the server error message and does not refresh when the action is refused', async () => {
    const { result, onDataChanged } = renderHeaderController({
      actionResult: { ok: false, errorMessage: 'Candidature introuvable' },
    })
    await act(() => result.current.advance())
    expect(result.current.errorMessage).toBe('Candidature introuvable')
    expect(onDataChanged).not.toHaveBeenCalled()
  })

  it('shows the generic error message when the action throws', async () => {
    const { result, changeJobApplicationStatus, onDataChanged } = renderHeaderController()
    changeJobApplicationStatus.mockRejectedValue(new Error('network'))
    await act(() => result.current.advance())
    expect(result.current.errorMessage).toBe('Une erreur est survenue, réessaie.')
    expect(onDataChanged).not.toHaveBeenCalled()
    expect(result.current.isChangingStatus).toBe(false)
  })

  it('ignores a second status change while one is in flight', async () => {
    const { result, changeJobApplicationStatus } = renderHeaderController()
    let resolveAction: (actionResult: ActionResult<null>) => void = () => undefined
    changeJobApplicationStatus.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)))
    let firstChange: Promise<void> = Promise.resolve()
    act(() => {
      firstChange = result.current.advance()
    })
    await act(() => result.current.changeStatus('ko_cv'))
    expect(changeJobApplicationStatus).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveAction({ ok: true, data: null })
      await firstChange
    })
    expect(result.current.isChangingStatus).toBe(false)
  })
})
