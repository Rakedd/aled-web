import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { isOpportunityFeedStale } from '@/domain/opportunities'
import { NO_MISSION_RECEIVED_MESSAGE, type OpportunityFeedFreshnessProps } from './interfaces'

const STALE_FEED_MESSAGE = 'Aucune mission reçue depuis plus de 4 h : vérifie le watcher.'

export const OpportunityFeedFreshness = ({ lastReceivedAt, now }: OpportunityFeedFreshnessProps) => {
  if (lastReceivedAt === null) {
    return <p className="text-sm text-muted-foreground">{NO_MISSION_RECEIVED_MESSAGE}</p>
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-muted-foreground">
        Dernière réception il y a {formatDistance(lastReceivedAt, now, { locale: fr })}
      </p>
      {isOpportunityFeedStale(lastReceivedAt, now) && (
        <p role="status" className="rounded-lg border border-peach bg-peach-tint px-3 py-2 text-peach-ink">
          {STALE_FEED_MESSAGE}
        </p>
      )}
    </div>
  )
}
