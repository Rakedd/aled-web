import { useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import type { OpportunityListItem } from '@/domain/opportunities'
import type { HomeDashboardControllerParameters } from './interfaces'

export const useController = ({
  highlightedOpportunities,
  applyToOpportunity,
  onDataChanged,
}: HomeDashboardControllerParameters) => {
  const [createdJobApplicationIds, setCreatedJobApplicationIds] = useState<Record<string, string>>({})
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isApplyInFlight = useRef(false)

  const opportunities = highlightedOpportunities.map(
    (opportunity): OpportunityListItem => ({
      ...opportunity,
      jobApplicationId: createdJobApplicationIds[opportunity.id] ?? opportunity.jobApplicationId,
    }),
  )

  const applyTo = async (opportunity: OpportunityListItem) => {
    if (isApplyInFlight.current) return
    isApplyInFlight.current = true
    setPendingOpportunityId(opportunity.id)
    setErrorMessage(null)
    try {
      const actionResult = await applyToOpportunity(opportunity.id)
      if (!actionResult.ok) {
        setErrorMessage(actionResult.errorMessage)
        return
      }
      setCreatedJobApplicationIds((currentIds) => ({ ...currentIds, [opportunity.id]: actionResult.data.jobApplicationId }))
      onDataChanged()
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE)
    } finally {
      isApplyInFlight.current = false
      setPendingOpportunityId(null)
    }
  }

  return { opportunities, pendingOpportunityId, errorMessage, applyTo }
}
