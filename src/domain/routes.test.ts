import {
  CV_LIBRARY_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  INTERMEDIARIES_LIST_ROUTE,
  NEW_JOB_APPLICATION_ROUTE,
  NEW_PASSWORD_ROUTE,
  OPPORTUNITY_PREFERENCES_ROUTE,
  SIGN_UP_RESEND_ROUTE,
  SIGN_UP_ROUTE,
  contactRoute,
  intermediaryRoute,
  jobApplicationRoute,
} from './routes'

describe('job application routes', () => {
  it('builds the page of a job application from its identifier', () => {
    expect(jobApplicationRoute('application-1')).toBe('/candidatures/application-1')
  })

  it('points to the creation page of a job application', () => {
    expect(NEW_JOB_APPLICATION_ROUTE).toBe('/candidatures/new')
  })
})

describe('opportunity preferences route', () => {
  it('points to the single opportunities preferences page', () => {
    expect(OPPORTUNITY_PREFERENCES_ROUTE).toBe('/preferences/opportunites')
  })
})

describe('contacts routes', () => {
  it('builds contact and intermediary pages from their identifiers', () => {
    expect(contactRoute('c1')).toBe('/contacts/c1')
    expect(intermediaryRoute('i1')).toBe('/agences/i1')
  })

  it('points to the intermediaries view of the contacts list', () => {
    expect(INTERMEDIARIES_LIST_ROUTE).toBe('/contacts?vue=agences')
  })
})

describe('cv library route', () => {
  it('points to the cv library page', () => {
    expect(CV_LIBRARY_ROUTE).toBe('/cv')
  })
})

describe('account routes', () => {
  it('points to the sign-up and password pages', () => {
    expect(SIGN_UP_ROUTE).toBe('/inscription')
    expect(SIGN_UP_RESEND_ROUTE).toBe('/inscription/renvoyer')
    expect(FORGOT_PASSWORD_ROUTE).toBe('/mot-de-passe-oublie')
    expect(NEW_PASSWORD_ROUTE).toBe('/mot-de-passe/nouveau')
  })
})
