import { formatInTimeZone } from 'date-fns-tz'
import type { ActionResult } from './action-result'
import { normalizeEntityName } from './entity-names'
import { isRecord, isUuid, rejectWith, validateUuid } from './input-validation'
import {
  JOB_APPLICATION_TEXT_FIELD_RULES,
  type JobApplicationInput,
  MAXIMUM_STACK_ITEM_COUNT,
  MAXIMUM_STACK_ITEM_NAME_LENGTH,
} from './job-application'
import { PARIS_TIME_ZONE } from './paris-time'
import type { StackItem } from './types'

export const OPPORTUNITY_SOURCES = ['free-work'] as const

export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number]

export const OPPORTUNITY_SOURCE_LABELS: Record<OpportunitySource, string> = {
  'free-work': 'Free-Work',
}

export const REMOTE_MODES = ['full', 'partial', 'none'] as const

export type RemoteMode = (typeof REMOTE_MODES)[number]

export const REMOTE_MODE_LABELS: Record<RemoteMode, string> = {
  full: 'Full remote',
  partial: 'Hybride',
  none: 'Sur site',
}

export type Opportunity = {
  id: string
  source: OpportunitySource
  externalId: string
  url: string
  title: string
  company: string | null
  description: string | null
  rateMin: number | null
  rateMax: number | null
  rateLabel: string | null
  currency: string | null
  remoteMode: RemoteMode | null
  locationLabel: string | null
  region: string | null
  country: string | null
  durationMonths: number | null
  publishedAt: Date
  skills: string[]
  receivedAt: Date
}

export type OpportunityDecision = 'applied' | 'dismissed'

export const OPPORTUNITY_TABS = ['to_process', 'applied', 'dismissed'] as const

export type OpportunityTab = (typeof OPPORTUNITY_TABS)[number]

export type OpportunityListItem = Opportunity & {
  decision: OpportunityDecision | null
  jobApplicationId: string | null
}

export type OpportunityListing = {
  items: OpportunityListItem[]
  hasMore: boolean
  counts: Record<OpportunityTab, number>
  lastReceivedAt: Date | null
  lastViewedAt: Date | null
}

export const OPPORTUNITY_PAGE_SIZE = 50
export const TO_PROCESS_WINDOW_DAYS = 7
export const HISTORY_WINDOW_DAYS = 30

export const OPPORTUNITY_VALIDATION_MESSAGES = {
  notFound: 'Opportunité introuvable',
  unknownSource: 'Source inconnue',
  invalidListingRequest: 'Onglet ou page invalide',
  notDismissed: "Cette mission n'est pas ignorée",
  alreadyApplied: 'Tu as déjà postulé à cette mission',
} as const

export type OpportunityListingCursor = { publishedAt: string; id: string }

export type OpportunityListingPosition = { publishedAt: Date; id: string }

export type OpportunityListingRequest = { tab: OpportunityTab; after: OpportunityListingPosition | null }

const UNDISCLOSED_RATE_LABEL = 'Non communiqué'
const FEED_WATCH_START_HOUR = 9
const FEED_WATCH_END_HOUR = 22
const MAXIMUM_FEED_SILENCE_IN_MILLISECONDS = 4 * 60 * 60 * 1000

export const isOpportunitySource = (candidate: unknown): candidate is OpportunitySource =>
  OPPORTUNITY_SOURCES.some((opportunitySource) => opportunitySource === candidate)

export const isRemoteMode = (candidate: unknown): candidate is RemoteMode =>
  REMOTE_MODES.some((remoteMode) => remoteMode === candidate)

export const isOpportunityTab = (candidate: unknown): candidate is OpportunityTab =>
  OPPORTUNITY_TABS.some((opportunityTab) => opportunityTab === candidate)

export const validateOpportunityId = (candidate: unknown): ActionResult<string> =>
  validateUuid(candidate, OPPORTUNITY_VALIDATION_MESSAGES.notFound)

export const validateOpportunitySource = (candidate: unknown): ActionResult<OpportunitySource> =>
  isOpportunitySource(candidate)
    ? { ok: true, data: candidate }
    : rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.unknownSource)

const toListingPosition = (cursor: unknown): OpportunityListingPosition | null => {
  if (!isRecord(cursor) || typeof cursor.publishedAt !== 'string' || !isUuid(cursor.id)) return null
  const publishedAt = new Date(cursor.publishedAt)
  return Number.isNaN(publishedAt.getTime()) ? null : { publishedAt, id: cursor.id.toLowerCase() }
}

export const validateOpportunityListingRequest = (
  tab: unknown,
  cursor: unknown,
): ActionResult<OpportunityListingRequest> => {
  if (!isOpportunityTab(tab)) return rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.invalidListingRequest)
  if (cursor === null) return { ok: true, data: { tab, after: null } }
  const after = toListingPosition(cursor)
  return after === null
    ? rejectWith(OPPORTUNITY_VALIDATION_MESSAGES.invalidListingRequest)
    : { ok: true, data: { tab, after } }
}

export const getOpportunityEffectiveRate = (opportunity: Pick<Opportunity, 'rateMin' | 'rateMax'>): number | null =>
  opportunity.rateMax ?? opportunity.rateMin

export const formatOpportunityRate = (opportunity: Pick<Opportunity, 'rateLabel' | 'rateMin' | 'rateMax'>): string => {
  const trimmedRateLabel = opportunity.rateLabel?.trim() ?? ''
  if (trimmedRateLabel !== '') return trimmedRateLabel
  const { rateMin, rateMax } = opportunity
  if (rateMin !== null && rateMax !== null && rateMin !== rateMax) return `${rateMin}-${rateMax} €/j`
  const singleRate = rateMax ?? rateMin
  return singleRate === null ? UNDISCLOSED_RATE_LABEL : `${singleRate} €/j`
}

const truncateText = (text: string, maximumLength: number): string => text.trim().slice(0, maximumLength).trimEnd()

const truncateOptionalText = (text: string | null, maximumLength: number): string | null => {
  if (text === null) return null
  const truncatedText = truncateText(text, maximumLength)
  return truncatedText === '' ? null : truncatedText
}

const formatDuration = (durationMonths: number | null): string | null =>
  durationMonths === null || durationMonths <= 0 ? null : `${durationMonths} mois`

const upgradeOtherCategory = (keptStackItem: StackItem, duplicateStackItem: StackItem): StackItem =>
  keptStackItem.category === 'other' ? { ...keptStackItem, category: duplicateStackItem.category } : keptStackItem

export const mergeStackItems = (base: StackItem[], extra: StackItem[]): StackItem[] => {
  const mergedStackItemIndexByKey = new Map<string, number>()
  const mergedStack: StackItem[] = []
  for (const stackItem of [...base, ...extra]) {
    const stackItemName = truncateText(stackItem.name, MAXIMUM_STACK_ITEM_NAME_LENGTH)
    const stackItemKey = normalizeEntityName(stackItemName)
    if (stackItemKey === '') continue
    const duplicateIndex = mergedStackItemIndexByKey.get(stackItemKey)
    if (duplicateIndex !== undefined) {
      mergedStack[duplicateIndex] = upgradeOtherCategory(mergedStack[duplicateIndex], stackItem)
      continue
    }
    if (mergedStack.length === MAXIMUM_STACK_ITEM_COUNT) continue
    mergedStackItemIndexByKey.set(stackItemKey, mergedStack.length)
    mergedStack.push({ ...stackItem, name: stackItemName })
  }
  return mergedStack
}

const buildStackFromSkills = (skills: string[]): StackItem[] =>
  mergeStackItems(
    skills.map((skill) => ({ name: skill, category: 'other', origin: 'posting' })),
    [],
  )

export const buildJobApplicationInputFromOpportunity = (opportunity: Opportunity, today: Date): JobApplicationInput => ({
  title: truncateText(opportunity.title, JOB_APPLICATION_TEXT_FIELD_RULES.title.maximumLength),
  source: OPPORTUNITY_SOURCE_LABELS[opportunity.source],
  postingUrl: opportunity.url,
  postingRawText: truncateOptionalText(
    opportunity.description,
    JOB_APPLICATION_TEXT_FIELD_RULES.postingRawText.maximumLength,
  ),
  status: 'applied',
  postedDailyRate: getOpportunityEffectiveRate(opportunity),
  requestedDailyRate: null,
  location: truncateOptionalText(opportunity.locationLabel, JOB_APPLICATION_TEXT_FIELD_RULES.location.maximumLength),
  remotePolicy: opportunity.remoteMode === null ? null : REMOTE_MODE_LABELS[opportunity.remoteMode],
  desiredStart: null,
  duration: formatDuration(opportunity.durationMonths),
  appliedOn: today,
  notes: null,
  actualStartDate: null,
  stack: buildStackFromSkills(opportunity.skills),
  intermediaryName: truncateOptionalText(
    opportunity.company,
    JOB_APPLICATION_TEXT_FIELD_RULES.intermediaryName.maximumLength,
  ),
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  endClientName: null,
  endClientParentName: null,
})

const isWithinFeedWatchHours = (now: Date): boolean => {
  const parisHour = Number(formatInTimeZone(now, PARIS_TIME_ZONE, 'H'))
  return parisHour >= FEED_WATCH_START_HOUR && parisHour < FEED_WATCH_END_HOUR
}

export const isOpportunityFeedStale = (lastReceivedAt: Date | null, now: Date): boolean => {
  if (!isWithinFeedWatchHours(now)) return false
  if (lastReceivedAt === null) return true
  return now.getTime() - lastReceivedAt.getTime() > MAXIMUM_FEED_SILENCE_IN_MILLISECONDS
}
