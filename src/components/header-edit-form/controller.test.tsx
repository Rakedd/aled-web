import { act, renderHook } from '@testing-library/react'
import type { ActionResult } from '@/domain/action-result'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import type { PositionedJobApplication } from '@/domain/duplicate-positioning'
import { useController } from './controller'

const OTHER_AGENCY_POSITIONING: PositionedJobApplication = {
  id: 'application-9',
  title: 'Lead React',
  endClientName: 'Société Générale',
  endClientParentName: null,
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-07T08:00:00Z'),
}

const SUCCESS: ActionResult<null> = { ok: true, data: null }

const renderHeaderEditController = (
  jobApplication: JobApplicationOverview = buildJobApplicationOverview(),
  positionedJobApplications: PositionedJobApplication[] = [],
) => {
  const updateJobApplication = jest.fn().mockResolvedValue(SUCCESS)
  const setEndClientParent = jest.fn().mockResolvedValue(SUCCESS)
  const updateIntermediaryKind = jest.fn().mockResolvedValue(SUCCESS)
  const onDataChanged = jest.fn()
  const onClose = jest.fn()
  const renderedHook = renderHook(
    (currentJobApplication: JobApplicationOverview) =>
      useController({
        jobApplication: currentJobApplication,
        updateJobApplication,
        setEndClientParent,
        updateIntermediaryKind,
        positionedJobApplications,
        onDataChanged,
        onClose,
      }),
    { initialProps: jobApplication },
  )
  return { ...renderedHook, updateJobApplication, setEndClientParent, updateIntermediaryKind, onDataChanged, onClose }
}

describe('header-edit-form useController', () => {
  it('warns when another agency positioned the same end client recently', () => {
    const { result } = renderHeaderEditController(undefined, [OTHER_AGENCY_POSITIONING])
    expect(result.current.duplicatePositioningRisks).toEqual([OTHER_AGENCY_POSITIONING])
  })

  it('never flags the application being edited', () => {
    const ownPositioning = { ...OTHER_AGENCY_POSITIONING, id: 'application-1' }
    const { result } = renderHeaderEditController(undefined, [ownPositioning])
    expect(result.current.duplicatePositioningRisks).toEqual([])
  })

  it('fills the header fields from the application', () => {
    const { result } = renderHeaderEditController()
    expect(result.current.formValues).toEqual({
      title: 'Développeur React',
      source: 'Free-Work',
      postingUrl: '',
      intermediaryName: 'Free-Work',
      intermediaryKind: 'platform',
      endClientName: 'Société Générale',
      endClientParentName: 'Groupe SG',
      appliedOn: '2026-10-10',
    })
  })

  it('sends only the header fields that changed, then refreshes and closes', async () => {
    const { result, updateJobApplication, setEndClientParent, updateIntermediaryKind, onDataChanged, onClose } =
      renderHeaderEditController()
    act(() => result.current.setFormValue('title', 'Lead React'))
    act(() => result.current.setFormValue('appliedOn', '2026-10-12'))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', {
      title: 'Lead React',
      appliedOn: new Date('2026-10-11T22:00:00.000Z'),
    })
    expect(setEndClientParent).not.toHaveBeenCalled()
    expect(updateIntermediaryKind).not.toHaveBeenCalled()
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('detaches a cleared intermediary by sending a null name', async () => {
    const { result, updateJobApplication } = renderHeaderEditController()
    act(() => result.current.setFormValue('intermediaryName', ''))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { intermediaryName: null })
  })

  it('goes back to reading without sending anything on cancel', () => {
    const { result, updateJobApplication, updateIntermediaryKind, onClose } = renderHeaderEditController()
    act(() => result.current.setFormValue('title', 'Lead React'))
    act(() => result.current.setFormValue('intermediaryKind', 'esn'))
    act(() => result.current.cancel())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(updateIntermediaryKind).not.toHaveBeenCalled()
  })

  it('refuses an empty title', async () => {
    const { result, updateJobApplication } = renderHeaderEditController()
    act(() => result.current.setFormValue('title', '  '))
    await act(() => result.current.save())
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Le titre est obligatoire')
  })

  it('saves the intermediary kind only on save, through updateIntermediaryKind', async () => {
    const { result, updateJobApplication, updateIntermediaryKind, onClose } = renderHeaderEditController()
    act(() => result.current.setFormValue('intermediaryKind', 'esn'))
    expect(updateIntermediaryKind).not.toHaveBeenCalled()
    await act(() => result.current.save())
    expect(updateIntermediaryKind).toHaveBeenCalledWith('intermediary-1', 'esn')
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the intermediary kind without an intermediary or while its name is edited', () => {
    const withoutIntermediary = renderHeaderEditController(
      buildJobApplicationOverview({ intermediaryId: null, intermediaryName: null, intermediaryKind: null }),
    )
    expect(withoutIntermediary.result.current.formValues.intermediaryKind).toBe('')
    expect(withoutIntermediary.result.current.isIntermediaryKindDisabled).toBe(true)
    const { result } = renderHeaderEditController()
    expect(result.current.isIntermediaryKindDisabled).toBe(false)
    act(() => result.current.setFormValue('intermediaryKind', 'esn'))
    act(() => result.current.setFormValue('intermediaryName', 'Malt'))
    expect(result.current.isIntermediaryKindDisabled).toBe(true)
    expect(result.current.formValues.intermediaryKind).toBe('platform')
  })

  it('unlinks the group through setEndClientParent when only the group is cleared', async () => {
    const { result, updateJobApplication, setEndClientParent } = renderHeaderEditController()
    act(() => result.current.setFormValue('endClientParentName', ''))
    await act(() => result.current.save())
    expect(setEndClientParent).toHaveBeenCalledWith('end-client-1', null)
    expect(updateJobApplication).not.toHaveBeenCalled()
  })

  it('sends the group through updateJobApplication when it is renamed', async () => {
    const { result, updateJobApplication, setEndClientParent } = renderHeaderEditController()
    act(() => result.current.setFormValue('endClientParentName', 'Groupe BNP'))
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { endClientParentName: 'Groupe BNP' })
    expect(setEndClientParent).not.toHaveBeenCalled()
  })

  it('disables the group field and clears it when there is no end client name', () => {
    const { result } = renderHeaderEditController()
    expect(result.current.isEndClientParentDisabled).toBe(false)
    act(() => result.current.setFormValue('endClientName', ''))
    expect(result.current.isEndClientParentDisabled).toBe(true)
    expect(result.current.formValues.endClientParentName).toBe('')
  })

  it('refreshes what was saved and stays open when a later step is refused', async () => {
    const { result, updateIntermediaryKind, onDataChanged, onClose } = renderHeaderEditController()
    updateIntermediaryKind.mockResolvedValue({ ok: false, errorMessage: 'Intermédiaire introuvable' })
    act(() => result.current.setFormValue('title', 'Lead React'))
    act(() => result.current.setFormValue('intermediaryKind', 'esn'))
    await act(() => result.current.save())
    expect(result.current.errorMessage).toBe('Intermédiaire introuvable')
    expect(onDataChanged).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the field being edited across a refresh and adopts the untouched ones', async () => {
    const { result, rerender, updateJobApplication } = renderHeaderEditController()
    act(() => result.current.setFormValue('title', 'Lead React'))
    rerender(buildJobApplicationOverview({ title: 'Développeur Vue', source: 'LinkedIn', intermediaryKind: 'esn' }))
    expect(result.current.formValues.title).toBe('Lead React')
    expect(result.current.formValues.source).toBe('LinkedIn')
    expect(result.current.formValues.intermediaryKind).toBe('esn')
    await act(() => result.current.save())
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { title: 'Lead React' })
  })
})
