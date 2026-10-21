import { parseLandingHostnames, toLandingInternalPathname } from '@/domain/landing-routing'

export const readLandingHostnames = (): string[] => parseLandingHostnames(process.env.LANDING_HOSTNAMES)

export const readAppOrigin = (): string => (process.env.APP_ORIGIN ?? '').replace(/\/+$/, '')

export const isProductionDeployment = (): boolean => process.env.VERCEL_ENV === 'production'

export const readLandingOrigin = (): URL | undefined => {
  const [canonicalLandingHostname] = readLandingHostnames()
  return canonicalLandingHostname ? new URL(`https://${canonicalLandingHostname}`) : undefined
}

export const buildAppUrl = (pathname: string): string => `${readAppOrigin()}${pathname}`

export const buildLandingHref = (pathname: string): string =>
  isProductionDeployment() ? pathname : toLandingInternalPathname(pathname)
