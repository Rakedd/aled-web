import { toPositionedJobApplications, findDuplicatePositioningRisksForFormValues } from './duplicate-positioning-risks'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'

const OTHER_AGENCY_APPLICATION = buildJobApplicationOverview({
  id: 'application-2',
  intermediaryName: 'Autre ESN',
  appliedOn: new Date('2026-10-13T08:00:00Z'),
})

const formValues = {
  endClientName: 'societe generale',
  endClientParentName: '',
  intermediaryName: 'Free-Work',
  appliedOn: '2026-10-23',
}

describe('duplicate-positioning-risks', () => {
  it('keeps only the fields needed to compare positionings', () => {
    expect(toPositionedJobApplications([OTHER_AGENCY_APPLICATION])).toEqual([
      {
        id: 'application-2',
        title: 'Développeur React',
        endClientName: 'Société Générale',
        endClientParentName: 'Groupe SG',
        intermediaryName: 'Autre ESN',
        appliedOn: new Date('2026-10-13T08:00:00Z'),
      },
    ])
  })

  it('finds a recent positioning by another agency from typed text values', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues },
      toPositionedJobApplications([OTHER_AGENCY_APPLICATION]),
    )
    expect(risks.map((risk) => risk.id)).toEqual(['application-2'])
  })

  it('finds nothing when the application date is not a valid date', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues, appliedOn: '' },
      toPositionedJobApplications([OTHER_AGENCY_APPLICATION]),
    )
    expect(risks).toEqual([])
  })

  it('finds nothing when the typed agency is the same', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: null, ...formValues, intermediaryName: 'autre esn' },
      toPositionedJobApplications([OTHER_AGENCY_APPLICATION]),
    )
    expect(risks).toEqual([])
  })

  it('never reports the application being edited', () => {
    const risks = findDuplicatePositioningRisksForFormValues(
      { jobApplicationId: 'application-2', ...formValues },
      toPositionedJobApplications([OTHER_AGENCY_APPLICATION]),
    )
    expect(risks).toEqual([])
  })
})
