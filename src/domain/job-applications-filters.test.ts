import { filterAndSortJobApplications, type JobApplicationsTableFilters } from './job-applications-filters'
import type { JobApplicationListItem } from './job-application'
import type { TodoAlert } from './todo-alerts'

const buildJobApplication = (overrides: Partial<JobApplicationListItem>): JobApplicationListItem => ({
  id: 'id',
  userId: 'user',
  title: 'Dev',
  source: null,
  postingUrl: null,
  status: 'applied',
  intermediaryId: null,
  contactId: null,
  endClientId: null,
  postedDailyRate: null,
  requestedDailyRate: null,
  location: null,
  remotePolicy: null,
  desiredStart: null,
  duration: null,
  appliedOn: new Date('2026-10-01T10:00:00Z'),
  notes: null,
  actualStartDate: null,
  stack: [],
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  lastActivityAt: null,
  hasJobSpec: false,
  intermediaryName: null,
  intermediaryKind: null,
  contactName: null,
  endClientName: null,
  endClientParentName: null,
  endClientLabel: null,
  ...overrides,
})

const defaultFilters: JobApplicationsTableFilters = { searchText: '', statuses: [], sources: [], showTerminal: false, alertKind: null }
const defaultSort = { key: 'title', direction: 'asc' } as const

describe('filterAndSortJobApplications', () => {
  it('hides signed and ko applications by default', () => {
    const jobApplications = [
      buildJobApplication({ id: 'active' }),
      buildJobApplication({ id: 'signed', status: 'signed' }),
      buildJobApplication({ id: 'ko', status: 'ko_cv' }),
    ]
    const visibleIds = filterAndSortJobApplications(jobApplications, defaultFilters, defaultSort, []).map(({ id }) => id)
    expect(visibleIds).toEqual(['active'])
  })

  it('shows terminal applications when requested', () => {
    const jobApplications = [buildJobApplication({ id: 'active' }), buildJobApplication({ id: 'signed', status: 'signed' })]
    const result = filterAndSortJobApplications(jobApplications, { ...defaultFilters, showTerminal: true }, defaultSort, [])
    expect(result).toHaveLength(2)
  })

  it('finds an application by its end client ignoring case and accents', () => {
    const jobApplications = [
      buildJobApplication({ id: 'other', endClientName: 'Société Générale' }),
      buildJobApplication({ id: 'bnp', endClientName: 'BNP Paribas', endClientLabel: 'BNP Paribas' }),
    ]
    const visibleIds = filterAndSortJobApplications(jobApplications, { ...defaultFilters, searchText: 'bnp' }, defaultSort, []).map(
      ({ id }) => id,
    )
    expect(visibleIds).toEqual(['bnp'])
    const accentInsensitiveIds = filterAndSortJobApplications(
      jobApplications,
      { ...defaultFilters, searchText: 'SOCIETE generale' },
      defaultSort,
      [],
    ).map(({ id }) => id)
    expect(accentInsensitiveIds).toEqual(['other'])
  })

  it('keeps only the selected sources', () => {
    const jobApplications = [
      buildJobApplication({ id: 'linkedin', source: 'LinkedIn' }),
      buildJobApplication({ id: 'free-work', source: 'Free-Work' }),
      buildJobApplication({ id: 'no-source' }),
    ]
    const visibleIds = filterAndSortJobApplications(jobApplications, { ...defaultFilters, sources: ['LinkedIn'] }, defaultSort, []).map(
      ({ id }) => id,
    )
    expect(visibleIds).toEqual(['linkedin'])
  })

  it('keeps only the selected statuses', () => {
    const jobApplications = [
      buildJobApplication({ id: 'applied' }),
      buildJobApplication({ id: 'cv', status: 'cv_submitted' }),
    ]
    const visibleIds = filterAndSortJobApplications(
      jobApplications,
      { ...defaultFilters, statuses: ['cv_submitted'] },
      defaultSort,
      [],
    ).map(({ id }) => id)
    expect(visibleIds).toEqual(['cv'])
  })

  it('sorts lastActivityAt descending with null values last', () => {
    const jobApplications = [
      buildJobApplication({ id: 'none', lastActivityAt: null }),
      buildJobApplication({ id: 'old', lastActivityAt: new Date('2026-10-02T10:00:00Z') }),
      buildJobApplication({ id: 'recent', lastActivityAt: new Date('2026-10-10T10:00:00Z') }),
    ]
    const sortedIds = filterAndSortJobApplications(jobApplications, defaultFilters, {
      key: 'lastActivityAt',
      direction: 'desc',
    }, []).map(({ id }) => id)
    expect(sortedIds).toEqual(['recent', 'old', 'none'])
  })

  it('sorts text columns ignoring accents and does not mutate the input', () => {
    const jobApplications = [buildJobApplication({ id: 'b', title: 'Zèbre' }), buildJobApplication({ id: 'a', title: 'Écureuil' })]
    const sortedIds = filterAndSortJobApplications(jobApplications, defaultFilters, defaultSort, []).map(({ id }) => id)
    expect(sortedIds).toEqual(['a', 'b'])
    expect(jobApplications.map(({ id }) => id)).toEqual(['b', 'a'])
  })

  describe('alert kind filter', () => {
    const buildAlert = (jobApplicationId: string, kind: TodoAlert['kind']): TodoAlert => ({
      kind,
      jobApplicationId,
      jobApplicationTitle: 'Dev',
      referenceDate: new Date('2026-10-01T10:00:00Z'),
    })
    const jobApplications = [
      buildJobApplication({ id: 'followed', status: 'cv_submitted' }),
      buildJobApplication({ id: 'other', status: 'applied' }),
      buildJobApplication({ id: 'snoozed', status: 'cv_submitted' }),
    ]
    const alerts = [buildAlert('followed', 'follow_up_due'), buildAlert('other', 'job_spec_missing'), buildAlert('other', 'follow_up_due')]

    it('keeps only applications with an alert of the chosen kind', () => {
      const visibleIds = filterAndSortJobApplications(
        jobApplications,
        { ...defaultFilters, alertKind: 'follow_up_due' },
        defaultSort,
        alerts,
      ).map(({ id }) => id)
      expect(visibleIds).toEqual(['followed', 'other'])
    })

    it('intersects with the other filters', () => {
      const visibleIds = filterAndSortJobApplications(
        jobApplications,
        { ...defaultFilters, alertKind: 'follow_up_due', statuses: ['cv_submitted'] },
        defaultSort,
        alerts,
      ).map(({ id }) => id)
      expect(visibleIds).toEqual(['followed'])
    })

    it('changes nothing when no kind is chosen', () => {
      const visibleIds = filterAndSortJobApplications(jobApplications, defaultFilters, defaultSort, alerts).map(({ id }) => id)
      expect(visibleIds).toEqual(['followed', 'other', 'snoozed'])
    })

    it('excludes an application whose alert is absent from the alerts', () => {
      const visibleIds = filterAndSortJobApplications(
        jobApplications,
        { ...defaultFilters, alertKind: 'follow_up_due' },
        defaultSort,
        alerts,
      ).map(({ id }) => id)
      expect(visibleIds).not.toContain('snoozed')
    })
  })
})
