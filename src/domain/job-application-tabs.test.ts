import {
  JOB_APPLICATION_TABS,
  isJobApplicationTab,
  jobApplicationTabRoute,
  resolveJobApplicationTab,
} from './job-application-tabs'

const NOW = new Date('2026-10-19T08:00:00Z')

const interviewAt = (startsAt: string) => [{ startsAt: new Date(startsAt) }]

describe('isJobApplicationTab', () => {
  it('accepts every known tab and rejects anything else', () => {
    JOB_APPLICATION_TABS.forEach((tab) => expect(isJobApplicationTab(tab)).toBe(true))
    expect(isJobApplicationTab('inconnu')).toBe(false)
    expect(isJobApplicationTab(undefined)).toBe(false)
    expect(isJobApplicationTab(['mission'])).toBe(false)
  })
})

describe('resolveJobApplicationTab', () => {
  it('lets a valid requested tab win over the default rule', () => {
    expect(resolveJobApplicationTab('journal', interviewAt('2026-10-20T08:00:00Z'), NOW)).toBe('journal')
  })

  it('falls back to the overview when the requested tab is unknown and there is no interview', () => {
    expect(resolveJobApplicationTab('inconnu', [], NOW)).toBe('apercu')
  })

  it('applies the default rule when the requested tab is an array', () => {
    expect(resolveJobApplicationTab(['mission'], interviewAt('2026-10-20T08:00:00Z'), NOW)).toBe('entretiens')
    expect(resolveJobApplicationTab(['mission'], [], NOW)).toBe('apercu')
  })

  it('opens the interviews tab for an interview exactly 7 days away', () => {
    expect(resolveJobApplicationTab(undefined, interviewAt('2026-10-26T20:00:00Z'), NOW)).toBe('entretiens')
  })

  it('opens the overview for an interview 8 days away', () => {
    expect(resolveJobApplicationTab(undefined, interviewAt('2026-10-27T06:00:00Z'), NOW)).toBe('apercu')
  })

  it('ignores a past interview', () => {
    expect(resolveJobApplicationTab(undefined, interviewAt('2026-10-19T07:00:00Z'), NOW)).toBe('apercu')
  })

  it('counts days on the Paris calendar around midnight', () => {
    const lateEvening = new Date('2026-10-19T21:30:00Z')
    expect(resolveJobApplicationTab(undefined, interviewAt('2026-10-26T22:30:00Z'), lateEvening)).toBe('entretiens')
    expect(resolveJobApplicationTab(undefined, interviewAt('2026-10-26T23:30:00Z'), lateEvening)).toBe('apercu')
  })
})

describe('jobApplicationTabRoute', () => {
  it('builds the page url with the tab search parameter', () => {
    expect(jobApplicationTabRoute('a1', 'entretiens')).toBe('/candidatures/a1?onglet=entretiens')
  })
})
