import Link from 'next/link'
import {
  DUPLICATE_POSITIONING_MESSAGES,
  describeDuplicatePositioning,
} from '@/domain/duplicate-positioning'
import { jobApplicationRoute } from '@/domain/routes'
import type { DuplicatePositioningWarningProps } from './interfaces'

export const DuplicatePositioningWarning = ({ risks }: DuplicatePositioningWarningProps) => (
  <div role="status">
    {risks.length > 0 ? (
      <div className="flex flex-col gap-2 rounded-xl bg-peach-tint p-4 text-sm text-peach-ink">
        <p>
          <strong className="font-bold">{DUPLICATE_POSITIONING_MESSAGES.warning}</strong>{' '}
          {DUPLICATE_POSITIONING_MESSAGES.detail}
        </p>
        <ul className="flex flex-col gap-1">
          {risks.map((risk) => (
            <li key={risk.id}>
              <Link href={jobApplicationRoute(risk.id)} className="font-semibold underline">
                {describeDuplicatePositioning(risk)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
)
