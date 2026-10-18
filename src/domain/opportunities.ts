import { formatInTimeZone } from 'date-fns-tz'
import type { JobApplicationInput } from './job-application'
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
  if (opportunity.rateLabel) return opportunity.rateLabel
  const { rateMin, rateMax } = opportunity
  if (rateMin !== null && rateMax !== null && rateMin !== rateMax) return `${rateMin}-${rateMax} €/j`
  const singleRate = rateMax ?? rateMin
  return singleRate === null ? UNDISCLOSED_RATE_LABEL : `${singleRate} €/j`
}

const buildStackFromSkills = (skills: string[]): StackItem[] => {
  const seenSkillNames = new Set<string>()
  const stack: StackItem[] = []
  for (const skill of skills) {
    const skillName = skill.trim()
    const lowercaseSkillName = skillName.toLowerCase()
    if (skillName === '' || seenSkillNames.has(lowercaseSkillName)) continue
    seenSkillNames.add(lowercaseSkillName)
    stack.push({ name: skillName, category: 'other', origin: 'posting' })
  }
  return stack
}

export const buildJobApplicationInputFromOpportunity = (opportunity: Opportunity, today: Date): JobApplicationInput => ({
  title: opportunity.title,
  source: OPPORTUNITY_SOURCE_LABELS[opportunity.source],
  postingUrl: opportunity.url,
  postingRawText: opportunity.description,
  status: 'applied',
  postedDailyRate: getOpportunityEffectiveRate(opportunity),
  requestedDailyRate: null,
  location: opportunity.locationLabel,
  remotePolicy: opportunity.remoteMode === null ? null : REMOTE_MODE_LABELS[opportunity.remoteMode],
  desiredStart: null,
  duration: opportunity.durationMonths === null ? null : `${opportunity.durationMonths} mois`,
  appliedOn: today,
  notes: null,
  actualStartDate: null,
  stack: buildStackFromSkills(opportunity.skills),
  intermediaryName: opportunity.company,
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
