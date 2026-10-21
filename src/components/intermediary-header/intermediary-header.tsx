'use client'

import { formatInTimeZone } from 'date-fns-tz'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/form-field'
import { INTERMEDIARY_KIND_LABELS, INTERMEDIARY_KINDS } from '@/domain/entities'
import { pluralizeFrench } from '@/domain/french-plural'
import { PARIS_TIME_ZONE } from '@/domain/paris-time'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'
import { PAGE_TITLE_CLASS_NAME } from '@/lib/typography-class-names'
import { useController } from './controller'
import type { IntermediaryHeaderProps } from './interfaces'

const KIND_SELECT_ID = 'intermediary-kind'

export const IntermediaryHeader = ({ intermediary, updateIntermediaryKind }: IntermediaryHeaderProps) => {
  const router = useRouter()
  const { errorMessage, isSaving, changeKind } = useController({
    intermediaryId: intermediary.id,
    updateIntermediaryKind,
    onDataChanged: router.refresh,
  })

  const lastExchangeText =
    intermediary.lastExchangeAt === null
      ? 'aucun échange'
      : `dernier échange le ${formatInTimeZone(intermediary.lastExchangeAt, PARIS_TIME_ZONE, 'dd/MM/yyyy')}`

  const summary = [
    `${intermediary.contactCount} ${pluralizeFrench(intermediary.contactCount, 'contact', 'contacts')}`,
    `${intermediary.proposedMissionCount} ${pluralizeFrench(intermediary.proposedMissionCount, 'mission proposée', 'missions proposées')}`,
    lastExchangeText,
  ].join(' · ')

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className={PAGE_TITLE_CLASS_NAME}>{intermediary.name}</h1>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="w-full sm:w-64">
        <FormField htmlFor={KIND_SELECT_ID} label="Type d'intermédiaire">
          <select
            id={KIND_SELECT_ID}
            className={cn(NATIVE_SELECT_CLASS_NAME, 'w-full min-w-0')}
            value={intermediary.kind ?? ''}
            disabled={isSaving}
            onChange={(changeEvent) => void changeKind(changeEvent.target.value)}
          >
            <option value="" disabled>
              Non précisé
            </option>
            {INTERMEDIARY_KINDS.map((intermediaryKindOption) => (
              <option key={intermediaryKindOption} value={intermediaryKindOption}>
                {INTERMEDIARY_KIND_LABELS[intermediaryKindOption]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
