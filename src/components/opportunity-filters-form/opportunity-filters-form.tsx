'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { KeywordTagsInput } from '@/components/keyword-tags-input'
import { PillToggle } from '@/components/pill-toggle'
import type { PillTone } from '@/components/pill/interfaces'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeRegionName } from '@/domain/opportunity-filters'
import { REMOTE_MODE_LABELS } from '@/domain/opportunities'
import { buildRegionOptions } from '@/domain/region-options'
import { useController } from './controller'
import type { KeywordListField, OpportunityFiltersFormProps, RateFloorField } from './interfaces'

const KEYWORD_LIST_SECTIONS: {
  field: KeywordListField
  label: string
  helpText: string
  tone: PillTone
}[] = [
  {
    field: 'includeKeywords',
    label: 'Doit contenir au moins un de',
    helpText: 'Une mission doit avoir au moins un de ces mots dans son titre. Vide = pas de contrainte.',
    tone: 'sage',
  },
  {
    field: 'alwaysExcludeKeywords',
    label: 'Exclure toujours',
    helpText: "Écarte la mission dès qu'un de ces mots est dans le titre (ex. stage, alternance).",
    tone: 'clay',
  },
  {
    field: 'rescuableExcludeKeywords',
    label: 'Exclure, sauf si rattrapé',
    helpText: 'Écarte la mission, sauf si elle contient aussi un mot de rattrapage (ex. java).',
    tone: 'peach',
  },
  {
    field: 'rescueKeywords',
    label: 'Mots de rattrapage',
    helpText: 'Garde une mission exclue ci-dessus si elle contient un de ces mots (ex. react).',
    tone: 'lilac',
  },
]

const RATE_FLOOR_INPUTS: { field: RateFloorField; label: string }[] = [
  { field: 'rateFloorFullRemote', label: REMOTE_MODE_LABELS.full },
  { field: 'rateFloorHybrid', label: REMOTE_MODE_LABELS.partial },
  { field: 'rateFloorOnsite', label: REMOTE_MODE_LABELS.none },
]

const REGIONS_HELP_TEXT =
  'La mission doit être dans une de ces régions ou villes (ex. Île-de-France, Paris). Le full remote passe toujours.'

export const OpportunityFiltersForm = ({
  source,
  initialFilters,
  knownRegions,
  saveOpportunityFilters,
}: OpportunityFiltersFormProps) => {
  const router = useRouter()
  const {
    filters,
    setKeywordList,
    toggleRegion,
    rateFloorTexts,
    rateFloorErrors,
    setRateFloorText,
    isSubmitting,
    errorMessage,
    successMessage,
    submit,
  } = useController({
    source,
    initialFilters,
    saveOpportunityFilters,
    onDataChanged: router.refresh,
  })

  const regionOptions = buildRegionOptions(knownRegions, filters.regions)
  const selectedNormalizedRegions = new Set(filters.regions.map(normalizeRegionName))

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void submit()
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <p className="rounded-lg bg-muted p-3 text-sm">
        Sans aucun filtre, toutes les missions Free-Work s&apos;affichent.
      </p>
      {KEYWORD_LIST_SECTIONS.map((keywordListSection) => (
        <KeywordTagsInput
          key={keywordListSection.field}
          label={keywordListSection.label}
          helpText={keywordListSection.helpText}
          values={filters[keywordListSection.field]}
          onChange={(keywords) => setKeywordList(keywordListSection.field, keywords)}
          tone={keywordListSection.tone}
        />
      ))}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">TJM minimum</legend>
        <p className="text-xs text-muted-foreground">En €/j, vide = pas de minimum.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {RATE_FLOOR_INPUTS.map((rateFloorInput) => {
            const inputId = `opportunity-filters-form-${rateFloorInput.field}`
            const errorId = `${inputId}-error`
            const fieldErrorMessage = rateFloorErrors[rateFloorInput.field]
            return (
              <div key={rateFloorInput.field} className="flex flex-col gap-2">
                <Label htmlFor={inputId}>{rateFloorInput.label}</Label>
                <Input
                  id={inputId}
                  inputMode="numeric"
                  value={rateFloorTexts[rateFloorInput.field]}
                  aria-invalid={fieldErrorMessage ? true : undefined}
                  aria-describedby={fieldErrorMessage ? errorId : undefined}
                  onChange={(changeEvent) => setRateFloorText(rateFloorInput.field, changeEvent.target.value)}
                />
                {fieldErrorMessage && (
                  <p id={errorId} className="text-xs text-destructive">
                    {fieldErrorMessage}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Régions</legend>
        <p className="text-xs text-muted-foreground">{REGIONS_HELP_TEXT}</p>
        <div className="flex flex-wrap gap-2">
          {regionOptions.map((region) => (
            <PillToggle
              key={region}
              isPressed={selectedNormalizedRegions.has(normalizeRegionName(region))}
              onPressedChange={() => toggleRegion(region)}
            >
              {region}
            </PillToggle>
          ))}
        </div>
      </fieldset>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer les filtres'}
      </Button>
    </form>
  )
}
