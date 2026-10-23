'use client'

import Link from 'next/link'
import { useId } from 'react'
import { MissingAnthropicApiKeyNotice } from '@/components/missing-anthropic-api-key-notice'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { OPPORTUNITY_MATCH_MESSAGES } from '@/domain/opportunity-match'
import { CV_LIBRARY_ROUTE } from '@/domain/routes'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { useController } from './controller'
import type { CvSkillsExtractorProps } from './interfaces'

export const CvSkillsExtractor = ({
  cvOptions,
  hasAnthropicApiKey,
  cvLibraryErrorMessage,
  mySkills,
  extractSkillsFromCv,
  onSkillsExtracted,
}: CvSkillsExtractorProps) => {
  const { selectedCvId, selectCv, isExtracting, errorMessage, statusMessage, extract } = useController({
    cvOptions,
    mySkills,
    extractSkillsFromCv,
    onSkillsExtracted,
  })
  const titleId = useId()
  const cvSelectId = useId()
  const canExtract = hasAnthropicApiKey && cvOptions.length > 0

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      <h3 id={titleId} className="text-sm font-medium">
        {OPPORTUNITY_MATCH_MESSAGES.fillFromCvTitle}
      </h3>
      {cvLibraryErrorMessage !== null && (
        <p role="alert" className="text-sm text-destructive">
          {cvLibraryErrorMessage}
        </p>
      )}
      {cvLibraryErrorMessage === null && cvOptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {OPPORTUNITY_MATCH_MESSAGES.noCvBeforeLink}
          <Link href={CV_LIBRARY_ROUTE} className="text-accent-text underline underline-offset-2">
            {OPPORTUNITY_MATCH_MESSAGES.noCvLink}
          </Link>
          {OPPORTUNITY_MATCH_MESSAGES.noCvAfterLink}
        </p>
      )}
      {!hasAnthropicApiKey && (
        <MissingAnthropicApiKeyNotice featureDescription={OPPORTUNITY_MATCH_MESSAGES.skillExtractionFeature} />
      )}
      {canExtract && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor={cvSelectId}>{OPPORTUNITY_MATCH_MESSAGES.cvSelectLabel}</Label>
            <select
              id={cvSelectId}
              className={NATIVE_SELECT_CLASS_NAME}
              value={selectedCvId}
              disabled={isExtracting}
              onChange={(changeEvent) => selectCv(changeEvent.target.value)}
            >
              {cvOptions.map((cvOption) => (
                <option key={cvOption.id} value={cvOption.id}>
                  {cvOption.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" size="lg" disabled={isExtracting} onClick={() => void extract()}>
            {isExtracting ? OPPORTUNITY_MATCH_MESSAGES.extractingSkills : OPPORTUNITY_MATCH_MESSAGES.extractSkills}
          </Button>
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <p role="status" className="text-sm text-muted-foreground empty:sr-only">
        {statusMessage}
      </p>
    </section>
  )
}
