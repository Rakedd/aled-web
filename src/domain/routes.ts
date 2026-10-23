export const HOME_ROUTE = '/'

export const JOB_APPLICATIONS_ROUTE = '/candidatures'

export const NEW_JOB_APPLICATION_ROUTE = `${JOB_APPLICATIONS_ROUTE}/new`

export const jobApplicationRoute = (jobApplicationId: string): string => `${JOB_APPLICATIONS_ROUTE}/${jobApplicationId}`

export const CALENDAR_ROUTE = '/calendar'

export const OPPORTUNITIES_ROUTE = '/opportunites'

export const PREFERENCES_ROUTE = '/preferences'

export const OPPORTUNITY_PREFERENCES_ROUTE = `${PREFERENCES_ROUTE}/opportunites`

export const JOB_APPLICATION_DELETED_SEARCH_PARAMETER = 'supprimee'

export const JOB_APPLICATION_DELETED_ROUTE = `${JOB_APPLICATIONS_ROUTE}?${JOB_APPLICATION_DELETED_SEARCH_PARAMETER}=1`

export const CONTACTS_ROUTE = '/contacts'

export const contactRoute = (contactId: string): string => `${CONTACTS_ROUTE}/${contactId}`

export const INTERMEDIARIES_ROUTE = '/agences'

export const intermediaryRoute = (intermediaryId: string): string => `${INTERMEDIARIES_ROUTE}/${intermediaryId}`

export const CONTACTS_VIEW_SEARCH_PARAMETER = 'vue'

export const INTERMEDIARIES_VIEW = 'agences'

export const INTERMEDIARIES_LIST_ROUTE = `${CONTACTS_ROUTE}?${CONTACTS_VIEW_SEARCH_PARAMETER}=${INTERMEDIARIES_VIEW}`

export const CV_LIBRARY_ROUTE = '/cv'

export const SIGN_UP_ROUTE = '/inscription'

export const SIGN_UP_RESEND_ROUTE = `${SIGN_UP_ROUTE}/renvoyer`

export const FORGOT_PASSWORD_ROUTE = '/mot-de-passe-oublie'

export const PASSWORD_ROUTE = '/mot-de-passe'

export const NEW_PASSWORD_ROUTE = `${PASSWORD_ROUTE}/nouveau`

export const PASSWORD_UPDATED_SEARCH_PARAMETER = 'mot-de-passe'

export const PASSWORD_UPDATED_SEARCH_VALUE = 'modifie'

export const PASSWORD_UPDATED_HOME_ROUTE = `${HOME_ROUTE}?${PASSWORD_UPDATED_SEARCH_PARAMETER}=${PASSWORD_UPDATED_SEARCH_VALUE}`
