import { act, render, renderHook, screen } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import { getNextPipelineStatus, getSuggestedKoStatuses } from '@/domain/job-application-status'
import type { JobApplicationStatus } from '@/domain/job-application-status'
import { useController } from './controller'
import type { JobApplicationHeaderSummary } from './interfaces'
import { JobApplicationHeader } from './job-application-header'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

const renderHeaderController = ({
  status = 'cv_submitted',
  endClientLabel = 'Société Générale',
  actionResult = { ok: true, data: null },
  lastActivityAt = null,
  postingUrl = null,
}: {
  status?: JobApplicationStatus
  endClientLabel?: string | null
  actionResult?: ActionResult<null>
  lastActivityAt?: Date | null
  postingUrl?: string | null
} = {}) => {
  const jobApplication: JobApplicationHeaderSummary = {
    id: 'application-1',
    title: 'Développeur React',
    status,
    intermediaryName: 'Free-Work',
    contactName: 'Jeanne Martin',
    endClientLabel,
    source: 'Free-Work',
    appliedOn: new Date('2026-10-16T22:30:00Z'),
    lastActivityAt,
    postingUrl,
  }
  const changeJobApplicationStatus = jest.fn().mockResolvedValue(actionResult)
  const onDataChanged = jest.fn()
  const { result } = renderHook(() =>
    useController({
      jobApplication,
      changeJobApplicationStatus,
      now: new Date('2026-10-17T10:00:00Z'),
      onDataChanged,
    }),
  )
  return { result, changeJobApplicationStatus, onDataChanged }
}

describe('job-application-header useController', () => {
  it('advances to the next pipeline status and refreshes the data', async () => {
    const { result, changeJobApplicationStatus, onDataChanged } = renderHeaderController()
    await act(() => result.current.advance())
    expect(changeJobApplicationStatus).toHaveBeenCalledWith('application-1', getNextPipelineStatus('cv_submitted'))
    expect(onDataChanged).toHaveBeenCalledTimes(1)
  })

  it.each<JobApplicationStatus>(['signed', 'ko_cv', 'no_news_abandoned'])(
    'hides the advance button for the terminal status %s',
    async (status) => {
      const { result, changeJobApplicationStatus } = renderHeaderController({
        status,
      })
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
    const { result, changeJobApplicationStatus } = renderHeaderController({
      status: 'signed',
    })
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

  it('formats the source, the Paris application date and the relative last exchange', () => {
    const { result } = renderHeaderController({
      lastActivityAt: new Date('2026-10-14T10:00:00Z'),
    })
    expect(result.current.sourceDisplay).toBe('Free-Work')
    expect(result.current.appliedOnDisplay).toBe('17/10/2026')
    expect(result.current.lastActivityDisplay).toBe('il y a 3 j')
  })

  it('shows a dash when there is no last exchange', () => {
    expect(renderHeaderController().result.current.lastActivityDisplay).toBe('—')
  })
})

describe('job-application-header posting link', () => {
  it.each(['https://www.free-work.com/fr/job/123', 'http://example.com/annonce'])(
    'exposes the web address %s of the posting',
    (postingUrl) => {
      const { result } = renderHeaderController({ postingUrl })
      expect(result.current.externalPostingUrl).toBe(postingUrl)
    },
  )

  it.each([null, 'javascript:alert(1)', 'ftp://example.com/annonce', 'pas une adresse'])(
    'exposes no link for the posting address %p',
    (postingUrl) => {
      const { result } = renderHeaderController({ postingUrl })
      expect(result.current.externalPostingUrl).toBeNull()
    },
  )

  it('opens the posting in a new tab without giving it access to the page', () => {
    render(
      <JobApplicationHeader
        jobApplication={{
          id: 'application-1',
          title: 'Développeur React',
          status: 'applied',
          intermediaryName: null,
          contactName: null,
          endClientLabel: null,
          source: 'Free-Work',
          appliedOn: new Date('2026-10-16T22:30:00Z'),
          lastActivityAt: null,
          postingUrl: 'https://www.free-work.com/fr/job/123',
        }}
        changeJobApplicationStatus={jest.fn()}
        now={new Date('2026-10-17T10:00:00Z')}
      />,
    )
    const postingLink = screen.getByRole('link', { name: "Voir l'annonce" })
    expect(postingLink).toHaveAttribute('href', 'https://www.free-work.com/fr/job/123')
    expect(postingLink).toHaveAttribute('target', '_blank')
    expect(postingLink).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
