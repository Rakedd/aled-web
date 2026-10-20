import type { Metadata } from 'next'
import { OpportunityFiltersForm } from '@/components/opportunity-filters-form'
import { SettingsNavigation } from '@/components/settings-navigation'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import {
  getOpportunityFilters,
  listKnownOpportunityRegions,
  saveOpportunityFilters,
} from '@/server/actions/opportunity-actions'

export const metadata: Metadata = {
  title: 'Opportunités Free-Work · Préférences · Aled',
}

const FreeWorkOpportunitySettingsPage = async () => {
  const [filtersResult, knownRegionsResult] = await Promise.all([
    getOpportunityFilters('free-work'),
    listKnownOpportunityRegions(),
  ])

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <h1 className={PAGE_TITLE_CLASS_NAME}>Préférences</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-60 lg:shrink-0">
          <SettingsNavigation />
        </div>
        <section aria-labelledby="settings-free-work-title" className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-card p-6">
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
    </div>
  )
}

export default FreeWorkOpportunitySettingsPage
