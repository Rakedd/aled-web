import { useRef, useState } from 'react'
import { guardActionCall } from '@/domain/action-result'
import type { OpportunityListItem } from '@/domain/opportunities'
import type { AppliedOpportunity, HomeDashboardControllerParameters } from './interfaces'

const keepAppliedOpportunitiesVisible = (
  refreshedOpportunities: OpportunityListItem[],
  appliedOpportunities: AppliedOpportunity[],
): OpportunityListItem[] => {
  const visibleOpportunities = refreshedOpportunities.map((opportunity) => {
    const appliedOpportunity = appliedOpportunities.find(({ opportunity: applied }) => applied.id === opportunity.id)
    if (appliedOpportunity === undefined) return opportunity
    return { ...opportunity, jobApplicationId: appliedOpportunity.opportunity.jobApplicationId }
  })
  appliedOpportunities
    .filter(({ opportunity }) => !refreshedOpportunities.some((refreshed) => refreshed.id === opportunity.id))
    .forEach(({ opportunity, position }) => visibleOpportunities.splice(position, 0, opportunity))
  return visibleOpportunities
}

export const useController = ({
  highlightedOpportunities,
  applyToOpportunity,
  onDataChanged,
}: HomeDashboardControllerParameters) => {
  const [appliedOpportunities, setAppliedOpportunities] = useState<AppliedOpportunity[]>([])
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isApplyInFlight = useRef(false)

  const opportunities = keepAppliedOpportunitiesVisible(highlightedOpportunities, appliedOpportunities)

  const applyTo = async (opportunity: OpportunityListItem) => {
    if (isApplyInFlight.current) return
    isApplyInFlight.current = true
    setPendingOpportunityId(opportunity.id)
    setErrorMessage(null)
    const position = opportunities.findIndex((visibleOpportunity) => visibleOpportunity.id === opportunity.id)
    const actionResult = await guardActionCall(() => applyToOpportunity(opportunity.id))
    isApplyInFlight.current = false
    setPendingOpportunityId(null)
    if (!actionResult.ok) {
      setErrorMessage(actionResult.errorMessage)
      return
    }
    const appliedOpportunity: AppliedOpportunity = {
      opportunity: { ...opportunity, jobApplicationId: actionResult.data.jobApplicationId },
      position,
    }
    setAppliedOpportunities((currentAppliedOpportunities) =>
      [...currentAppliedOpportunities, appliedOpportunity].sort((first, second) => first.position - second.position),
    )
    onDataChanged()
  }

  return { opportunities, pendingOpportunityId, errorMessage, applyTo }
}
