import {
  CALL_OUTCOME_STATUSES,
  type CallContactCandidate,
  type CallDraft,
  type CallDraftInput,
  type CallJobApplicationFields,
  type CallNoteExtraction,
} from './call-log'
import { MAXIMUM_ACTIVITY_SUMMARY_LENGTH } from './activity-log'
import { normalizePhoneNumberForSearch } from './contact-search'
import type { ContactListItem } from './contacts'
import type { CvOption } from './cv-library'
import { normalizeEntityName } from './entity-names'
import { MAXIMUM_DAILY_RATE } from './job-application'

export const MAXIMUM_CALL_CONTACT_CANDIDATES = 3

export type CallContactCriteria = {
  phone: string | null
  contactName: string | null
  intermediaryName: string | null
}

type ContactMatchKind = 'phone' | 'fullName' | 'firstName'

type RankedContact = { contact: ContactListItem; matchKind: ContactMatchKind }

const MATCH_KIND_PRIORITY: Record<ContactMatchKind, number> = { phone: 0, fullName: 1, firstName: 2 }

const toNormalizedWords = (name: string): string[] => normalizeEntityName(name).split(' ')

const findMatchKind = (contact: ContactListItem, criteria: CallContactCriteria): ContactMatchKind | null => {
  const normalizedCriteriaPhone = criteria.phone === null ? '' : normalizePhoneNumberForSearch(criteria.phone)
  if (
    normalizedCriteriaPhone !== '' &&
    contact.phone !== null &&
    normalizePhoneNumberForSearch(contact.phone) === normalizedCriteriaPhone
  ) {
    return 'phone'
  }
  const normalizedCriteriaName = criteria.contactName === null ? '' : normalizeEntityName(criteria.contactName)
  if (normalizedCriteriaName === '') return null
  if (normalizeEntityName(contact.fullName) === normalizedCriteriaName) return 'fullName'
  const contactWords = toNormalizedWords(contact.fullName)
  return toNormalizedWords(normalizedCriteriaName).every((word) => contactWords.includes(word)) ? 'firstName' : null
}

const hasSameIntermediary = (contact: ContactListItem, criteria: CallContactCriteria): boolean =>
  contact.intermediaryName !== null &&
  criteria.intermediaryName !== null &&
  normalizeEntityName(contact.intermediaryName) === normalizeEntityName(criteria.intermediaryName)

const toCandidate = ({ id, fullName, intermediaryName, phone }: ContactListItem): CallContactCandidate => ({
  id,
  fullName,
  intermediaryName,
  phone,
})

export const rankCallContactCandidates = (
  contacts: ContactListItem[],
  criteria: CallContactCriteria,
): { candidates: CallContactCandidate[]; suggestedContactId: string | null } => {
  const rankedContacts: RankedContact[] = []
  for (const contact of contacts) {
    const matchKind = findMatchKind(contact, criteria)
    if (matchKind !== null) rankedContacts.push({ contact, matchKind })
  }
  rankedContacts.sort((first, second) => {
    const priorityDifference = MATCH_KIND_PRIORITY[first.matchKind] - MATCH_KIND_PRIORITY[second.matchKind]
    if (priorityDifference !== 0) return priorityDifference
    const intermediaryDifference =
      Number(hasSameIntermediary(second.contact, criteria)) - Number(hasSameIntermediary(first.contact, criteria))
    if (intermediaryDifference !== 0) return intermediaryDifference
    return (second.contact.lastExchangeAt?.getTime() ?? 0) - (first.contact.lastExchangeAt?.getTime() ?? 0)
  })
  const bestCandidates = rankedContacts.slice(0, MAXIMUM_CALL_CONTACT_CANDIDATES)
  const [bestCandidate] = bestCandidates
  const isBestCandidateSuggestable = bestCandidate !== undefined && bestCandidate.matchKind !== 'firstName'
  return {
    candidates: bestCandidates.map(({ contact }) => toCandidate(contact)),
    suggestedContactId: isBestCandidateSuggestable ? bestCandidate.contact.id : null,
  }
}

export const matchCvOptionId = (cvOptions: CvOption[], cvLabel: string | null): string | null => {
  const normalizedCvLabel = cvLabel === null ? '' : normalizeEntityName(cvLabel)
  if (normalizedCvLabel === '') return null
  const labeledCvOptions = cvOptions.map((cvOption) => ({
    id: cvOption.id,
    normalizedLabel: normalizeEntityName(cvOption.label),
  }))
  const equalCvOption = labeledCvOptions.find(({ normalizedLabel }) => normalizedLabel === normalizedCvLabel)
  if (equalCvOption) return equalCvOption.id
  const overlappingCvOptions = labeledCvOptions.filter(
    ({ normalizedLabel }) =>
      normalizedLabel !== '' &&
      (normalizedLabel.includes(normalizedCvLabel) || normalizedCvLabel.includes(normalizedLabel)),
  )
  return overlappingCvOptions.length === 1 ? overlappingCvOptions[0].id : null
}

const toPostedDailyRate = (dailyRate: number | null): number | null => {
  if (dailyRate === null || !Number.isFinite(dailyRate)) return null
  const roundedDailyRate = Math.round(dailyRate)
  return roundedDailyRate >= 0 && roundedDailyRate <= MAXIMUM_DAILY_RATE ? roundedDailyRate : null
}

const buildContactSection = (
  input: CallDraftInput,
  extraction: CallNoteExtraction,
  contacts: ContactListItem[],
  phone: string | null,
): Pick<CallDraft['contact'], 'candidates' | 'suggestedContactId'> => {
  if (input.contactId === null) {
    return rankCallContactCandidates(contacts, {
      phone,
      contactName: extraction.contactName,
      intermediaryName: extraction.intermediaryName,
    })
  }
  const preselectedContact = contacts.find((contact) => contact.id === input.contactId)
  return preselectedContact
    ? { candidates: [toCandidate(preselectedContact)], suggestedContactId: preselectedContact.id }
    : { candidates: [], suggestedContactId: null }
}

export const buildCallDraft = ({
  input,
  extraction,
  contacts,
  cvOptions,
}: {
  input: CallDraftInput
  extraction: CallNoteExtraction
  contacts: ContactListItem[]
  cvOptions: CvOption[]
}): CallDraft => {
  const phone = input.phone ?? extraction.contactPhone
  const { candidates, suggestedContactId } = buildContactSection(input, extraction, contacts, phone)
  const trimmedSummary = extraction.summary.trim()
  const suggestedContactIntermediaryName =
    contacts.find((contact) => contact.id === suggestedContactId)?.intermediaryName ?? null
  const jobApplication: CallJobApplicationFields | null = extraction.missionProposed
    ? {
        title: extraction.missionTitle,
        endClientName: extraction.endClientName,
        intermediaryName: extraction.intermediaryName ?? suggestedContactIntermediaryName,
        postedDailyRate: toPostedDailyRate(extraction.dailyRate),
        location: extraction.location,
        remotePolicy: extraction.remotePolicy,
        desiredStart: extraction.desiredStart,
        duration: extraction.duration,
        stack: extraction.stack,
        status: CALL_OUTCOME_STATUSES[extraction.outcome],
        cvId: matchCvOptionId(cvOptions, extraction.cvLabel),
      }
    : null
  return {
    contact: {
      candidates,
      suggestedContactId,
      fullName: extraction.contactName,
      intermediaryName: extraction.intermediaryName,
      phone,
      email: extraction.contactEmail,
    },
    exchange: {
      summary: trimmedSummary === '' ? input.text.slice(0, MAXIMUM_ACTIVITY_SUMMARY_LENGTH) : trimmedSummary,
      occurredAt: input.occurredAt.toISOString(),
    },
    jobApplication,
  }
}
