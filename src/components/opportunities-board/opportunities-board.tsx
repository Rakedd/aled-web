'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { OpportunityCard } from '@/components/opportunity-card'
import { OpportunityFeedFreshness } from '@/components/opportunity-feed-freshness'
import { PillTabs } from '@/components/pill-tabs'
import { PillToggle } from '@/components/pill-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  OPPORTUNITY_SEARCH_MAX_LENGTH,
  OPPORTUNITY_TABS,
  REMOTE_MODE_LABELS,
  REMOTE_MODES,
  type OpportunityTab,
} from '@/domain/opportunities'
import { FREE_WORK_PREFERENCES_ROUTE } from '@/domain/routes'
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
  const { tab, searchInput, hasActiveSearch, quickFilters, items, hasMore, counts, errorMessage, isLoadingListing, isOpportunityPending, isOpportunityNew, isAnyOpportunityPending, applyTo, dismiss, restore, selectTab, changeSearch, toggleSortByRate, toggleRemoteMode, loadMore } =
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
  const { lastReceivedAt } = initialListing

  const renderEmptyState = () => {
    if (hasActiveSearch) return <p className="text-sm text-muted-foreground">Aucune mission ne correspond à ta recherche.</p>
    if (quickFilters.remoteModes.length > 0) {
      return <p className="text-sm text-muted-foreground">Aucune mission ne correspond à ces filtres.</p>
    }
    if (tab !== 'to_process') return <p className="text-sm text-muted-foreground">{EMPTY_TAB_MESSAGES[tab]}</p>
    if (lastReceivedAt === null) return null
    if (!hasActiveFilters) return <p className="text-sm text-muted-foreground">Rien de nouveau pour l&apos;instant.</p>
    return (
      <p className="text-sm text-muted-foreground">
        Rien de nouveau qui correspond à tes filtres.{' '}
        <Link href={FREE_WORK_PREFERENCES_ROUTE} className="underline underline-offset-4">
          Ajuster mes filtres Free-Work
        </Link>
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <OpportunityFeedFreshness lastReceivedAt={lastReceivedAt} now={now} />
        <Link href={FREE_WORK_PREFERENCES_ROUTE} className="text-sm font-medium text-accent-text underline underline-offset-4">
          Mes filtres Free-Work
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={searchInput}
          maxLength={OPPORTUNITY_SEARCH_MAX_LENGTH}
          placeholder="Rechercher une mission…"
          aria-label="Rechercher une mission"
          className="min-w-48 flex-1"
          onChange={(event) => changeSearch(event.target.value)}
        />
        <PillToggle
          isPressed={quickFilters.sortByRate}
          onPressedChange={() => void toggleSortByRate()}
          disabled={isAnyOpportunityPending}
        >
          Trier par TJM
        </PillToggle>
        <div role="group" aria-label="Présentiel" className="flex flex-wrap items-center gap-2">
          {REMOTE_MODES.map((remoteMode) => (
            <PillToggle
              key={remoteMode}
              isPressed={quickFilters.remoteModes.includes(remoteMode)}
              onPressedChange={() => void toggleRemoteMode(remoteMode)}
              disabled={isAnyOpportunityPending}
            >
              {REMOTE_MODE_LABELS[remoteMode]}
            </PillToggle>
          ))}
        </div>
      </div>
      <PillTabs
        label="Opportunités"
        tabs={OPPORTUNITY_TABS.map((tabKey) => ({
          key: tabKey,
          label: TAB_LABELS[tabKey],
          count: counts[tabKey],
          tabId: `opportunities-tab-${tabKey}`,
          panelId: 'opportunities-panel',
        }))}
        selectedTab={tab}
        onSelect={(tabKey) => void selectTab(tabKey)}
        isDisabled={isLoadingListing || isAnyOpportunityPending}
      />
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
          !hasMore && renderEmptyState()
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((opportunity) => (
              <li key={opportunity.id}>
                <OpportunityCard
                  opportunity={opportunity}
                  tab={tab}
                  isNew={isOpportunityNew(opportunity)}
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
