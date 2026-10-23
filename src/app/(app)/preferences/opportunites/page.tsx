import type { Metadata } from 'next'
import { OpportunityFiltersForm } from '@/components/opportunity-filters-form'
import { SettingsNavigation } from '@/components/settings-navigation'
import { toCvOptions } from '@/domain/cv-library'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { listCvs } from '@/server/actions/cv-actions'
import {
  getOpportunityFilters,
  listKnownOpportunityRegions,
  saveOpportunityFilters,
} from '@/server/actions/opportunity-actions'
import { extractSkillsFromCv } from '@/server/actions/opportunity-skills-actions'
import { hasAnthropicApiKeyConfigured } from '@/server/actions/settings-actions'

export const metadata: Metadata = {
  title: 'Opportunités · Préférences · Aled',
}

export const maxDuration = 120

const OpportunitySettingsPage = async () => {
  const [filtersResult, knownRegionsResult, cvsResult, hasAnthropicApiKey] = await Promise.all([
    getOpportunityFilters(),
    listKnownOpportunityRegions(),
    listCvs(),
    hasAnthropicApiKeyConfigured(),
  ])

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <h1 className={PAGE_TITLE_CLASS_NAME}>Préférences</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-60 lg:shrink-0">
          <SettingsNavigation />
        </div>
        <section aria-labelledby="settings-opportunities-title" className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-card p-6">
          <h2 id="settings-opportunities-title" className="text-lg font-semibold">
            Opportunités
          </h2>
          {!filtersResult.ok ? (
            <p role="alert" className="text-sm text-destructive">
              {filtersResult.errorMessage}
            </p>
          ) : (
            <OpportunityFiltersForm
              initialFilters={filtersResult.data}
              knownRegions={knownRegionsResult.ok ? knownRegionsResult.data : []}
              cvOptions={cvsResult.ok ? toCvOptions(cvsResult.data) : []}
              cvLibraryErrorMessage={cvsResult.ok ? null : cvsResult.errorMessage}
              hasAnthropicApiKey={hasAnthropicApiKey}
              saveOpportunityFilters={saveOpportunityFilters}
              extractSkillsFromCv={extractSkillsFromCv}
            />
          )}
        </section>
      </div>
    </div>
  )
}

export default OpportunitySettingsPage
