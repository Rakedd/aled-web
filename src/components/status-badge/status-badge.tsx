import { Pill } from '@/components/pill'
import type { PillTone } from '@/components/pill/interfaces'
import { JOB_APPLICATION_STATUS_LABELS, type JobApplicationStatus } from '@/domain/job-application-status'
import type { StatusBadgeProps } from './interfaces'

export const STATUS_BADGE_TONES: Record<JobApplicationStatus, PillTone> = {
  applied: 'neutral',
  intermediary_contact: 'sage',
  cv_submitted: 'lilac',
  interview_scheduled: 'peach',
  interview_done: 'forest-soft',
  contract_received: 'forest-soft',
  signed: 'forest',
  ko_after_contact: 'clay',
  ko_cv: 'clay',
  ko_interview: 'clay',
  no_news_abandoned: 'clay',
}

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <Pill tone={STATUS_BADGE_TONES[status]} className={status === 'contract_received' ? 'font-bold' : undefined}>
    {JOB_APPLICATION_STATUS_LABELS[status]}
  </Pill>
)
