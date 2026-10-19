export const HOME_ROUTE = '/'

export const JOB_APPLICATIONS_ROUTE = '/candidatures'

export const NEW_JOB_APPLICATION_ROUTE = `${JOB_APPLICATIONS_ROUTE}/new`

export const jobApplicationRoute = (jobApplicationId: string): string => `${JOB_APPLICATIONS_ROUTE}/${jobApplicationId}`

export const CALENDAR_ROUTE = '/calendar'

export const OPPORTUNITIES_ROUTE = '/opportunites'

export const PREFERENCES_ROUTE = '/preferences'

export const FREE_WORK_PREFERENCES_ROUTE = `${PREFERENCES_ROUTE}/opportunites/free-work`

export const JOB_APPLICATION_DELETED_SEARCH_PARAMETER = 'supprimee'

export const JOB_APPLICATION_DELETED_ROUTE = `${JOB_APPLICATIONS_ROUTE}?${JOB_APPLICATION_DELETED_SEARCH_PARAMETER}=1`
