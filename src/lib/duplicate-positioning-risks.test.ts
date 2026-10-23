import type { PositionedJobApplication } from '@/domain/duplicate-positioning'
import { findDuplicatePositioningRisksForFormValues } from './duplicate-positioning-risks'

const OTHER_AGENCY_APPLICATION: PositionedJobApplication = {
  id: 'application-2',
  title: 'Développeur React',
  endClientName: 'Société Générale',
  endClientParentName: 'Groupe SG',
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-13T08:00:00Z'),
}

const formValues = {
  endClientName: 'societe generale',
  endClientParentName: '',
  intermediaryName: 'Free-Work',
  appliedOn: '2026-10-23',
}

describe('duplicate-positioning-risks', () => {
  it('finds a recent positioning by another agency from typed text values', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues },
      [OTHER_AGENCY_APPLICATION],
    )
    expect(risks.map((risk) => risk.id)).toEqual(['application-2'])
  })

  it('finds nothing when the application date is not a valid date', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues, appliedOn: '' },
      [OTHER_AGENCY_APPLICATION],
    )
    expect(risks).toEqual([])
  })

  it('finds nothing when the typed agency is the same', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues, intermediaryName: 'autre esn' },
      [OTHER_AGENCY_APPLICATION],
    )
    expect(risks).toEqual([])
  })

  it('never reports the application being edited', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: 'application-2', ...formValues },
      [OTHER_AGENCY_APPLICATION],
    )
    expect(risks).toEqual([])
  })

  it('matches on the parent group alone', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues, endClientName: '', endClientParentName: 'groupe sg' },
      [OTHER_AGENCY_APPLICATION],
    )
    expect(risks.map((risk) => risk.id)).toEqual(['application-2'])
  })
})
