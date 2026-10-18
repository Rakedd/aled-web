import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { useController } from './controller'

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const renderMissionDetailsController = (jobApplication: JobApplicationOverview = buildJobApplicationOverview()) => {
  const updateJobApplication = jest.fn().mockResolvedValue(SUCCESS)
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(
    (currentJobApplication: JobApplicationOverview) =>
      useController({ jobApplication: currentJobApplication, updateJobApplication, onDataChanged, onClose }),
    { initialProps: jobApplication },
  )
  return { ...renderedHook, updateJobApplication, onDataChanged, onClose }
}

describe('mission-details-form useController', () => {
  it('fills the mission fields from the application', () => {
    const { result } = renderMissionDetailsController(
      buildJobApplicationOverview({ actualStartDate: new Date('2026-11-02T23:00:00Z') }),
    )
    expect(result.current.formValues).toEqual({
      postedDailyRate: '650',
      requestedDailyRate: '',
      location: 'Paris',
      remotePolicy: '',
      desiredStart: '',
      actualStartDate: '2026-11-03',
      duration: '6 mois',
      notes: '',
    })
  })

  it('sends only the mission fields that changed, then refreshes and closes', async () => {
    const { result, updateJobApplication, onDataChanged, onClose } = renderMissionDetailsController()
    act(() => result.current.setFormValue('location', 'Lyon'))
    act(() => result.current.setFormValue('requestedDailyRate', '700'))
    act(() => result.current.setFormValue('duration', ''))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', {
      location: 'Lyon',
      requestedDailyRate: 700,
      duration: null,
    })
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends the effective start date as a Paris calendar date', async () => {
    const { result, updateJobApplication } = renderMissionDetailsController()
    act(() => result.current.setFormValue('actualStartDate', '2026-11-03'))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', {
      actualStartDate: new Date('2026-11-02T23:00:00.000Z'),
    })
  })

  it('goes back to reading without sending anything on cancel', () => {
    const { result, updateJobApplication, onClose } = renderMissionDetailsController()
    act(() => result.current.setFormValue('location', 'Lyon'))
    act(() => result.current.cancel())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('closes without sending when nothing changed', async () => {
    const { result, updateJobApplication, onClose } = renderMissionDetailsController()
    act(() => result.current.setFormValue('location', 'Paris'))
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['-50', 'abc', '12.5'])('refuses the invalid daily rate %s with TJM invalide', async (dailyRateText) => {
    const { result, updateJobApplication, onClose } = renderMissionDetailsController()
    act(() => result.current.setFormValue('postedDailyRate', dailyRateText))
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('TJM invalide')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the server refusal and stays in edit mode', async () => {
    const { result, updateJobApplication, onDataChanged, onClose } = renderMissionDetailsController()
    updateJobApplication.mockResolvedValue({ ok: false, errorMessage: 'Candidature introuvable' })
    act(() => result.current.setFormValue('location', 'Lyon'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Candidature introuvable')
    expect(onDataChanged).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the field being edited across a refresh and adopts the untouched ones', async () => {
    const { result, rerender, updateJobApplication } = renderMissionDetailsController()
    act(() => result.current.setFormValue('location', 'Lyon'))
    rerender(buildJobApplicationOverview({ location: 'Marseille', duration: '12 mois' }))
    expect(result.current.formValues.location).toBe('Lyon')
    expect(result.current.formValues.duration).toBe('12 mois')
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { location: 'Lyon' })
  })
})
