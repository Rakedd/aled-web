import type { Metadata } from 'next'
import { OpportunitiesBoard } from '@/components/opportunities-board'
import { isOpportunityTab } from '@/domain/opportunities'
import { hasActiveOpportunityFilters } from '@/domain/opportunity-filters'
import {
  applyToOpportunity,
  dismissOpportunity,
  getOpportunityFilters,
  listOpportunities,
  markOpportunitiesViewed,
  restoreOpportunity,
} from '@/server/actions/opportunity-actions'

export const metadata: Metadata = { title: 'Mes opportunités · Freeclutch' }

const OpportunitiesPage = async ({ searchParams }: PageProps<'/opportunites'>) => {
  const { tab } = await searchParams
  const selectedTab = isOpportunityTab(tab) ? tab : 'to_process'
  const [listingResult, filtersResult] = await Promise.all([
    listOpportunities(selectedTab, 1),
    getOpportunityFilters('free-work'),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mes opportunités</h1>
      {!listingResult.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {listingResult.errorMessage}
        </p>
      ) : (
        <OpportunitiesBoard
          initialTab={selectedTab}
          initialListing={listingResult.data}
          hasActiveFilters={filtersResult.ok && hasActiveOpportunityFilters(filtersResult.data)}
          now={new Date()}
          listOpportunities={listOpportunities}
          applyToOpportunity={applyToOpportunity}
          dismissOpportunity={dismissOpportunity}
          restoreOpportunity={restoreOpportunity}
          markOpportunitiesViewed={markOpportunitiesViewed}
        />
      )}
    </div>
  )
}

export default OpportunitiesPage
