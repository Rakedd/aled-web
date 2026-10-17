import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE } from '@/domain/action-result'
import {
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_KIND_LABELS,
  type InterviewWithJobApplication,
} from '@/domain/interviews'
import { formatParisInterviewDateTime } from '@/domain/paris-time'
import { STACK_CATEGORIES, STACK_CATEGORY_LABELS, type InterviewKind } from '@/domain/types'
import type {
  InterviewRevisionMissionDetail,
  InterviewRevisionPanelContent,
} from '@/components/interview-revision-panel/interfaces'
import type { InterviewCalendarEvent, InterviewsCalendarProps, InterviewsCalendarView } from './interfaces'

const NARROW_SCREEN_MAXIMUM_WIDTH_IN_PIXELS = 640

export const EVENT_STYLES_BY_KIND: Record<InterviewKind, { className: string; color: string; contrastColor: string }> = {
  client: { className: 'interview-client', color: '#1d4ed8', contrastColor: '#ffffff' },
  mock: { className: 'interview-mock', color: '#7e22ce', contrastColor: '#ffffff' },
  other: { className: 'interview-other', color: '#475569', contrastColor: '#ffffff' },
}

const toEventTitle = ({ kind, jobApplicationTitle }: InterviewWithJobApplication): string =>
  kind === 'client' ? jobApplicationTitle : `${INTERVIEW_KIND_LABELS[kind]} · ${jobApplicationTitle}`

export const toCalendarEvents = (interviews: InterviewWithJobApplication[]): InterviewCalendarEvent[] =>
  interviews.map((interview) => ({
    id: interview.id,
    title: toEventTitle(interview),
    start: interview.startsAt.toISOString(),
    ...EVENT_STYLES_BY_KIND[interview.kind],
  }))

const removeCaseInsensitiveDuplicates = (names: string[]): string[] => {
  const alreadySeenNames = new Set<string>()
  return names.filter((name) => {
    const normalizedName = name.toLowerCase()
    if (alreadySeenNames.has(normalizedName)) return false
    alreadySeenNames.add(normalizedName)
    return true
  })
}

const DAILY_RATE_NUMBER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const formatDailyRate = (dailyRate: number | null): string | null =>
  dailyRate === null ? null : `${DAILY_RATE_NUMBER_FORMAT.format(dailyRate)}\u00a0€`

const toMissionDetails = (interview: InterviewWithJobApplication): InterviewRevisionMissionDetail[] => {
  const candidateMissionDetails: { label: string; value: string | null }[] = [
    { label: 'Lieu', value: interview.location },
    { label: 'Télétravail', value: interview.remotePolicy },
    { label: 'TJM annoncé', value: formatDailyRate(interview.postedDailyRate) },
    { label: 'TJM demandé', value: formatDailyRate(interview.requestedDailyRate) },
    { label: 'Démarrage souhaité', value: interview.desiredStart },
    { label: 'Durée', value: interview.duration },
  ]
  return candidateMissionDetails.flatMap(({ label, value }) =>
    value === null || value.trim().length === 0 ? [] : [{ label, value }],
  )
}

const toRevisionPanelContent = (interview: InterviewWithJobApplication): InterviewRevisionPanelContent => ({
  jobApplicationTitle: interview.jobApplicationTitle,
  endClientLabel: interview.endClientLabel,
  startsAtLabel: formatParisInterviewDateTime(interview.startsAt),
  kindLabel: INTERVIEW_KIND_LABELS[interview.kind],
  formatLabel: INTERVIEW_FORMAT_LABELS[interview.format],
  stackGroups: STACK_CATEGORIES.map((category) => ({
    categoryLabel: STACK_CATEGORY_LABELS[category],
    stackItemNames: removeCaseInsensitiveDuplicates(
      interview.stack.filter((stackItem) => stackItem.category === category).map(({ name }) => name),
    ),
  })).filter((stackGroup) => stackGroup.stackItemNames.length > 0),
  missionDetails: toMissionDetails(interview),
  postingRawText: interview.postingRawText,
  jobApplicationHref: `/candidatures/${interview.jobApplicationId}`,
})

const subscribeToNothing = () => () => undefined

const readInitialViewForScreenWidth = (): InterviewsCalendarView =>
  window.innerWidth < NARROW_SCREEN_MAXIMUM_WIDTH_IN_PIXELS ? 'listWeek' : 'dayGridMonth'

const readInitialViewOnServer = (): InterviewsCalendarView | null => null

export const useController = ({ listUpcomingInterviews }: Pick<InterviewsCalendarProps, 'listUpcomingInterviews'>) => {
  const [interviews, setInterviews] = useState<InterviewWithJobApplication[]>([])
  const [selectedInterview, setSelectedInterview] = useState<InterviewWithJobApplication | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initialView = useSyncExternalStore(subscribeToNothing, readInitialViewForScreenWidth, readInitialViewOnServer)
  const calendarEvents = useMemo(() => toCalendarEvents(interviews), [interviews])
  const latestRangeRequestIdRef = useRef(0)

  const onDatesSet = async (rangeStart: Date, rangeEnd: Date) => {
    latestRangeRequestIdRef.current += 1
    const rangeRequestId = latestRangeRequestIdRef.current
    let loadedInterviews: InterviewWithJobApplication[] | null = null
    let failureMessage: string | null = null
    try {
      const listResult = await listUpcomingInterviews(rangeStart, rangeEnd)
      if (listResult.ok) loadedInterviews = listResult.data
      else failureMessage = listResult.errorMessage
    } catch {
      failureMessage = GENERIC_ACTION_ERROR_MESSAGE
    }
    if (rangeRequestId !== latestRangeRequestIdRef.current) return
    setErrorMessage(failureMessage)
    if (loadedInterviews !== null) setInterviews(loadedInterviews)
  }

  const selectInterview = (interviewId: string) => {
    setSelectedInterview(interviews.find((interview) => interview.id === interviewId) ?? null)
  }

  const closePanel = () => setSelectedInterview(null)

  return {
    calendarEvents,
    revisionPanelContent: selectedInterview === null ? null : toRevisionPanelContent(selectedInterview),
    errorMessage,
    initialView,
    onDatesSet,
    selectInterview,
    closePanel,
  }
}
