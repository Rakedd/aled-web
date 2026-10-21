import { CALENDAR_ROUTE, JOB_APPLICATIONS_ROUTE, OPPORTUNITIES_ROUTE, PREFERENCES_ROUTE } from './routes'

export const LANDING_INTERNAL_PATH_PREFIX = '/vitrine'

export const SIGN_UP_PATHNAME = '/inscription'

export const SIGN_IN_PATHNAME = '/login'

export const LEGAL_NOTICE_PATHNAME = '/mentions-legales'

export const PRIVACY_POLICY_PATHNAME = '/confidentialite'

const WWW_PREFIX = 'www.'

const APP_PATH_PREFIXES = [
  SIGN_IN_PATHNAME,
  SIGN_UP_PATHNAME,
  '/auth',
  '/settings',
  '/api',
  JOB_APPLICATIONS_ROUTE,
  CALENDAR_ROUTE,
  OPPORTUNITIES_ROUTE,
  PREFERENCES_ROUTE,
]

const isPathnameWithinPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

const removePort = (hostname: string): string => hostname.split(':')[0]

export const parseLandingHostnames = (rawValue: string | undefined): string[] =>
  (rawValue ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter((hostname) => hostname.length > 0)

export const isLandingHostname = (hostname: string, landingHostnames: string[]): boolean =>
  landingHostnames.includes(removePort(hostname).toLowerCase())

export const isWwwHostname = (hostname: string): boolean => hostname.toLowerCase().startsWith(WWW_PREFIX)

export const stripWwwPrefix = (hostname: string): string =>
  isWwwHostname(hostname) ? hostname.slice(WWW_PREFIX.length) : hostname

export const toBareLandingHost = (host: string): string => {
  const [hostname, port] = host.split(':')
  const bareHostname = stripWwwPrefix(hostname)
  return port && /^\d+$/.test(port) ? `${bareHostname}:${port}` : bareHostname
}

export const isLandingInternalPathname =(pathname: string): boolean =>
  isPathnameWithinPrefix(pathname, LANDING_INTERNAL_PATH_PREFIX)

export const toLandingInternalPathname = (pathname: string): string =>
  pathname === '/' ? LANDING_INTERNAL_PATH_PREFIX : `${LANDING_INTERNAL_PATH_PREFIX}${pathname}`

export const isAppPathname = (pathname: string): boolean =>
  APP_PATH_PREFIXES.some((appPathPrefix) => isPathnameWithinPrefix(pathname, appPathPrefix))
