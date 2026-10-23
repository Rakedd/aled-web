import { INTERVIEW_FORMAT_LABELS, INTERVIEW_KIND_LABELS, type Interview } from './interviews'
import { formatParisDate, PARIS_TIME_ZONE } from './paris-time'

export type CalendarFeedStatus = { isActive: true; createdAt: Date } | { isActive: false; createdAt: null }

export type CalendarFeedInterview = Pick<
  Interview,
  'id' | 'jobApplicationId' | 'startsAt' | 'kind' | 'format' | 'participants'
> & {
  jobApplicationTitle: string
  endClientLabel: string | null
  intermediaryName: string | null
  jobApplicationLocation: string | null
}

export type CalendarFeedEvent = CalendarFeedInterview & { jobApplicationUrl: string }

export const CALENDAR_FEED_MESSAGES = {
  sectionTitle: 'Calendrier',
  description:
    'Abonne ton agenda (Google, Apple, Outlook) à tes entretiens Aled : il les récupère tout seul, à intervalles réguliers.',
  enable: 'Activer le flux calendrier',
  enabling: 'Activation…',
  enabled: 'Flux calendrier activé.',
  urlLabel: 'Lien de ton flux calendrier',
  copyLink: 'Copier le lien',
  linkCopied: 'Lien copié.',
  copyFailure: 'Impossible de copier le lien. Sélectionne-le et copie-le à la main.',
  addToGoogleCalendar: 'Ajouter à Google Agenda',
  addToAppleCalendar: 'Ajouter à Apple Calendrier',
  refreshDelayNotice: 'Google Agenda peut mettre plusieurs heures à afficher un nouvel entretien.',
  secretWarning: "Garde ce lien pour toi : il donne accès à tes entretiens. Il ne s'affichera plus.",
  regenerate: 'Générer un nouveau lien',
  regenerating: 'Génération…',
  regenerated: "Nouveau lien généré. L'ancien ne fonctionne plus.",
  regenerateHint: "Un nouveau lien coupe l'ancien : il faudra réabonner tes agendas.",
  disable: 'Désactiver le flux',
  disableConfirmation: 'Désactiver le flux coupe le lien : tes agendas ne recevront plus tes entretiens.',
  confirmDisable: 'Confirmer la désactivation',
  disabling: 'Désactivation…',
  cancel: 'Annuler',
  disabled: 'Flux calendrier désactivé.',
  loadFailure: 'Impossible de charger ton flux calendrier pour le moment. Réessaie dans quelques minutes.',
  creationFailure: 'Impossible de créer le lien du flux pour le moment. Réessaie dans quelques minutes.',
  disableFailure: 'Impossible de désactiver le flux pour le moment. Réessaie dans quelques minutes.',
} as const

const CALENDAR_FEED_API_PATHNAME = '/api/calendar'
const CALENDAR_FEED_FILE_EXTENSION = '.ics'
const HTTP_SCHEME_PATTERN = /^https?:\/\//
const GOOGLE_CALENDAR_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/r?cid='

export const buildCalendarFeedPathname = (calendarFeedToken: string): string =>
  `${CALENDAR_FEED_API_PATHNAME}/${calendarFeedToken}${CALENDAR_FEED_FILE_EXTENSION}`

export const toWebcalUrl = (calendarFeedUrl: string): string => calendarFeedUrl.replace(HTTP_SCHEME_PATTERN, 'webcal://')

export const buildGoogleCalendarSubscriptionUrl = (calendarFeedUrl: string): string =>
  `${GOOGLE_CALENDAR_SUBSCRIPTION_URL}${encodeURIComponent(toWebcalUrl(calendarFeedUrl))}`

export const formatCalendarFeedActiveSince = (createdAt: Date): string =>
  `Flux actif depuis le ${formatParisDate(createdAt)}`

const ICALENDAR_LINE_BREAK = '\r\n'
const ICALENDAR_FOLDED_LINE_SEPARATOR = `${ICALENDAR_LINE_BREAK} `
const ICALENDAR_FIRST_LINE_MAXIMUM_OCTETS = 75
const ICALENDAR_CONTINUATION_LINE_MAXIMUM_OCTETS = ICALENDAR_FIRST_LINE_MAXIMUM_OCTETS - 1
const CALENDAR_EVENT_DURATION_MILLISECONDS = 60 * 60 * 1000
const CALENDAR_EVENT_UID_DOMAIN = 'aled.work'
const CALENDAR_DETAIL_SEPARATOR = ' · '

const CALENDAR_HEADER_LINES = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Aled//Entretiens//FR',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:Aled · Entretiens',
  `X-WR-TIMEZONE:${PARIS_TIME_ZONE}`,
  'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  'X-PUBLISHED-TTL:PT1H',
]

const CALENDAR_FOOTER_LINES = ['END:VCALENDAR']

const HORIZONTAL_TAB_CODE_POINT = 0x09
const LAST_C0_CONTROL_CODE_POINT = 0x1f
const DELETE_CODE_POINT = 0x7f

const isForbiddenICalendarControlCharacter = (character: string): boolean => {
  const codePoint = character.codePointAt(0) ?? 0
  return (
    (codePoint <= LAST_C0_CONTROL_CODE_POINT && codePoint !== HORIZONTAL_TAB_CODE_POINT) ||
    codePoint === DELETE_CODE_POINT
  )
}

const removeForbiddenICalendarControlCharacters = (text: string): string =>
  [...text].filter((character) => !isForbiddenICalendarControlCharacter(character)).join('')

export const escapeICalendarText = (text: string): string =>
  removeForbiddenICalendarControlCharacters(
    text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n'),
  )

const countCharacterUtf8Octets = (character: string): number => {
  const codePoint = character.codePointAt(0) ?? 0
  if (codePoint < 0x80) return 1
  if (codePoint < 0x800) return 2
  if (codePoint < 0x10000) return 3
  return 4
}

export const foldICalendarLine = (line: string): string => {
  const foldedSegments: string[] = []
  let currentSegment = ''
  let currentSegmentOctets = 0
  for (const character of line) {
    const characterOctets = countCharacterUtf8Octets(character)
    const segmentMaximumOctets =
      foldedSegments.length === 0 ? ICALENDAR_FIRST_LINE_MAXIMUM_OCTETS : ICALENDAR_CONTINUATION_LINE_MAXIMUM_OCTETS
    if (currentSegmentOctets + characterOctets > segmentMaximumOctets) {
      foldedSegments.push(currentSegment)
      currentSegment = ''
      currentSegmentOctets = 0
    }
    currentSegment += character
    currentSegmentOctets += characterOctets
  }
  foldedSegments.push(currentSegment)
  return foldedSegments.join(ICALENDAR_FOLDED_LINE_SEPARATOR)
}

export const formatICalendarUtcDateTime = (date: Date): string =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')

const isPresentText = (text: string | null): text is string => text !== null && text.trim() !== ''

const buildCalendarEventSummary = (calendarFeedEvent: CalendarFeedEvent): string =>
  [
    INTERVIEW_KIND_LABELS[calendarFeedEvent.kind],
    calendarFeedEvent.jobApplicationTitle,
    ...(isPresentText(calendarFeedEvent.endClientLabel) ? [calendarFeedEvent.endClientLabel] : []),
  ].join(CALENDAR_DETAIL_SEPARATOR)

const buildCalendarEventLocation = (calendarFeedEvent: CalendarFeedEvent): string => {
  const formatLabel = INTERVIEW_FORMAT_LABELS[calendarFeedEvent.format]
  return calendarFeedEvent.format === 'onsite' && isPresentText(calendarFeedEvent.jobApplicationLocation)
    ? `${formatLabel}${CALENDAR_DETAIL_SEPARATOR}${calendarFeedEvent.jobApplicationLocation.trim()}`
    : formatLabel
}

const buildCalendarEventDescription = (calendarFeedEvent: CalendarFeedEvent): string =>
  [
    ...(isPresentText(calendarFeedEvent.participants)
      ? [`Interlocuteurs : ${calendarFeedEvent.participants.trim()}`]
      : []),
    ...(isPresentText(calendarFeedEvent.intermediaryName)
      ? [`Intermédiaire : ${calendarFeedEvent.intermediaryName.trim()}`]
      : []),
    calendarFeedEvent.jobApplicationUrl,
  ].join('\n')

const buildCalendarEventLines = (calendarFeedEvent: CalendarFeedEvent, generatedAt: Date): string[] => [
  'BEGIN:VEVENT',
  `UID:${calendarFeedEvent.id}@${CALENDAR_EVENT_UID_DOMAIN}`,
  `DTSTAMP:${formatICalendarUtcDateTime(generatedAt)}`,
  `DTSTART:${formatICalendarUtcDateTime(calendarFeedEvent.startsAt)}`,
  `DTEND:${formatICalendarUtcDateTime(new Date(calendarFeedEvent.startsAt.getTime() + CALENDAR_EVENT_DURATION_MILLISECONDS))}`,
  `SUMMARY:${escapeICalendarText(buildCalendarEventSummary(calendarFeedEvent))}`,
  `LOCATION:${escapeICalendarText(buildCalendarEventLocation(calendarFeedEvent))}`,
  `DESCRIPTION:${escapeICalendarText(buildCalendarEventDescription(calendarFeedEvent))}`,
  'END:VEVENT',
]

export const buildCalendarFeed = (
  calendarFeedEvents: CalendarFeedEvent[],
  { generatedAt }: { generatedAt: Date },
): string =>
  [
    ...CALENDAR_HEADER_LINES,
    ...calendarFeedEvents.flatMap((calendarFeedEvent) => buildCalendarEventLines(calendarFeedEvent, generatedAt)),
    ...CALENDAR_FOOTER_LINES,
  ]
    .map(foldICalendarLine)
    .map((foldedLine) => `${foldedLine}${ICALENDAR_LINE_BREAK}`)
    .join('')
