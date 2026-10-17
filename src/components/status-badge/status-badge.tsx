import { JOB_APPLICATION_STATUS_LABELS, isTerminalStatus } from '@/domain/job-application-status'
import { cn } from '@/lib/utils'
import type { StatusBadgeProps } from './interfaces'

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      isTerminalStatus(status) ? 'border-transparent bg-muted text-muted-foreground' : 'border-border bg-background',
    )}
  >
    {JOB_APPLICATION_STATUS_LABELS[status]}
  </span>
)
