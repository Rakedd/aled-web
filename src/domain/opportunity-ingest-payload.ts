import { z } from 'zod'
import { isRecord, validateOptionalUrl } from './input-validation'
import {
  MAXIMUM_DAILY_RATE,
  MAXIMUM_STACK_ITEM_COUNT,
  MAXIMUM_STACK_ITEM_NAME_LENGTH,
  POSTING_URL_ALLOWED_PROTOCOLS,
} from './job-application'
import { isRemoteMode, type OpportunitySource, type RemoteMode } from './opportunities'

export const MAX_MISSIONS_PER_INGEST = 100

export type IngestMission = {
  source: OpportunitySource
  id: string
  title: string
  url: string
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
}

export type ParsedIngestPayload = { missions: IngestMission[]; skippedInvalid: number } | { error: string }

const INGEST_SOURCE: OpportunitySource = 'free-work'
const MAXIMUM_DURATION_MONTHS = 1200
const MALFORMED_PAYLOAD_ERROR = 'The body must be an object with a missions array'
const TOO_MANY_MISSIONS_ERROR = `At most ${MAX_MISSIONS_PER_INGEST} missions per request`

const NULL_CHARACTER = '\u0000'

const sanitizeText = (text: string): string => text.replaceAll(NULL_CHARACTER, '').toWellFormed()

const sanitizeFieldValue = (fieldValue: unknown): unknown => {
  if (typeof fieldValue === 'string') return sanitizeText(fieldValue)
  if (!Array.isArray(fieldValue)) return fieldValue
  return fieldValue.map((item: unknown) => (typeof item === 'string' ? sanitizeText(item) : item))
}

const sanitizeMissionTexts = (candidate: unknown): unknown =>
  isRecord(candidate)
    ? Object.fromEntries(Object.entries(candidate).map(([fieldName, fieldValue]) => [fieldName, sanitizeFieldValue(fieldValue)]))
    : candidate

const toNullableTrimmedText = (candidate: string | null | undefined): string | null => {
  const trimmedText = candidate?.trim() ?? ''
  return trimmedText === '' ? null : trimmedText
}

const toBoundedWholeNumber =
  (maximum: number) =>
  (candidate: number | null | undefined): number | null => {
    if (candidate === null || candidate === undefined || candidate < 0) return null
    const roundedCandidate = Math.round(candidate)
    return roundedCandidate <= maximum ? roundedCandidate : null
  }

const toRemoteMode = (candidate: string | null | undefined): RemoteMode | null =>
  isRemoteMode(candidate) ? candidate : null

const isAllowedMissionUrl = (candidate: string): boolean => {
  const urlValidation = validateOptionalUrl(candidate, POSTING_URL_ALLOWED_PROTOCOLS, MALFORMED_PAYLOAD_ERROR)
  return urlValidation.ok && urlValidation.data !== null
}

const cleanSkills = (skills: string[] | null | undefined): string[] =>
  (skills ?? [])
    .map((skill) => skill.trim())
    .filter((skill) => skill !== '')
    .slice(0, MAXIMUM_STACK_ITEM_COUNT)
    .map((skill) => skill.slice(0, MAXIMUM_STACK_ITEM_NAME_LENGTH).trimEnd())

const optionalTextSchema = z.string().nullish().transform(toNullableTrimmedText)
const dailyRateSchema = z.number().nullish().transform(toBoundedWholeNumber(MAXIMUM_DAILY_RATE))

const ingestMissionSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    url: z.string().trim().refine(isAllowedMissionUrl),
    company: optionalTextSchema,
    description: optionalTextSchema,
    rateMin: dailyRateSchema,
    rateMax: dailyRateSchema,
    rateLabel: optionalTextSchema,
    currency: optionalTextSchema,
    remoteMode: z.string().nullish().transform(toRemoteMode),
    locationLabel: optionalTextSchema,
    region: optionalTextSchema,
    country: optionalTextSchema,
    durationMonths: z.number().nullish().transform(toBoundedWholeNumber(MAXIMUM_DURATION_MONTHS)),
    publishedAt: z.iso.datetime({ offset: true }).transform((publishedAt) => new Date(publishedAt)),
    skills: z.array(z.string()).nullish().transform(cleanSkills),
  })
  .transform((mission) => ({ source: INGEST_SOURCE, ...mission }))

const parseMission = (candidate: unknown): IngestMission | null => {
  const missionParsing = ingestMissionSchema.safeParse(sanitizeMissionTexts(candidate))
  return missionParsing.success ? missionParsing.data : null
}

export const parseIngestPayload = (body: unknown): ParsedIngestPayload => {
  const candidateMissions: unknown = isRecord(body) ? body.missions : undefined
  if (!Array.isArray(candidateMissions)) return { error: MALFORMED_PAYLOAD_ERROR }
  if (candidateMissions.length > MAX_MISSIONS_PER_INGEST) return { error: TOO_MANY_MISSIONS_ERROR }
  const missions = candidateMissions
    .map(parseMission)
    .filter((mission): mission is IngestMission => mission !== null)
  return { missions, skippedInvalid: candidateMissions.length - missions.length }
}
