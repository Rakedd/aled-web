'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OpportunityCard } from '@/components/opportunity-card'
import { NO_MISSION_RECEIVED_MESSAGE, OpportunityFeedFreshness } from '@/components/opportunity-feed-freshness'
import { Button } from '@/components/ui/button'
import { OPPORTUNITY_TABS, type OpportunityTab } from '@/domain/opportunities'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { OpportunitiesBoardProps } from './interfaces'

const TAB_LABELS: Record<OpportunityTab, string> = {
  to_process: 'À traiter',
  applied: 'Postulées',
  dismissed: 'Ignorées',
}

const EMPTY_TAB_MESSAGES: Record<Exclude<OpportunityTab, 'to_process'>, string> = {
  applied: 'Aucune opportunité postulée.',
  dismissed: 'Aucune opportunité ignorée.',
}

export const OpportunitiesBoard = ({
  initialTab,
  initialListing,
  hasActiveFilters,
  now,
  listOpportunities,
  applyToOpportunity,
  dismissOpportunity,
  restoreOpportunity,
  markOpportunitiesViewed,
}: OpportunitiesBoardProps) => {
  const router = useRouter()
  const { tab, items, hasMore, counts, errorMessage, isLoadingListing, isOpportunityPending, applyTo, dismiss, restore, selectTab, loadMore } =
    useController({
      initialTab,
      initialListing,
      listOpportunities,
      applyToOpportunity,
      dismissOpportunity,
      restoreOpportunity,
      markOpportunitiesViewed,
      onDataChanged: router.refresh,
      onTabChanged: (nextTab) => window.history.replaceState(null, '', `?tab=${nextTab}`),
    })
  const { lastReceivedAt, lastViewedAt } = initialListing

  const renderEmptyState = () => {
    if (tab !== 'to_process') return <p className="text-sm text-muted-foreground">{EMPTY_TAB_MESSAGES[tab]}</p>
    if (lastReceivedAt === null) return <p className="text-sm text-muted-foreground">{NO_MISSION_RECEIVED_MESSAGE}</p>
    if (!hasActiveFilters) return <p className="text-sm text-muted-foreground">Rien de nouveau pour l&apos;instant.</p>
    return (
      <p className="text-sm text-muted-foreground">
        Rien de nouveau qui correspond à tes filtres.{' '}
        <Link href="/settings/opportunites/free-work" className="underline underline-offset-4">
          Ajuster mes filtres Free-Work
        </Link>
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <OpportunityFeedFreshness lastReceivedAt={lastReceivedAt} now={now} />
      <div role="tablist" aria-label="Opportunités" className="flex gap-1 overflow-x-auto border-b">
        {OPPORTUNITY_TABS.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            role="tab"
            id={`opportunities-tab-${tabKey}`}
            aria-selected={tab === tabKey}
            aria-controls="opportunities-panel"
            disabled={isLoadingListing}
            onClick={() => void selectTab(tabKey)}
            className={cn(
              'h-9 shrink-0 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50',
              tab === tabKey && 'border-primary text-foreground',
            )}
          >
            {TAB_LABELS[tabKey]} ({counts[tabKey]})
          </button>
        ))}
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div
        role="tabpanel"
        id="opportunities-panel"
        aria-labelledby={`opportunities-tab-${tab}`}
        className="flex flex-col gap-3"
      >
        {items.length === 0 ? (
          renderEmptyState()
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((opportunity) => (
              <li key={opportunity.id}>
                <OpportunityCard
                  opportunity={opportunity}
                  tab={tab}
                  isNew={lastViewedAt === null || opportunity.receivedAt > lastViewedAt}
                  isPending={isOpportunityPending(opportunity.id)}
                  now={now}
                  onApply={(selectedOpportunity) => void applyTo(selectedOpportunity)}
                  onDismiss={(selectedOpportunity) => void dismiss(selectedOpportunity)}
                  onRestore={(selectedOpportunity) => void restore(selectedOpportunity)}
                />
              </li>
            ))}
          </ul>
        )}
        {hasMore && (
          <Button type="button" variant="outline" className="self-center" disabled={isLoadingListing} onClick={() => void loadMore()}>
            Voir plus
          </Button>
        )}
      </div>
    </div>
  )
}
