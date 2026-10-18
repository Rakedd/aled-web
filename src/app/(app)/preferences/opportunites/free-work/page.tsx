import type { Metadata } from 'next'
import { OpportunityFiltersForm } from '@/components/opportunity-filters-form'
import { SettingsNavigation } from '@/components/settings-navigation'
import {
  getOpportunityFilters,
  listKnownOpportunityRegions,
  saveOpportunityFilters,
} from '@/server/actions/opportunity-actions'

export const metadata: Metadata = {
  title: 'Opportunités Free-Work · Préférences · Freeclutch',
}

const FreeWorkOpportunitySettingsPage = async () => {
  const [filtersResult, knownRegionsResult] = await Promise.all([
    getOpportunityFilters('free-work'),
    listKnownOpportunityRegions(),
  ])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Préférences</h1>
      <SettingsNavigation />
      <section aria-labelledby="settings-free-work-title" className="flex flex-col gap-4">
        <h2 id="settings-free-work-title" className="text-lg font-semibold">
          Opportunités · Free-Work
        </h2>
        {!filtersResult.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {filtersResult.errorMessage}
          </p>
        ) : (
          <OpportunityFiltersForm
            source="free-work"
            initialFilters={filtersResult.data}
            knownRegions={knownRegionsResult.ok ? knownRegionsResult.data : []}
            saveOpportunityFilters={saveOpportunityFilters}
          />
        )}
      </section>
    </div>
  )
}

export default FreeWorkOpportunitySettingsPage
