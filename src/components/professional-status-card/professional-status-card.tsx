'use client'

import { Button } from '@/components/ui/button'
import { PROFESSIONAL_STATUSES, PROFESSIONAL_STATUS_LABELS } from '@/domain/sign-up'
import { useController } from './controller'
import type { ProfessionalStatusCardProps } from './interfaces'

export const ProfessionalStatusCard = ({ saveProfessionalStatus, answeredFocusTargetId }: ProfessionalStatusCardProps) => {
  const { isSaving, isAnswered, errorMessage, choose } = useController({
    saveProfessionalStatus,
    onAnswered: () => document.getElementById(answeredFocusTargetId)?.focus(),
  })

  if (isAnswered) return null

  return (
    <section
      aria-labelledby="professional-status-card-title"
      className="flex flex-col gap-3 rounded-2xl bg-card px-6 py-4"
    >
      <h2 id="professional-status-card-title" className="text-sm font-semibold text-ink">
        Tu es…
      </h2>
      <div className="flex flex-wrap gap-2">
        {PROFESSIONAL_STATUSES.map((professionalStatus) => (
          <Button
            key={professionalStatus}
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void choose(professionalStatus)}
          >
            {PROFESSIONAL_STATUS_LABELS[professionalStatus]}
          </Button>
        ))}
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
