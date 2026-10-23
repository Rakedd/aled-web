import { isExternalLinkUrl } from '@/domain/client-brief'
import { LINKEDIN_LOGO_PATH } from '@/lib/brand-logo-paths'
import type { LinkedinLinkProps } from './interfaces'

export const LinkedinLink = (props: LinkedinLinkProps) => {
  const { url } = props
  if (!isExternalLinkUrl(url)) return null
  const isCompact = props.isCompact === true

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={props.isCompact ? props.label : undefined}
      className="inline-flex items-center gap-1.5 font-medium text-linkedin hover:underline focus-visible:underline"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
        <path d={LINKEDIN_LOGO_PATH} />
      </svg>
      {!isCompact && 'LinkedIn'}
    </a>
  )
}
