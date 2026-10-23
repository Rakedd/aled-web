'use client'

import { useRouter } from 'next/navigation'
import { FollowUpMessageButton } from '@/components/follow-up-message-button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { canDraftFollowUp } from '@/domain/follow-up-message'
import {
  ALL_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_LABELS,
  PIPELINE_STATUSES,
  formatPipelineStep,
  isJobApplicationStatus,
  type JobApplicationStatus,
} from '@/domain/job-application-status'
import { NATIVE_SELECT_CLASS_NAME } from '@/lib/control-class-names'
import { cn } from '@/lib/utils'
import { useController } from './controller'
import type { JobApplicationHeaderProps } from './interfaces'

const STATUS_SELECT_ID = 'job-application-header-status'
const STATUS_CONTROLS_ID = 'job-application-header-status-controls'

const getStepState = (step: JobApplicationStatus, currentStatus: JobApplicationStatus) => {
  const currentIndex = PIPELINE_STATUSES.indexOf(currentStatus)
  const stepIndex = PIPELINE_STATUSES.indexOf(step)
  if (step === currentStatus) return 'current'
  return currentIndex !== -1 && stepIndex < currentIndex ? 'done' : 'upcoming'
}

export const JobApplicationHeader = ({
  jobApplication,
  changeJobApplicationStatus,
  hasAnthropicApiKey,
  addActivityLogEntry,
}: JobApplicationHeaderProps) => {
  const router = useRouter()
  const {
    nextStatus,
    koOptions,
    isChangingStatus,
    errorMessage,
    isStatusControlsOpen,
    advance,
    changeStatus,
    toggleStatusControls,
  } = useController({
    jobApplication,
    changeJobApplicationStatus,
    onDataChanged: router.refresh,
  })
  const pipelineStep = formatPipelineStep(jobApplication.status)

  return (
    <section aria-label="Statut de la candidature" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={jobApplication.status} />
        {pipelineStep !== null && <span className="text-ink-muted">{pipelineStep}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {canDraftFollowUp(jobApplication.status) && (
            <FollowUpMessageButton
              jobApplicationId={jobApplication.id}
              hasAnthropicApiKey={hasAnthropicApiKey}
              addActivityLogEntry={addActivityLogEntry}
            />
          )}
          <Button
            type="button"
            variant="outline"
            className="font-bold"
            aria-expanded={isStatusControlsOpen}
            aria-controls={STATUS_CONTROLS_ID}
            onClick={toggleStatusControls}
          >
            Changer le statut
          </Button>
        </div>
      </div>
      <div id={STATUS_CONTROLS_ID} hidden={!isStatusControlsOpen} className="flex flex-col gap-4">
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
              Choisir un statut
            </Label>
            <select
              id={STATUS_SELECT_ID}
              className={NATIVE_SELECT_CLASS_NAME}
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
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
