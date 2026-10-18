import { useEffect, useRef, useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { OpportunityListItem, OpportunityListing, OpportunityTab } from '@/domain/opportunities'
import type { OpportunitiesBoardControllerParameters } from './interfaces'

type OpportunityCounts = OpportunityListing['counts']

const shiftCount = (counts: OpportunityCounts, from: OpportunityTab, to: OpportunityTab): OpportunityCounts => ({
  ...counts,
  [from]: Math.max(0, counts[from] - 1),
  [to]: counts[to] + 1,
})

export const useController = ({
  initialTab,
  initialListing,
  listOpportunities,
  applyToOpportunity,
  dismissOpportunity,
  restoreOpportunity,
  markOpportunitiesViewed,
  onDataChanged,
  onTabChanged,
}: OpportunitiesBoardControllerParameters) => {
  const [tab, setTab] = useState(initialTab)
  const [frozenLastViewedAt] = useState(initialListing.lastViewedAt)
  const [loadedItems, setLoadedItems] = useState(initialListing.items)
  const [hasMore, setHasMore] = useState(initialListing.hasMore)
  const [counts, setCounts] = useState(initialListing.counts)
  const [currentPage, setCurrentPage] = useState(1)
  const [removedOpportunityIds, setRemovedOpportunityIds] = useState<string[]>([])
  const [pendingOpportunityIds, setPendingOpportunityIds] = useState<string[]>([])
  const [isLoadingListing, setIsLoadingListing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inFlightOpportunityIds = useRef(new Set<string>())
  const isListingRequestInFlight = useRef(false)
  const hasMarkedViewed = useRef(false)
  const decisionCountSinceLoad = useRef(0)

  useEffect(() => {
    if (hasMarkedViewed.current) return
    hasMarkedViewed.current = true
    markOpportunitiesViewed()
      .then((actionResult) => {
        if (!actionResult.ok) console.error(actionResult.errorMessage)
      })
      .catch((error: unknown) => console.error(error))
  }, [markOpportunitiesViewed])

  const items = loadedItems.filter(({ id }) => !removedOpportunityIds.includes(id))

  const isOpportunityNew = (opportunity: OpportunityListItem): boolean =>
    frozenLastViewedAt === null || opportunity.receivedAt > frozenLastViewedAt

  const isAnyOpportunityPending = pendingOpportunityIds.length > 0

  const isOpportunityPending = (opportunityId: string): boolean => pendingOpportunityIds.includes(opportunityId)

  const runOpportunityAction = async <T,>(
    opportunityId: string,
    serverAction: () => Promise<ActionResult<T>>,
  ): Promise<ActionResult<T> | null> => {
    if (inFlightOpportunityIds.current.has(opportunityId)) return null
    inFlightOpportunityIds.current.add(opportunityId)
    setPendingOpportunityIds((currentIds) => [...currentIds, opportunityId])
    setErrorMessage(null)
    try {
      return await serverAction()
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
    } finally {
      inFlightOpportunityIds.current.delete(opportunityId)
      setPendingOpportunityIds((currentIds) => currentIds.filter((currentId) => currentId !== opportunityId))
    }
  }

  const applyTo = async (opportunity: OpportunityListItem) => {
    const actionResult = await runOpportunityAction(opportunity.id, () => applyToOpportunity(opportunity.id))
    if (actionResult === null) return
    if (!actionResult.ok) {
      setErrorMessage(actionResult.errorMessage)
      return
    }
    setLoadedItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === opportunity.id
          ? { ...currentItem, decision: 'applied', jobApplicationId: actionResult.data.jobApplicationId }
          : currentItem,
      ),
    )
    setCounts((currentCounts) => shiftCount(currentCounts, 'to_process', 'applied'))
    decisionCountSinceLoad.current += 1
    onDataChanged()
  }

  const removeWithRollback = async (
    opportunity: OpportunityListItem,
    serverAction: () => Promise<ActionResult<null>>,
    destinationTab: OpportunityTab,
  ) => {
    if (inFlightOpportunityIds.current.has(opportunity.id)) return
    setRemovedOpportunityIds((currentIds) => [...currentIds, opportunity.id])
    setCounts((currentCounts) => shiftCount(currentCounts, tab, destinationTab))
    const actionResult = await runOpportunityAction(opportunity.id, serverAction)
    if (actionResult === null) return
    if (actionResult.ok) {
      decisionCountSinceLoad.current += 1
      onDataChanged()
      return
    }
    setRemovedOpportunityIds((currentIds) => currentIds.filter((currentId) => currentId !== opportunity.id))
    setCounts((currentCounts) => shiftCount(currentCounts, destinationTab, tab))
    setErrorMessage(actionResult.errorMessage)
  }

  const dismiss = (opportunity: OpportunityListItem) =>
    removeWithRollback(opportunity, () => dismissOpportunity(opportunity.id), 'dismissed')

  const restore = (opportunity: OpportunityListItem) =>
    removeWithRollback(opportunity, () => restoreOpportunity(opportunity.id), 'to_process')

  const fetchListing = async (
    requestedTab: OpportunityTab,
    page: number,
  ): Promise<ActionResult<OpportunityListing> | null> => {
    if (isListingRequestInFlight.current) return null
    isListingRequestInFlight.current = true
    setIsLoadingListing(true)
    setErrorMessage(null)
    try {
      return await listOpportunities(requestedTab, page)
    } catch {
      return { ok: false, errorMessage: GENERIC_ACTION_ERROR_MESSAGE }
    } finally {
      isListingRequestInFlight.current = false
      setIsLoadingListing(false)
    }
  }

  const selectTab = async (nextTab: OpportunityTab) => {
    if (nextTab === tab || inFlightOpportunityIds.current.size > 0) return
    const actionResult = await fetchListing(nextTab, 1)
    if (actionResult === null) return
    if (!actionResult.ok) {
      setErrorMessage(actionResult.errorMessage)
      return
    }
    setTab(nextTab)
    setLoadedItems(actionResult.data.items)
    setHasMore(actionResult.data.hasMore)
    setCounts(actionResult.data.counts)
    setCurrentPage(1)
    setRemovedOpportunityIds([])
    decisionCountSinceLoad.current = 0
    onTabChanged(nextTab)
  }

  const loadMore = async () => {
    const shouldRefetchCurrentPage = decisionCountSinceLoad.current > 0
    const fetchedListings: OpportunityListing[] = []
    const pagesToFetch = shouldRefetchCurrentPage ? [currentPage, currentPage + 1] : [currentPage + 1]
    for (const page of pagesToFetch) {
      const actionResult = await fetchListing(tab, page)
      if (actionResult === null) return
      if (!actionResult.ok) {
        setErrorMessage(actionResult.errorMessage)
        return
      }
      fetchedListings.push(actionResult.data)
    }
    const fetchedItems = fetchedListings.flatMap(({ items: pageItems }) => pageItems)
    setLoadedItems((currentItems) => {
      const knownIds = new Set(currentItems.map(({ id }) => id))
      return [...currentItems, ...fetchedItems.filter(({ id }) => !knownIds.has(id))]
    })
    setHasMore(fetchedListings[fetchedListings.length - 1].hasMore)
    setCurrentPage((page) => page + 1)
  }

  return {
    tab,
    items,
    hasMore,
    counts,
    errorMessage,
    isLoadingListing,
    isOpportunityPending,
    isOpportunityNew,
    isAnyOpportunityPending,
    applyTo,
    dismiss,
    restore,
    selectTab,
    loadMore,
  }
}
