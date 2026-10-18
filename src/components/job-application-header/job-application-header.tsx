'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ALL_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_LABELS,
  PIPELINE_STATUSES,
  isJobApplicationStatus,
  type JobApplicationStatus,
} from '@/domain/job-application-status'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { useController } from './controller'
import type { JobApplicationHeaderProps } from './interfaces'

const STATUS_SELECT_ID = 'job-application-header-status'

const getStepState = (step: JobApplicationStatus, currentStatus: JobApplicationStatus) => {
  const currentIndex = PIPELINE_STATUSES.indexOf(currentStatus)
  const stepIndex = PIPELINE_STATUSES.indexOf(step)
  if (step === currentStatus) return 'current'
  return currentIndex !== -1 && stepIndex < currentIndex ? 'done' : 'upcoming'
}

export const JobApplicationHeader = ({ jobApplication, changeJobApplicationStatus }: JobApplicationHeaderProps) => {
  const router = useRouter()
  const { nextStatus, koOptions, isChangingStatus, errorMessage, advance, changeStatus } = useController({
    jobApplication,
    changeJobApplicationStatus,
    onDataChanged: router.refresh,
  })

  return (
    <section aria-label="Statut de la candidature" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Statut</span>
        <StatusBadge status={jobApplication.status} />
      </div>
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Avancement de la candidature">
        {PIPELINE_STATUSES.map((step) => {
          const stepState = getStepState(step, jobApplication.status)
          return (
            <li
              key={step}
              aria-current={stepState === 'current' ? 'step' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-xs whitespace-nowrap',
                stepState === 'current' && 'border-primary bg-primary text-primary-foreground',
                stepState === 'done' && 'border-border bg-muted text-foreground',
                stepState === 'upcoming' && 'border-border text-muted-foreground',
              )}
            >
              {JOB_APPLICATION_STATUS_LABELS[step]}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-end gap-2">
        {nextStatus !== null && (
          <Button type="button" onClick={() => void advance()} disabled={isChangingStatus}>
            Passer à « {JOB_APPLICATION_STATUS_LABELS[nextStatus]} »
          </Button>
        )}
        {koOptions.map((koStatus) => (
          <Button
            key={koStatus}
            type="button"
            variant="outline"
            onClick={() => void changeStatus(koStatus)}
            disabled={isChangingStatus}
          >
            {JOB_APPLICATION_STATUS_LABELS[koStatus]}
          </Button>
        ))}
        <div className="flex flex-col gap-1">
          <Label htmlFor={STATUS_SELECT_ID} className="text-xs text-muted-foreground">
            Changer le statut
          </Label>
          <select
            id={STATUS_SELECT_ID}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            value={jobApplication.status}
            disabled={isChangingStatus}
            onChange={(changeEvent) => {
              if (isJobApplicationStatus(changeEvent.target.value)) void changeStatus(changeEvent.target.value)
            }}
          >
            {ALL_JOB_APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_APPLICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
