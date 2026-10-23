import { countParisCalendarDaysBetween, formatParisDate } from '@/domain/paris-time'

export const DUPLICATE_POSITIONING_WINDOW_DAYS = 30

export const DUPLICATE_POSITIONING_MESSAGES = {
  warning: 'Ce positionnement risque de faire doublon, attention.',
  detail:
    "Ce client a déjà reçu ton CV il y a moins d'un mois par une autre agence. Si deux agences le présentent, la mission est souvent perdue.",
}

export type PositioningCandidate = {
  jobApplicationId: string | null
  endClientName: string | null
  endClientParentName: string | null
  intermediaryName: string | null
  appliedOn: Date
}

export type PositionedJobApplication = {
  id: string
  title: string
  endClientName: string | null
  endClientParentName: string | null
  intermediaryName: string | null
  appliedOn: Date
}

export const normalizeOrganisationName = (name: string | null): string =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const collectNormalizedEndClientNames = (
  endClientName: string | null,
  endClientParentName: string | null,
): Set<string> =>
  new Set(
    [endClientName, endClientParentName]
      .map(normalizeOrganisationName)
      .filter((normalizedName) => normalizedName !== ''),
  )

const isWithinPositioningWindow = (first: Date, second: Date): boolean =>
  Math.abs(countParisCalendarDaysBetween(first, second)) <= DUPLICATE_POSITIONING_WINDOW_DAYS

const areDifferentAgencies = (first: string | null, second: string | null): boolean => {
  const normalizedFirst = normalizeOrganisationName(first)
  const normalizedSecond = normalizeOrganisationName(second)
  return normalizedFirst === '' || normalizedSecond === '' || normalizedFirst !== normalizedSecond
}

export const findDuplicatePositioningRisks = (
  candidate: PositioningCandidate,
  jobApplications: PositionedJobApplication[],
): PositionedJobApplication[] => {
  const candidateNames = collectNormalizedEndClientNames(candidate.endClientName, candidate.endClientParentName)
  if (candidateNames.size === 0) return []

  return jobApplications
    .filter((jobApplication) => {
      if (jobApplication.id === candidate.jobApplicationId) return false
      const existingNames = collectNormalizedEndClientNames(
        jobApplication.endClientName,
        jobApplication.endClientParentName,
      )
      const sharesEndClient = [...existingNames].some((existingName) => candidateNames.has(existingName))
      return (
        sharesEndClient &&
        isWithinPositioningWindow(candidate.appliedOn, jobApplication.appliedOn) &&
        areDifferentAgencies(candidate.intermediaryName, jobApplication.intermediaryName)
      )
    })
    .sort((first, second) => second.appliedOn.getTime() - first.appliedOn.getTime())
}

export const describeDuplicatePositioning = (jobApplication: PositionedJobApplication): string =>
  `${jobApplication.title} · ${jobApplication.intermediaryName ?? 'agence inconnue'} · ${formatParisDate(jobApplication.appliedOn)}`
