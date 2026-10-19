import { NEW_JOB_APPLICATION_ROUTE, jobApplicationRoute } from './routes'

describe('job application routes', () => {
  it('builds the page of a job application from its identifier', () => {
    expect(jobApplicationRoute('application-1')).toBe('/candidatures/application-1')
  })

  it('points to the creation page of a job application', () => {
    expect(NEW_JOB_APPLICATION_ROUTE).toBe('/candidatures/new')
  })
})
