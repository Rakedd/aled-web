import { render, screen } from '@testing-library/react'
import type { PillTone } from '@/components/pill/interfaces'
import { JOB_APPLICATION_STATUS_LABELS, type JobApplicationStatus } from '@/domain/job-application-status'
import { StatusBadge } from './status-badge'

const EXPECTED_TONES: Record<JobApplicationStatus, PillTone> = {
  applied: 'neutral',
  intermediary_contact: 'sage',
  cv_submitted: 'lilac',
  interview_scheduled: 'peach',
  interview_done: 'forest-soft',
  contract_received: 'forest-soft',
  signed: 'brand',
  ko_after_contact: 'clay',
  ko_cv: 'clay',
  ko_interview: 'clay',
  no_news_abandoned: 'clay',
}

describe('StatusBadge', () => {
  it.each(Object.entries(EXPECTED_TONES) as [JobApplicationStatus, PillTone][])(
    'renders %s with its label and tone',
    (status, expectedTone) => {
      render(<StatusBadge status={status} />)

      expect(screen.getByText(JOB_APPLICATION_STATUS_LABELS[status])).toHaveAttribute('data-tone', expectedTone)
    },
  )

  it('emphasises « Contrat reçu » in bold', () => {
    render(<StatusBadge status="contract_received" />)

    expect(screen.getByText('Contrat reçu')).toHaveClass('font-bold')
  })
})
