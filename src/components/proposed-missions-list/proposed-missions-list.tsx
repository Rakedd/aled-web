import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { formatProposedMissionSentCv } from '@/domain/cv-library'
import { jobApplicationRoute } from '@/domain/routes'
import { formatParisDate } from '@/domain/paris-time'
import type { ProposedMissionsListProps } from './interfaces'

export const ProposedMissionsList = ({ proposedMissions, showsContactName }: ProposedMissionsListProps) => {
  if (proposedMissions.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune mission proposée pour l&apos;instant.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {proposedMissions.map((mission) => (
        <li key={mission.jobApplicationId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={jobApplicationRoute(mission.jobApplicationId)}
              className="font-medium break-words text-accent-text underline underline-offset-2"
            >
              {mission.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              <time dateTime={mission.appliedOn.toISOString()}>{formatParisDate(mission.appliedOn)}</time>
            </span>
            {mission.sentCvLabel !== null && mission.sentCvUploadedAt !== null && (
              <span className="text-xs text-muted-foreground">
                {formatProposedMissionSentCv(mission.sentCvLabel, mission.sentCvUploadedAt)}
              </span>
            )}
            {mission.endClientLabel !== null && <span className="text-sm break-words">{mission.endClientLabel}</span>}
            {showsContactName && mission.contactName !== null && (
              <span className="text-sm text-muted-foreground">{mission.contactName}</span>
            )}
          </div>
          <StatusBadge status={mission.status} />
        </li>
      ))}
    </ul>
  )
}
