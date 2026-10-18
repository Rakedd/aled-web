import { formatInTimeZone } from 'date-fns-tz'
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

export type RemoteMode = 'full' | 'partial' | 'none'

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

export type OpportunityTab = 'to_process' | 'applied' | 'dismissed'

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

const UNDISCLOSED_RATE_LABEL = 'Non communiqué'
const FEED_WATCH_START_HOUR = 9
const FEED_WATCH_END_HOUR = 22
const MAXIMUM_FEED_SILENCE_IN_MILLISECONDS = 4 * 60 * 60 * 1000

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

const buildStackFromSkills = (skills: string[]): StackItem[] => {
  const seenSkillNames = new Set<string>()
  const stack: StackItem[] = []
  for (const skill of skills) {
    if (stack.length === MAXIMUM_STACK_ITEM_COUNT) break
    const skillName = truncateText(skill, MAXIMUM_STACK_ITEM_NAME_LENGTH)
    const lowercaseSkillName = skillName.toLowerCase()
    if (skillName === '' || seenSkillNames.has(lowercaseSkillName)) continue
    seenSkillNames.add(lowercaseSkillName)
    stack.push({ name: skillName, category: 'other', origin: 'posting' })
  }
  return stack
}

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
