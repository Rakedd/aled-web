import { GOOGLE_LOGO_PATHS, LINKEDIN_LOGO_PATH } from '@/lib/brand-logo-paths'
import type { OAuthProviderLogoProps } from './interfaces'

export const OAuthProviderLogo = ({ provider }: OAuthProviderLogoProps) =>
  provider === 'google' ? (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-[18px]">
      {GOOGLE_LOGO_PATHS.map(({ colourVariable, path }) => (
        <path key={colourVariable} style={{ fill: `var(${colourVariable})` }} d={path} />
      ))}
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-[18px] text-linkedin">
      <path d={LINKEDIN_LOGO_PATH} />
    </svg>
  )
