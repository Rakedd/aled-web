'use client'

import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ACTIVITY_KIND_LABELS } from '@/domain/activity-log'
import type { ActivityKind } from '@/domain/types'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { useController } from './controller'
import type { ExchangeFormParameters } from './interfaces'

const KIND_SELECT_ID = 'exchange-form-kind'
const OCCURRED_AT_INPUT_ID = 'exchange-form-occurred-at'
const SUMMARY_INPUT_ID = 'exchange-form-summary'
const JOB_APPLICATION_SELECT_ID = 'exchange-form-job-application'

export const ExchangeForm = ({ jobApplicationOptions, ...controllerParameters }: ExchangeFormParameters) => {
  const router = useRouter()
  const {
    kind,
    setKind,
    kindOptions,
    summary,
    setSummary,
    jobApplicationId,
    setJobApplicationId,
    occurredAtLocalDateTime,
    setOccurredAtLocalDateTime,
    isAdding,
    errorMessage,
    addExchange,
  } = useController({ ...controllerParameters, onDataChanged: router.refresh })

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    void addExchange()
  }

  const handleKindChange = (candidate: string) => {
    const matchingKind: ActivityKind | undefined = kindOptions.find((kindOption) => kindOption === candidate)
    if (matchingKind) setKind(matchingKind)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">Noter un échange</h3>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={KIND_SELECT_ID}>Type</Label>
            <select
              id={KIND_SELECT_ID}
              className={NATIVE_SELECT_CLASS_NAME}
              value={kind}
              onChange={(changeEvent) => handleKindChange(changeEvent.target.value)}
              disabled={isAdding}
            >
              {kindOptions.map((kindOption) => (
                <option key={kindOption} value={kindOption}>
                  {ACTIVITY_KIND_LABELS[kindOption]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={OCCURRED_AT_INPUT_ID}>Date et heure</Label>
            <Input
              id={OCCURRED_AT_INPUT_ID}
              type="datetime-local"
              value={occurredAtLocalDateTime}
              onChange={(changeEvent) => setOccurredAtLocalDateTime(changeEvent.target.value)}
              disabled={isAdding}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={SUMMARY_INPUT_ID}>Résumé</Label>
          <Input
            id={SUMMARY_INPUT_ID}
            value={summary}
            onChange={(changeEvent) => setSummary(changeEvent.target.value)}
            placeholder="Ex. : appel de qualification, rappeler jeudi"
            disabled={isAdding}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={JOB_APPLICATION_SELECT_ID}>Candidature</Label>
          <select
            id={JOB_APPLICATION_SELECT_ID}
            className={NATIVE_SELECT_CLASS_NAME}
            value={jobApplicationId}
            onChange={(changeEvent) => setJobApplicationId(changeEvent.target.value)}
            disabled={isAdding}
          >
            <option value="">Aucune</option>
            {jobApplicationOptions.map((jobApplicationOption) => (
              <option key={jobApplicationOption.id} value={jobApplicationOption.id}>
                {jobApplicationOption.title}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="self-start" disabled={isAdding}>
          Ajouter
        </Button>
      </form>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
